package config

import (
	"log"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Addr            string
	DatabaseURL     string
	JWTSecret       string
	MinimaxAPIKey   string
	MinimaxBaseURL  string
	JWTTokenTTL     time.Duration
	JWTRefreshTTL   time.Duration
	PollIntervalSec int
}

func FromEnv() Config {
	return Config{
		Addr:            ":8000",
		DatabaseURL:     mustEnv("DATABASE_URL"),
		JWTSecret:       mustEnv("JWT_SECRET"),
		MinimaxAPIKey:   mustEnv("MINIMAX_API_KEY"),
		MinimaxBaseURL:  env("MINIMAX_BASE_URL", "https://api.minimax.chat/v1/text/chatcompletion_pro"),
		JWTTokenTTL:     15 * time.Minute,
		JWTRefreshTTL:   7 * 24 * time.Hour,
		PollIntervalSec: envInt("POLL_INTERVAL_SEC", 30),
	}
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required env variable %q is not set", key)
	}
	return v
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		log.Fatalf("env variable %q must be an integer, got %q", key, v)
	}
	return n
}
