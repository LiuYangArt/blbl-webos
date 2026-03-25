package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var interestingCookieNames = map[string]bool{
	"SESSDATA":          true,
	"bili_jct":          true,
	"DedeUserID":        true,
	"DedeUserID__ckMd5": true,
	"buvid3":            true,
	"buvid4":            true,
}

type BilibiliClient struct {
	apiBaseURL      string
	passportBaseURL string
	timeout         time.Duration
	userAgent       string
}

type relayError struct {
	Kind       string `json:"kind"`
	Message    string `json:"message"`
	StatusCode int    `json:"statusCode,omitempty"`
}

func (e *relayError) Error() string {
	return e.Message
}

func newRelayError(kind, message string, statusCode int) *relayError {
	return &relayError{
		Kind:       kind,
		Message:    message,
		StatusCode: statusCode,
	}
}

func NewBilibiliClient(cfg Config) *BilibiliClient {
	return &BilibiliClient{
		apiBaseURL:      strings.TrimRight(cfg.BiliAPIBaseURL, "/"),
		passportBaseURL: strings.TrimRight(cfg.BiliPassportURL, "/"),
		timeout:         cfg.RequestTimeout,
		userAgent:       cfg.UserAgent,
	}
}

func (c *BilibiliClient) CompleteWebLogin(ctx context.Context, loginURL string) (map[string]string, error) {
	cookiesFromURL := extractLoginURLCookies(loginURL)
	if hasRequiredLoginCookies(cookiesFromURL) {
		return cookiesFromURL, nil
	}

	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{
		Jar:     jar,
		Timeout: c.timeout,
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, loginURL, nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("User-Agent", c.userAgent)
	request.Header.Set("Accept", "text/html,application/json,*/*")

	response, err := client.Do(request)
	if err != nil {
		return nil, newRelayError("auth_sync_failed", fmt.Sprintf("登录完成请求失败：%v", err), http.StatusBadGateway)
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, response.Body)

	cookies := mergeCookies(
		cookiesFromURL,
		collectInterestingCookies(jar, loginURL, c.apiBaseURL, c.passportBaseURL, "https://www.bilibili.com"),
	)
	if !hasRequiredLoginCookies(cookies) {
		return nil, newRelayError("auth_sync_failed", "扫码材料没有产出有效会话 cookie，通常说明这次登录完成链接已经失效，请重新扫码一次", http.StatusBadGateway)
	}

	return cookies, nil
}

func collectInterestingCookies(jar *cookiejar.Jar, rawURLs ...string) map[string]string {
	collected := map[string]string{}

	for _, rawURL := range rawURLs {
		if strings.TrimSpace(rawURL) == "" {
			continue
		}

		parsed, err := url.Parse(rawURL)
		if err != nil {
			continue
		}

		for _, cookie := range jar.Cookies(parsed) {
			if interestingCookieNames[cookie.Name] && cookie.Value != "" {
				collected[cookie.Name] = cookie.Value
			}
		}
	}

	return collected
}

func extractLoginURLCookies(loginURL string) map[string]string {
	parsed, err := url.Parse(strings.TrimSpace(loginURL))
	if err != nil {
		return map[string]string{}
	}

	values := parsed.Query()
	cookies := map[string]string{}
	for name := range interestingCookieNames {
		if value := strings.TrimSpace(values.Get(name)); value != "" {
			cookies[name] = value
		}
	}
	return cookies
}

func hasRequiredLoginCookies(cookies map[string]string) bool {
	return strings.TrimSpace(cookies["SESSDATA"]) != "" && strings.TrimSpace(cookies["DedeUserID"]) != ""
}

func mergeCookies(groups ...map[string]string) map[string]string {
	merged := map[string]string{}
	for _, group := range groups {
		for name, value := range group {
			if trimmed := strings.TrimSpace(value); trimmed != "" {
				merged[name] = trimmed
			}
		}
	}
	return merged
}

func (c *BilibiliClient) FetchAccount(ctx context.Context, cookies map[string]string) (AccountSummary, error) {
	type navEnvelope struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    struct {
			Mid      int64  `json:"mid"`
			Uname    string `json:"uname"`
			VipLabel struct {
				Text string `json:"text"`
			} `json:"vip_label"`
		} `json:"data"`
	}

	type statEnvelope struct {
		Code    int      `json:"code"`
		Message string   `json:"message"`
		Data    struct{} `json:"data"`
	}

	var nav navEnvelope
	if err := c.getJSON(ctx, c.apiBaseURL+"/x/web-interface/nav", cookies, &nav); err != nil {
		return AccountSummary{}, err
	}
	if nav.Code != 0 || nav.Data.Mid <= 0 {
		if isAuthErrorCode(nav.Code) {
			return AccountSummary{}, newRelayError("auth_expired", "relay 当前登录态已失效", http.StatusConflict)
		}
		return AccountSummary{}, newRelayError("upstream_api_error", fmt.Sprintf("nav 接口失败：%s", nav.Message), http.StatusBadGateway)
	}

	var stat statEnvelope
	if err := c.getJSON(ctx, c.apiBaseURL+"/x/web-interface/nav/stat", cookies, &stat); err != nil {
		return AccountSummary{}, err
	}
	if stat.Code != 0 && isAuthErrorCode(stat.Code) {
		return AccountSummary{}, newRelayError("auth_expired", "relay 当前登录态已失效", http.StatusConflict)
	}

	return AccountSummary{
		Mid:      nav.Data.Mid,
		Uname:    nav.Data.Uname,
		Vip:      strings.TrimSpace(nav.Data.VipLabel.Text) != "",
		VipLabel: strings.TrimSpace(nav.Data.VipLabel.Text),
	}, nil
}

type RelayPlayurlMeta struct {
	Quality      int    `json:"quality"`
	Format       string `json:"format"`
	Host         string `json:"host,omitempty"`
	PlatformHint string `json:"platformHint,omitempty"`
	FormatHint   string `json:"formatHint,omitempty"`
}

type RelayPlayurlEnvelope struct {
	Ok      bool             `json:"ok"`
	Code    int              `json:"code"`
	Message string           `json:"message"`
	Data    json.RawMessage  `json:"data"`
	Relay   RelayPlayurlMeta `json:"relay"`
}

type RelayMutationEnvelope struct {
	Ok      bool `json:"ok"`
	Code    int  `json:"code"`
	Message string `json:"message"`
}

type RelayHeartbeatInput struct {
	Aid        int64
	Bvid       string
	Cid        int64
	PlayedTime int64
}

type RelayHistoryReportInput struct {
	Aid      int64
	Cid      int64
	Progress int64
}

func (c *BilibiliClient) FetchPlayURL(ctx context.Context, cookies map[string]string, rawQuery string) (RelayPlayurlEnvelope, error) {
	body, err := c.getBytes(ctx, c.apiBaseURL+"/x/player/playurl?"+rawQuery, cookies)
	if err != nil {
		return RelayPlayurlEnvelope{}, err
	}

	type upstreamEnvelope struct {
		Code    int             `json:"code"`
		Message string          `json:"message"`
		Data    json.RawMessage `json:"data"`
	}

	var upstream upstreamEnvelope
	if err := json.Unmarshal(body, &upstream); err != nil {
		return RelayPlayurlEnvelope{}, newRelayError("bad_payload", "relay 拿到的 playurl 数据不是合法 JSON", http.StatusBadGateway)
	}
	if upstream.Code != 0 {
		if isAuthErrorCode(upstream.Code) {
			return RelayPlayurlEnvelope{}, newRelayError("auth_expired", "relay 当前登录态已失效", http.StatusConflict)
		}
		return RelayPlayurlEnvelope{}, newRelayError("upstream_api_error", fmt.Sprintf("playurl 接口失败：%s", upstream.Message), http.StatusBadGateway)
	}

	meta := summarizePlayurl(upstream.Data)
	return RelayPlayurlEnvelope{
		Ok:      true,
		Code:    upstream.Code,
		Message: upstream.Message,
		Data:    upstream.Data,
		Relay:   meta,
	}, nil
}

func (c *BilibiliClient) ReportVideoHeartbeat(ctx context.Context, cookies map[string]string, input RelayHeartbeatInput) (RelayMutationEnvelope, error) {
	csrfToken, err := requireCSRFCookie(cookies)
	if err != nil {
		return RelayMutationEnvelope{}, err
	}

	form := url.Values{}
	if input.Aid > 0 {
		form.Set("aid", strconv.FormatInt(input.Aid, 10))
	}
	form.Set("bvid", strings.TrimSpace(input.Bvid))
	form.Set("cid", strconv.FormatInt(input.Cid, 10))
	form.Set("played_time", strconv.FormatInt(input.PlayedTime, 10))
	form.Set("csrf", csrfToken)

	body, err := c.postFormBytes(ctx, c.apiBaseURL+"/x/click-interface/web/heartbeat", cookies, form)
	if err != nil {
		return RelayMutationEnvelope{}, err
	}
	return parseRelayMutation(body, "heartbeat")
}

func (c *BilibiliClient) ReportHistoryProgress(ctx context.Context, cookies map[string]string, input RelayHistoryReportInput) (RelayMutationEnvelope, error) {
	csrfToken, err := requireCSRFCookie(cookies)
	if err != nil {
		return RelayMutationEnvelope{}, err
	}

	form := url.Values{}
	form.Set("aid", strconv.FormatInt(input.Aid, 10))
	form.Set("cid", strconv.FormatInt(input.Cid, 10))
	form.Set("progress", strconv.FormatInt(input.Progress, 10))
	form.Set("csrf", csrfToken)

	body, err := c.postFormBytes(ctx, c.apiBaseURL+"/x/v2/history/report", cookies, form)
	if err != nil {
		return RelayMutationEnvelope{}, err
	}
	return parseRelayMutation(body, "观看历史")
}

func summarizePlayurl(rawData json.RawMessage) RelayPlayurlMeta {
	type durlItem struct {
		URL string `json:"url"`
	}
	type dashStream struct {
		BaseURL string `json:"baseUrl"`
	}
	type playurlData struct {
		Quality int        `json:"quality"`
		Format  string     `json:"format"`
		DURL    []durlItem `json:"durl"`
		Dash    struct {
			Video []dashStream `json:"video"`
		} `json:"dash"`
	}

	var payload playurlData
	if err := json.Unmarshal(rawData, &payload); err != nil {
		return RelayPlayurlMeta{}
	}

	firstURL := ""
	if len(payload.DURL) > 0 {
		firstURL = payload.DURL[0].URL
	}
	if firstURL == "" && len(payload.Dash.Video) > 0 {
		firstURL = payload.Dash.Video[0].BaseURL
	}

	meta := RelayPlayurlMeta{
		Quality: payload.Quality,
		Format:  payload.Format,
	}
	if firstURL == "" {
		return meta
	}

	parsed, err := url.Parse(firstURL)
	if err != nil {
		return meta
	}

	meta.Host = parsed.Host
	query := parsed.Query()
	meta.PlatformHint = query.Get("platform")
	meta.FormatHint = query.Get("f")
	return meta
}

func (c *BilibiliClient) getJSON(ctx context.Context, requestURL string, cookies map[string]string, target any) error {
	body, err := c.getBytes(ctx, requestURL, cookies)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(body, target); err != nil {
		return newRelayError("bad_payload", "上游返回的 JSON 不合法", http.StatusBadGateway)
	}
	return nil
}

func (c *BilibiliClient) getBytes(ctx context.Context, requestURL string, cookies map[string]string) ([]byte, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, err
	}
	c.applyCommonHeaders(request, cookies)

	client := &http.Client{Timeout: c.timeout}
	response, err := client.Do(request)
	if err != nil {
		return nil, newRelayError("request_failed", fmt.Sprintf("请求上游失败：%v", err), http.StatusBadGateway)
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, newRelayError("request_failed", fmt.Sprintf("上游响应异常（%d）", response.StatusCode), http.StatusBadGateway)
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, newRelayError("request_failed", "读取上游响应失败", http.StatusBadGateway)
	}
	return body, nil
}

func (c *BilibiliClient) postFormBytes(ctx context.Context, requestURL string, cookies map[string]string, form url.Values) ([]byte, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, requestURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	c.applyCommonHeaders(request, cookies)
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")

	client := &http.Client{Timeout: c.timeout}
	response, err := client.Do(request)
	if err != nil {
		return nil, newRelayError("request_failed", fmt.Sprintf("请求上游失败：%v", err), http.StatusBadGateway)
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, newRelayError("request_failed", fmt.Sprintf("上游响应异常（%d）", response.StatusCode), http.StatusBadGateway)
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, newRelayError("request_failed", "读取上游响应失败", http.StatusBadGateway)
	}
	return body, nil
}

func (c *BilibiliClient) applyCommonHeaders(request *http.Request, cookies map[string]string) {
	request.Header.Set("User-Agent", c.userAgent)
	request.Header.Set("Accept", "application/json, text/plain, */*")
	request.Header.Set("Referer", "https://www.bilibili.com")
	request.Header.Set("Origin", "https://www.bilibili.com")
	if cookieHeader := buildCookieHeader(cookies); cookieHeader != "" {
		request.Header.Set("Cookie", cookieHeader)
	}
}

func parseRelayMutation(body []byte, action string) (RelayMutationEnvelope, error) {
	type upstreamEnvelope struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}

	var upstream upstreamEnvelope
	if err := json.Unmarshal(body, &upstream); err != nil {
		return RelayMutationEnvelope{}, newRelayError("bad_payload", "relay 拿到的历史写入响应不是合法 JSON", http.StatusBadGateway)
	}
	if upstream.Code != 0 {
		if isAuthErrorCode(upstream.Code) {
			return RelayMutationEnvelope{}, newRelayError("auth_expired", "relay 当前登录态已失效", http.StatusConflict)
		}
		return RelayMutationEnvelope{}, newRelayError("upstream_api_error", fmt.Sprintf("%s接口失败：%s", action, upstream.Message), http.StatusBadGateway)
	}

	return RelayMutationEnvelope{
		Ok:      true,
		Code:    upstream.Code,
		Message: upstream.Message,
	}, nil
}

func requireCSRFCookie(cookies map[string]string) (string, error) {
	csrfToken := strings.TrimSpace(cookies["bili_jct"])
	if csrfToken == "" {
		return "", newRelayError("auth_missing", "relay 当前登录态缺少 csrf，通常需要重新扫码同步一次", http.StatusConflict)
	}
	return csrfToken, nil
}

func buildCookieHeader(cookies map[string]string) string {
	parts := make([]string, 0, len(cookies))
	for _, name := range []string{"SESSDATA", "bili_jct", "DedeUserID", "DedeUserID__ckMd5", "buvid3", "buvid4"} {
		value := strings.TrimSpace(cookies[name])
		if value != "" {
			parts = append(parts, fmt.Sprintf("%s=%s", name, value))
		}
	}
	return strings.Join(parts, "; ")
}

func isAuthErrorCode(code int) bool {
	return code == -101 || code == -111
}

func asRelayError(err error) *relayError {
	if err == nil {
		return nil
	}
	var target *relayError
	if errors.As(err, &target) {
		return target
	}
	return &relayError{
		Kind:       "request_failed",
		Message:    err.Error(),
		StatusCode: http.StatusBadGateway,
	}
}
