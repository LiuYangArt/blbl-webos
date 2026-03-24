package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
)

type Server struct {
	config *Config
	store  *StateStore
	bili   *BilibiliClient
	logger *log.Logger
}

func NewServer(cfg *Config, store *StateStore, bili *BilibiliClient, logger *log.Logger) *Server {
	return &Server{
		config: cfg,
		store:  store,
		bili:   bili,
		logger: logger,
	}
}

func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/api/auth/status", s.withAuth(s.handleAuthStatus))
	mux.HandleFunc("/api/auth/sync", s.withAuth(s.handleAuthSync))
	mux.HandleFunc("/api/auth/logout", s.withAuth(s.handleAuthLogout))
	mux.HandleFunc("/api/playurl", s.withAuth(s.handlePlayurl))
	mux.HandleFunc("/media", s.handleMediaProxy)
	return mux
}

func (s *Server) withAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		if !s.isAuthorized(request) {
			s.writeJSON(writer, http.StatusUnauthorized, map[string]any{
				"ok":    false,
				"error": "unauthorized",
			})
			return
		}
		next(writer, request)
	}
}

func (s *Server) handleHealth(writer http.ResponseWriter, _ *http.Request) {
	state := s.store.Snapshot()
	s.writeJSON(writer, http.StatusOK, map[string]any{
		"ok":       true,
		"service":  "bilibili-playurl-relay",
		"loggedIn": len(state.Cookies) > 0,
	})
}

func (s *Server) handleAuthStatus(writer http.ResponseWriter, request *http.Request) {
	state := s.store.Snapshot()
	if len(state.Cookies) == 0 {
		s.writeJSON(writer, http.StatusOK, map[string]any{
			"ok":            true,
			"loggedIn":      false,
			"cookieExpired": false,
			"lastSyncedAt":  state.LastSyncedAt,
		})
		return
	}

	account := state.Account
	cookieExpired := false
	liveAccount, err := s.bili.FetchAccount(request.Context(), state.Cookies)
	if err == nil {
		account = liveAccount
		_ = s.store.Update(func(current RelayState) RelayState {
			current.Account = liveAccount
			return current
		})
	} else {
		relayErr := asRelayError(err)
		cookieExpired = relayErr.Kind == "auth_expired"
	}

	s.writeJSON(writer, http.StatusOK, map[string]any{
		"ok":            true,
		"loggedIn":      account.Mid > 0,
		"mid":           account.Mid,
		"uname":         account.Uname,
		"vip":           account.Vip,
		"vipLabel":      account.VipLabel,
		"cookieExpired": cookieExpired,
		"lastSyncedAt":  state.LastSyncedAt,
	})
}

func (s *Server) handleAuthSync(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		s.writeJSON(writer, http.StatusMethodNotAllowed, map[string]any{"ok": false, "error": "method_not_allowed"})
		return
	}

	var payload struct {
		LoginURL      string `json:"loginUrl"`
		RefreshToken  string `json:"refreshToken"`
		CompletedAt   int64  `json:"completedAt"`
		ExpectedMid   int64  `json:"expectedMid"`
		ExpectedUname string `json:"expectedUname"`
		ExpectedVip   bool   `json:"expectedVip"`
	}

	if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
		s.writeJSON(writer, http.StatusBadRequest, map[string]any{"ok": false, "error": "bad_request", "message": "请求体不是合法 JSON"})
		return
	}
	if strings.TrimSpace(payload.LoginURL) == "" {
		s.writeJSON(writer, http.StatusBadRequest, map[string]any{"ok": false, "error": "bad_request", "message": "loginUrl 不能为空"})
		return
	}

	cookies, err := s.bili.CompleteWebLogin(request.Context(), payload.LoginURL)
	if err != nil {
		s.writeRelayError(writer, err)
		return
	}

	account, err := s.bili.FetchAccount(request.Context(), cookies)
	if err != nil {
		s.writeRelayError(writer, err)
		return
	}
	if payload.ExpectedMid > 0 && account.Mid != payload.ExpectedMid {
		s.writeJSON(writer, http.StatusConflict, map[string]any{
			"ok":          false,
			"error":       "auth_mismatch",
			"message":     "relay 拿到的账号与 TV 当前账号不一致",
			"expectedMid": payload.ExpectedMid,
			"relayMid":    account.Mid,
		})
		return
	}

	syncedAt := nowUnixMilli()
	if err := s.store.Replace(RelayState{
		Account:      account,
		Cookies:      cookies,
		LastSyncedAt: syncedAt,
		SyncMaterial: SyncMaterial{
			LoginURL:     payload.LoginURL,
			RefreshToken: payload.RefreshToken,
			CompletedAt:  payload.CompletedAt,
		},
	}); err != nil {
		s.writeJSON(writer, http.StatusInternalServerError, map[string]any{"ok": false, "error": "persist_failed"})
		return
	}

	s.writeJSON(writer, http.StatusOK, map[string]any{
		"ok":            true,
		"loggedIn":      true,
		"mid":           account.Mid,
		"uname":         account.Uname,
		"vip":           account.Vip,
		"vipLabel":      account.VipLabel,
		"cookieExpired": false,
		"lastSyncedAt":  syncedAt,
	})
}

func (s *Server) handleAuthLogout(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		s.writeJSON(writer, http.StatusMethodNotAllowed, map[string]any{"ok": false, "error": "method_not_allowed"})
		return
	}

	if err := s.store.Clear(); err != nil {
		s.writeJSON(writer, http.StatusInternalServerError, map[string]any{"ok": false, "error": "persist_failed"})
		return
	}

	s.writeJSON(writer, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handlePlayurl(writer http.ResponseWriter, request *http.Request) {
	state := s.store.Snapshot()
	if len(state.Cookies) == 0 {
		s.writeJSON(writer, http.StatusConflict, map[string]any{
			"ok":      false,
			"error":   "auth_missing",
			"message": "relay 还没有当前账号会话",
		})
		return
	}

	query := request.URL.Query()
	for _, key := range []string{"bvid", "cid", "qn", "fnval", "fnver", "fourk", "otype"} {
		if strings.TrimSpace(query.Get(key)) == "" {
			s.writeJSON(writer, http.StatusBadRequest, map[string]any{
				"ok":      false,
				"error":   "bad_request",
				"message": fmt.Sprintf("%s 不能为空", key),
			})
			return
		}
	}

	response, err := s.bili.FetchPlayURL(request.Context(), state.Cookies, request.URL.RawQuery)
	if err != nil {
		s.writeRelayError(writer, err)
		return
	}

	s.writeJSON(writer, http.StatusOK, response)
}

func (s *Server) writeRelayError(writer http.ResponseWriter, err error) {
	relayErr := asRelayError(err)
	statusCode := relayErr.StatusCode
	if statusCode == 0 {
		statusCode = http.StatusBadGateway
	}

	s.writeJSON(writer, statusCode, map[string]any{
		"ok":      false,
		"error":   relayErr.Kind,
		"message": relayErr.Message,
	})
}

func (s *Server) writeJSON(writer http.ResponseWriter, statusCode int, payload any) {
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.WriteHeader(statusCode)
	if err := json.NewEncoder(writer).Encode(payload); err != nil {
		s.logger.Printf("write json failed: %v", err)
	}
}

func (s *Server) isAuthorized(request *http.Request) bool {
	if strings.TrimSpace(s.config.AccessToken) == "" {
		return true
	}

	token := strings.TrimSpace(request.Header.Get("X-Relay-Token"))
	if token == "" {
		token = strings.TrimSpace(strings.TrimPrefix(request.Header.Get("Authorization"), "Bearer "))
	}
	if token == "" {
		token = strings.TrimSpace(request.URL.Query().Get("token"))
	}
	return token == s.config.AccessToken
}

func serverAddress(cfg Config) string {
	return cfg.Host + ":" + strconv.Itoa(cfg.Port)
}
