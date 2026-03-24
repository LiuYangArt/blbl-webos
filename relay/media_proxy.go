package main

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

const maxMediaProxyRedirects = 4

func (s *Server) handleMediaProxy(writer http.ResponseWriter, request *http.Request) {
	if request.Method == http.MethodOptions {
		writeMediaProxyCORSHeaders(writer.Header())
		writer.WriteHeader(http.StatusNoContent)
		return
	}

	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		writeMediaProxyCORSHeaders(writer.Header())
		s.writeJSON(writer, http.StatusMethodNotAllowed, map[string]any{
			"ok":      false,
			"error":   "method_not_allowed",
			"message": "media proxy 仅支持 GET / HEAD / OPTIONS",
		})
		return
	}

	if !s.isAuthorized(request) {
		writeMediaProxyCORSHeaders(writer.Header())
		s.writeJSON(writer, http.StatusUnauthorized, map[string]any{
			"ok":    false,
			"error": "unauthorized",
		})
		return
	}

	targetURL := strings.TrimSpace(request.URL.Query().Get("url"))
	if targetURL == "" {
		writeMediaProxyCORSHeaders(writer.Header())
		s.writeJSON(writer, http.StatusBadRequest, map[string]any{
			"ok":      false,
			"error":   "bad_request",
			"message": "missing url",
		})
		return
	}

	upstreamURL, err := url.Parse(targetURL)
	if err != nil || upstreamURL.Scheme == "" || upstreamURL.Host == "" {
		writeMediaProxyCORSHeaders(writer.Header())
		s.writeJSON(writer, http.StatusBadRequest, map[string]any{
			"ok":      false,
			"error":   "bad_request",
			"message": "invalid url",
		})
		return
	}

	if !isAllowedMediaHost(upstreamURL.Hostname()) || (upstreamURL.Scheme != "https" && upstreamURL.Scheme != "http") {
		writeMediaProxyCORSHeaders(writer.Header())
		s.writeJSON(writer, http.StatusBadRequest, map[string]any{
			"ok":      false,
			"error":   "bad_request",
			"message": "unsupported upstream host",
		})
		return
	}

	if err := s.proxyMediaRequest(writer, request, upstreamURL, 0); err != nil {
		writeMediaProxyCORSHeaders(writer.Header())
		s.writeJSON(writer, http.StatusBadGateway, map[string]any{
			"ok":      false,
			"error":   "proxy_failed",
			"message": err.Error(),
		})
	}
}

func (s *Server) proxyMediaRequest(
	writer http.ResponseWriter,
	request *http.Request,
	upstreamURL *url.URL,
	redirectDepth int,
) error {
	if redirectDepth > maxMediaProxyRedirects {
		return fmt.Errorf("上游重定向次数过多")
	}

	upstreamRequest, err := http.NewRequestWithContext(request.Context(), request.Method, upstreamURL.String(), nil)
	if err != nil {
		return err
	}

	state := s.store.Snapshot()
	for name, value := range buildUpstreamMediaHeaders(request.Header, buildCookieHeader(state.Cookies), s.config.UserAgent) {
		if value != "" {
			upstreamRequest.Header.Set(name, value)
		}
	}

	client := &http.Client{
		Timeout: s.config.RequestTimeout,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	upstreamResponse, err := client.Do(upstreamRequest)
	if err != nil {
		return fmt.Errorf("请求上游媒体失败：%w", err)
	}
	defer upstreamResponse.Body.Close()

	if isRedirectStatus(upstreamResponse.StatusCode) {
		location := strings.TrimSpace(upstreamResponse.Header.Get("Location"))
		if location == "" {
			return fmt.Errorf("上游返回了空重定向地址")
		}
		nextURL, err := upstreamURL.Parse(location)
		if err != nil {
			return fmt.Errorf("上游重定向地址不合法：%w", err)
		}
		return s.proxyMediaRequest(writer, request, nextURL, redirectDepth+1)
	}

	copyMediaProxyResponseHeaders(writer.Header(), upstreamResponse.Header)
	writer.WriteHeader(upstreamResponse.StatusCode)
	if request.Method == http.MethodHead {
		return nil
	}

	if _, err := io.Copy(writer, upstreamResponse.Body); err != nil {
		return fmt.Errorf("转发媒体响应失败：%w", err)
	}
	return nil
}

func buildUpstreamMediaHeaders(clientHeaders http.Header, cookieHeader string, userAgent string) map[string]string {
	headers := map[string]string{
		"Accept":          firstNonEmpty(clientHeaders.Get("Accept"), "*/*"),
		"Accept-Language": firstNonEmpty(clientHeaders.Get("Accept-Language"), "zh-CN,zh;q=0.9"),
		"Origin":          "https://www.bilibili.com",
		"Referer":         "https://www.bilibili.com/",
		"User-Agent":      userAgent,
	}

	if rangeValue := strings.TrimSpace(clientHeaders.Get("Range")); rangeValue != "" {
		headers["Range"] = rangeValue
	}
	if cookieHeader != "" {
		headers["Cookie"] = cookieHeader
	}
	return headers
}

func copyMediaProxyResponseHeaders(destination http.Header, upstream http.Header) {
	writeMediaProxyCORSHeaders(destination)
	for _, key := range []string{
		"Accept-Ranges",
		"Cache-Control",
		"Content-Length",
		"Content-Range",
		"Content-Type",
		"Date",
		"ETag",
		"Expires",
		"Last-Modified",
		"Transfer-Encoding",
	} {
		for _, value := range upstream.Values(key) {
			destination.Add(key, value)
		}
	}
}

func writeMediaProxyCORSHeaders(headers http.Header) {
	headers.Set("Access-Control-Allow-Origin", "*")
	headers.Set("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS")
	headers.Set("Access-Control-Allow-Headers", "range,content-type,x-relay-token,authorization")
	headers.Set("Access-Control-Expose-Headers", "accept-ranges,content-length,content-range,content-type")
}

func isAllowedMediaHost(hostname string) bool {
	normalized := strings.ToLower(strings.TrimSpace(hostname))
	return strings.HasSuffix(normalized, ".bilivideo.com") ||
		strings.HasSuffix(normalized, ".bilivideo.cn") ||
		normalized == "127.0.0.1" ||
		normalized == "localhost" ||
		normalized == "::1"
}

func isRedirectStatus(statusCode int) bool {
	return statusCode == http.StatusMovedPermanently ||
		statusCode == http.StatusFound ||
		statusCode == http.StatusSeeOther ||
		statusCode == http.StatusTemporaryRedirect ||
		statusCode == http.StatusPermanentRedirect
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
