package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/api"
	"github.com/lbc/echo/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

type stubUserStore struct {
	users map[string]domain.User
}

func newStubUserStore() *stubUserStore {
	return &stubUserStore{users: map[string]domain.User{}}
}

func (s *stubUserStore) Create(ctx context.Context, email, passwordHash string) (domain.User, error) {
	if _, exists := s.users[email]; exists {
		return domain.User{}, fmt.Errorf("duplicate email")
	}
	u := domain.User{ID: uuid.New(), Email: email, PasswordHash: passwordHash}
	s.users[email] = u
	return u, nil
}

func (s *stubUserStore) GetByEmail(ctx context.Context, email string) (domain.User, error) {
	u, ok := s.users[email]
	if !ok {
		return domain.User{}, fmt.Errorf("get user by email: %w", domain.ErrNotFound)
	}
	return u, nil
}

func (s *stubUserStore) GetByID(ctx context.Context, id string) (domain.User, error) {
	for _, u := range s.users {
		if u.ID.String() == id {
			return u, nil
		}
	}
	return domain.User{}, fmt.Errorf("get user by id: %w", domain.ErrNotFound)
}

const testSecret = "test-jwt-secret"

func TestAuthHandler_Register_createsUser(t *testing.T) {
	store := newStubUserStore()
	h := api.NewAuthHandler(store, testSecret, time.Hour, 7*24*time.Hour, slog.Default())

	body, _ := json.Marshal(map[string]string{"email": "a@b.com", "password": "secret123"})
	req := httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.Register(rr, req)

	if rr.Code != http.StatusCreated {
		t.Errorf("status = %d, want %d; body: %s", rr.Code, http.StatusCreated, rr.Body.String())
	}

	var resp map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp["token"] == "" {
		t.Error("token must not be empty")
	}
}

func TestAuthHandler_Login_returnsToken(t *testing.T) {
	store := newStubUserStore()
	h := api.NewAuthHandler(store, testSecret, time.Hour, 7*24*time.Hour, slog.Default())

	hash, _ := bcrypt.GenerateFromPassword([]byte("mypassword"), bcrypt.DefaultCost)
	store.users["user@example.com"] = domain.User{
		ID: uuid.New(), Email: "user@example.com", PasswordHash: string(hash),
	}

	body, _ := json.Marshal(map[string]string{"email": "user@example.com", "password": "mypassword"})
	req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.Login(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("status = %d, want %d; body: %s", rr.Code, http.StatusOK, rr.Body.String())
	}
	var resp map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp["token"] == "" {
		t.Error("token must not be empty")
	}
}

func TestAuthHandler_Login_wrongPassword_returns401(t *testing.T) {
	store := newStubUserStore()
	h := api.NewAuthHandler(store, testSecret, time.Hour, 7*24*time.Hour, slog.Default())

	hash, _ := bcrypt.GenerateFromPassword([]byte("correct"), bcrypt.DefaultCost)
	store.users["u@x.com"] = domain.User{ID: uuid.New(), Email: "u@x.com", PasswordHash: string(hash)}

	body, _ := json.Marshal(map[string]string{"email": "u@x.com", "password": "wrong"})
	req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.Login(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}
}
