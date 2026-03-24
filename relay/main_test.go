package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestRelaySyncStatusAndPlayurl(t *testing.T) {
	t.Helper()

	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/login-complete":
			http.SetCookie(writer, &http.Cookie{Name: "SESSDATA", Value: "sess-value", Path: "/"})
			http.SetCookie(writer, &http.Cookie{Name: "DedeUserID", Value: "123456", Path: "/"})
			http.SetCookie(writer, &http.Cookie{Name: "bili_jct", Value: "csrf-value", Path: "/"})
			writer.WriteHeader(http.StatusOK)
		case "/x/web-interface/nav":
			if !strings.Contains(request.Header.Get("Cookie"), "SESSDATA=sess-value") {
				http.Error(writer, `{"code":-101,"message":"账号未登录"}`, http.StatusOK)
				return
			}
			_, _ = writer.Write([]byte(`{"code":0,"message":"0","data":{"mid":123456,"uname":"测试用户","vip_label":{"text":"大会员"}}}`))
		case "/x/web-interface/nav/stat":
			_, _ = writer.Write([]byte(`{"code":0,"message":"0","data":{}}`))
		case "/x/player/playurl":
			if !strings.Contains(request.Header.Get("Cookie"), "SESSDATA=sess-value") {
				http.Error(writer, `{"code":-101,"message":"账号未登录"}`, http.StatusOK)
				return
			}
			_, _ = writer.Write([]byte(`{"code":0,"message":"0","data":{"quality":80,"format":"flv","durl":[{"url":"https://upos-sz-mirrorbilivideo.bilivideo.com/video.mp4?platform=pc&f=u_0_0"}]}}`))
		default:
			http.NotFound(writer, request)
		}
	}))
	defer upstream.Close()

	stateDir := t.TempDir()
	config := Config{
		Host:            "127.0.0.1",
		Port:            0,
		AccessToken:     "test-token",
		StateDir:        stateDir,
		RequestTimeout:  2 * time.Second,
		UserAgent:       "relay-test",
		BiliAPIBaseURL:  upstream.URL,
		BiliPassportURL: upstream.URL,
	}

	store, err := NewStateStore(stateDir)
	if err != nil {
		t.Fatal(err)
	}

	server := NewServer(&config, store, NewBilibiliClient(config), log.New(io.Discard, "", 0))
	app := httptest.NewServer(server.routes())
	defer app.Close()

	syncBody := map[string]any{
		"loginUrl":    upstream.URL + "/login-complete",
		"completedAt": time.Now().UnixMilli(),
		"expectedMid": 123456,
	}

	syncResponse := doJSONRequest(t, app.URL+"/api/auth/sync", config.AccessToken, syncBody)
	if syncResponse.StatusCode != http.StatusOK {
		t.Fatalf("sync failed: %s", syncResponse.Body)
	}

	statusResponse := doJSONRequest(t, app.URL+"/api/auth/status", config.AccessToken, nil)
	if statusResponse.StatusCode != http.StatusOK {
		t.Fatalf("status failed: %s", statusResponse.Body)
	}
	if !strings.Contains(statusResponse.Body, `"mid":123456`) {
		t.Fatalf("unexpected status body: %s", statusResponse.Body)
	}

	playurlRequest, err := http.NewRequest(http.MethodGet, app.URL+"/api/playurl?bvid=BV1xx411c7mD&cid=12345&qn=80&fnval=0&fnver=0&fourk=1&otype=json", nil)
	if err != nil {
		t.Fatal(err)
	}
	playurlRequest.Header.Set("X-Relay-Token", config.AccessToken)

	playurlResponse, err := http.DefaultClient.Do(playurlRequest)
	if err != nil {
		t.Fatal(err)
	}
	defer playurlResponse.Body.Close()
	body, _ := io.ReadAll(playurlResponse.Body)
	if playurlResponse.StatusCode != http.StatusOK {
		t.Fatalf("playurl failed: %s", string(body))
	}
	if !strings.Contains(string(body), `"quality":80`) || !strings.Contains(string(body), `"host":"upos-sz-mirrorbilivideo.bilivideo.com"`) {
		t.Fatalf("unexpected playurl body: %s", string(body))
	}

	persistedBytes, err := os.ReadFile(filepath.Join(stateDir, "relay-state.json"))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(persistedBytes, []byte(`"SESSDATA": "sess-value"`)) {
		t.Fatalf("state file missing cookies: %s", string(persistedBytes))
	}
}

func TestRelaySyncAcceptsCookiesEmbeddedInLoginURL(t *testing.T) {
	t.Helper()

	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/x/web-interface/nav":
			cookieHeader := request.Header.Get("Cookie")
			if !strings.Contains(cookieHeader, "SESSDATA=query-sess") || !strings.Contains(cookieHeader, "DedeUserID=654321") {
				http.Error(writer, `{"code":-101,"message":"账号未登录"}`, http.StatusOK)
				return
			}
			_, _ = writer.Write([]byte(`{"code":0,"message":"0","data":{"mid":654321,"uname":"Query 用户","vip_label":{"text":""}}}`))
		case "/x/web-interface/nav/stat":
			_, _ = writer.Write([]byte(`{"code":0,"message":"0","data":{}}`))
		default:
			http.NotFound(writer, request)
		}
	}))
	defer upstream.Close()

	stateDir := t.TempDir()
	config := Config{
		Host:            "127.0.0.1",
		Port:            0,
		StateDir:        stateDir,
		RequestTimeout:  2 * time.Second,
		UserAgent:       "relay-test",
		BiliAPIBaseURL:  upstream.URL,
		BiliPassportURL: upstream.URL,
	}

	store, err := NewStateStore(stateDir)
	if err != nil {
		t.Fatal(err)
	}

	server := NewServer(&config, store, NewBilibiliClient(config), log.New(io.Discard, "", 0))
	app := httptest.NewServer(server.routes())
	defer app.Close()

	syncBody := map[string]any{
		"loginUrl":    upstream.URL + "/x/passport-login/web/crossDomain?SESSDATA=query-sess&DedeUserID=654321&bili_jct=query-csrf&DedeUserID__ckMd5=query-md5",
		"completedAt": time.Now().UnixMilli(),
		"expectedMid": 654321,
	}

	syncResponse := doJSONRequest(t, app.URL+"/api/auth/sync", "", syncBody)
	if syncResponse.StatusCode != http.StatusOK {
		t.Fatalf("sync failed: %s", syncResponse.Body)
	}

	statusResponse := doJSONRequest(t, app.URL+"/api/auth/status", "", nil)
	if statusResponse.StatusCode != http.StatusOK {
		t.Fatalf("status failed: %s", statusResponse.Body)
	}
	if !strings.Contains(statusResponse.Body, `"mid":654321`) {
		t.Fatalf("unexpected status body: %s", statusResponse.Body)
	}

	persistedBytes, err := os.ReadFile(filepath.Join(stateDir, "relay-state.json"))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(persistedBytes, []byte(`"SESSDATA": "query-sess"`)) {
		t.Fatalf("state file missing query cookies: %s", string(persistedBytes))
	}
}

func TestRelayRequiresToken(t *testing.T) {
	config := Config{
		AccessToken:     "token",
		RequestTimeout:  time.Second,
		UserAgent:       "relay-test",
		BiliAPIBaseURL:  "https://example.com",
		BiliPassportURL: "https://example.com",
	}

	store, err := NewStateStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	server := NewServer(&config, store, NewBilibiliClient(config), log.New(io.Discard, "", 0))
	app := httptest.NewServer(server.routes())
	defer app.Close()

	response, err := http.Get(app.URL + "/api/auth/status")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", response.StatusCode)
	}
}

func TestRelayAllowsRequestsWithoutTokenWhenAccessTokenIsEmpty(t *testing.T) {
	config := Config{
		AccessToken:     "",
		RequestTimeout:  time.Second,
		UserAgent:       "relay-test",
		BiliAPIBaseURL:  "https://example.com",
		BiliPassportURL: "https://example.com",
	}

	store, err := NewStateStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	server := NewServer(&config, store, NewBilibiliClient(config), log.New(io.Discard, "", 0))
	app := httptest.NewServer(server.routes())
	defer app.Close()

	response, err := http.Get(app.URL + "/api/auth/status")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", response.StatusCode)
	}
}

func TestRelayMediaProxyForwardsHeadersAndCookies(t *testing.T) {
	t.Helper()

	var seenReferer string
	var seenOrigin string
	var seenUserAgent string
	var seenCookie string
	var seenRange string

	upstream := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		seenReferer = request.Header.Get("Referer")
		seenOrigin = request.Header.Get("Origin")
		seenUserAgent = request.Header.Get("User-Agent")
		seenCookie = request.Header.Get("Cookie")
		seenRange = request.Header.Get("Range")

		writer.Header().Set("Accept-Ranges", "bytes")
		writer.Header().Set("Content-Type", "video/mp4")
		writer.Header().Set("Content-Range", "bytes 0-3/4")
		writer.WriteHeader(http.StatusPartialContent)
		_, _ = writer.Write([]byte("test"))
	}))
	defer upstream.Close()

	stateDir := t.TempDir()
	config := Config{
		Host:            "127.0.0.1",
		Port:            0,
		AccessToken:     "token",
		StateDir:        stateDir,
		RequestTimeout:  2 * time.Second,
		UserAgent:       "relay-test",
		BiliAPIBaseURL:  upstream.URL,
		BiliPassportURL: upstream.URL,
	}

	store, err := NewStateStore(stateDir)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Replace(RelayState{
		Cookies: map[string]string{
			"SESSDATA":   "sess-value",
			"DedeUserID": "123456",
		},
	}); err != nil {
		t.Fatal(err)
	}

	server := NewServer(&config, store, NewBilibiliClient(config), log.New(io.Discard, "", 0))
	app := httptest.NewServer(server.routes())
	defer app.Close()

	targetURL, err := url.Parse(upstream.URL + "/video.mp4?platform=pc&f=u_0_0")
	if err != nil {
		t.Fatal(err)
	}
	requestURL := app.URL + "/media?token=token&url=" + url.QueryEscape(targetURL.String())
	request, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Range", "bytes=0-3")

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)

	if response.StatusCode != http.StatusPartialContent {
		t.Fatalf("expected 206, got %d: %s", response.StatusCode, string(body))
	}
	if string(body) != "test" {
		t.Fatalf("unexpected body: %s", string(body))
	}
	if seenReferer != "https://www.bilibili.com/" {
		t.Fatalf("unexpected referer: %s", seenReferer)
	}
	if seenOrigin != "https://www.bilibili.com" {
		t.Fatalf("unexpected origin: %s", seenOrigin)
	}
	if seenUserAgent != "relay-test" {
		t.Fatalf("unexpected user agent: %s", seenUserAgent)
	}
	if !strings.Contains(seenCookie, "SESSDATA=sess-value") || !strings.Contains(seenCookie, "DedeUserID=123456") {
		t.Fatalf("unexpected cookie header: %s", seenCookie)
	}
	if seenRange != "bytes=0-3" {
		t.Fatalf("unexpected range header: %s", seenRange)
	}
	if response.Header.Get("Access-Control-Allow-Origin") != "*" {
		t.Fatalf("missing cors header: %+v", response.Header)
	}
}

type httpResult struct {
	StatusCode int
	Body       string
}

func doJSONRequest(t *testing.T, requestURL string, token string, payload any) httpResult {
	t.Helper()

	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		body = bytes.NewReader(encoded)
	}

	method := http.MethodGet
	if payload != nil {
		method = http.MethodPost
	}

	request, err := http.NewRequest(method, requestURL, body)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("X-Relay-Token", token)
	if payload != nil {
		request.Header.Set("Content-Type", "application/json")
	}

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()

	content, _ := io.ReadAll(response.Body)
	return httpResult{
		StatusCode: response.StatusCode,
		Body:       string(content),
	}
}
