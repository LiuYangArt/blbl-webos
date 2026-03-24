package main

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Host            string
	Port            int
	AccessToken     string
	StateDir        string
	RequestTimeout  time.Duration
	UserAgent       string
	BiliAPIBaseURL  string
	BiliPassportURL string
}

func loadConfig() (Config, error) {
	cfg := Config{
		Host:            readEnv("RELAY_HOST", "0.0.0.0"),
		Port:            readEnvInt("RELAY_PORT", 19091),
		AccessToken:     strings.TrimSpace(os.Getenv("RELAY_ACCESS_TOKEN")),
		StateDir:        readEnv("RELAY_STATE_DIR", "/data"),
		RequestTimeout:  time.Duration(readEnvInt("RELAY_REQUEST_TIMEOUT_MS", 7000)) * time.Millisecond,
		UserAgent:       readEnv("RELAY_USER_AGENT", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"),
		BiliAPIBaseURL:  readEnv("RELAY_BILI_API_BASE_URL", "https://api.bilibili.com"),
		BiliPassportURL: readEnv("RELAY_BILI_PASSPORT_BASE_URL", "https://passport.bilibili.com"),
	}

	return cfg, nil
}

func readEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func readEnvInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}
