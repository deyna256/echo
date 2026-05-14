package auth_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/auth"
)

func TestSign_Verify_roundtrip(t *testing.T) {
	userID := uuid.New()
	secret := "test-secret"

	token, err := auth.Sign(userID, secret, time.Hour)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	if token == "" {
		t.Fatal("token must not be empty")
	}

	got, err := auth.Verify(token, secret)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if got != userID {
		t.Errorf("userID = %v, want %v", got, userID)
	}
}

func TestVerify_expiredToken_returnsError(t *testing.T) {
	userID := uuid.New()
	token, err := auth.Sign(userID, "secret", -time.Second)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}

	_, err = auth.Verify(token, "secret")
	if err == nil {
		t.Fatal("expected error for expired token, got nil")
	}
}

func TestVerify_wrongSecret_returnsError(t *testing.T) {
	userID := uuid.New()
	token, err := auth.Sign(userID, "correct-secret", time.Hour)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}

	_, err = auth.Verify(token, "wrong-secret")
	if err == nil {
		t.Fatal("expected error for wrong secret, got nil")
	}
}
