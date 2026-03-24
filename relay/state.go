package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type AccountSummary struct {
	Mid      int64  `json:"mid"`
	Uname    string `json:"uname"`
	Vip      bool   `json:"vip"`
	VipLabel string `json:"vipLabel,omitempty"`
}

type SyncMaterial struct {
	LoginURL     string `json:"loginUrl"`
	RefreshToken string `json:"refreshToken,omitempty"`
	CompletedAt  int64  `json:"completedAt"`
}

type RelayState struct {
	Account      AccountSummary    `json:"account"`
	Cookies      map[string]string `json:"cookies"`
	SyncMaterial SyncMaterial      `json:"syncMaterial"`
	LastSyncedAt int64             `json:"lastSyncedAt"`
}

type StateStore struct {
	path  string
	state RelayState
	mu    sync.RWMutex
}

func NewStateStore(dir string) (*StateStore, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}

	store := &StateStore{
		path: filepath.Join(dir, "relay-state.json"),
		state: RelayState{
			Cookies: map[string]string{},
		},
	}

	content, err := os.ReadFile(store.path)
	if err != nil {
		if os.IsNotExist(err) {
			return store, nil
		}
		return nil, err
	}

	var persisted RelayState
	if err := json.Unmarshal(content, &persisted); err != nil {
		return nil, err
	}
	if persisted.Cookies == nil {
		persisted.Cookies = map[string]string{}
	}
	store.state = persisted
	return store, nil
}

func (s *StateStore) Snapshot() RelayState {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return cloneState(s.state)
}

func (s *StateStore) Replace(next RelayState) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if next.Cookies == nil {
		next.Cookies = map[string]string{}
	}
	s.state = cloneState(next)
	return s.persistLocked()
}

func (s *StateStore) Update(mutator func(current RelayState) RelayState) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.state = cloneState(mutator(cloneState(s.state)))
	if s.state.Cookies == nil {
		s.state.Cookies = map[string]string{}
	}
	return s.persistLocked()
}

func (s *StateStore) Clear() error {
	return s.Replace(RelayState{
		Cookies: map[string]string{},
	})
}

func (s *StateStore) persistLocked() error {
	content, err := json.MarshalIndent(s.state, "", "  ")
	if err != nil {
		return err
	}

	tmpPath := s.path + ".tmp"
	if err := os.WriteFile(tmpPath, content, 0o600); err != nil {
		return err
	}

	return os.Rename(tmpPath, s.path)
}

func cloneState(input RelayState) RelayState {
	copied := input
	copied.Cookies = map[string]string{}
	for key, value := range input.Cookies {
		copied.Cookies[key] = value
	}
	return copied
}

func nowUnixMilli() int64 {
	return time.Now().UnixMilli()
}
