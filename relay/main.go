package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	logger := log.New(os.Stdout, "[relay] ", log.LstdFlags|log.Lmsgprefix)

	config, err := loadConfig()
	if err != nil {
		logger.Fatal(err)
	}

	store, err := NewStateStore(config.StateDir)
	if err != nil {
		logger.Fatal(err)
	}

	server := NewServer(&config, store, NewBilibiliClient(config), logger)
	logger.Printf("listening on http://%s", serverAddress(config))
	if err := http.ListenAndServe(serverAddress(config), server.routes()); err != nil {
		logger.Fatal(err)
	}
}
