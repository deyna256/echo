package api

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/auth"
	"github.com/lbc/echo/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

type userStore interface {
	Create(ctx context.Context, email, passwordHash string) (domain.User, error)
	GetByEmail(ctx context.Context, email string) (domain.User, error)
	GetByID(ctx context.Context, id string) (domain.User, error)
}

type AuthHandler struct {
	store      userStore
	jwtSecret  string
	ttl        time.Duration
	refreshTTL time.Duration
	log        *slog.Logger
}

func NewAuthHandler(store userStore, jwtSecret string, ttl time.Duration, refreshTTL time.Duration, log *slog.Logger) *AuthHandler {
	return &AuthHandler{store: store, jwtSecret: jwtSecret, ttl: ttl, refreshTTL: refreshTTL, log: log}
}

type authRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type authResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if req.Email == "" || req.Password == "" {
		http.Error(w, "email and password required", http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		h.log.ErrorContext(r.Context(), "bcrypt hash", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	user, err := h.store.Create(r.Context(), req.Email, string(hash))
	if err != nil {
		h.log.ErrorContext(r.Context(), "create user", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	token, err := auth.Sign(user.ID, h.jwtSecret, h.ttl)
	if err != nil {
		h.log.ErrorContext(r.Context(), "sign token", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	refreshToken, err := auth.SignRefresh(user.ID, h.jwtSecret, h.refreshTTL)
	if err != nil {
		h.log.ErrorContext(r.Context(), "sign refresh token", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(authResponse{Token: token, RefreshToken: refreshToken})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	user, err := h.store.GetByEmail(r.Context(), req.Email)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			http.Error(w, "invalid credentials", http.StatusUnauthorized)
			return
		}
		h.log.ErrorContext(r.Context(), "get user by email", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	token, err := auth.Sign(user.ID, h.jwtSecret, h.ttl)
	if err != nil {
		h.log.ErrorContext(r.Context(), "sign token", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	refreshToken, err := auth.SignRefresh(user.ID, h.jwtSecret, h.refreshTTL)
	if err != nil {
		h.log.ErrorContext(r.Context(), "sign refresh token", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(authResponse{Token: token, RefreshToken: refreshToken})
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	if req.RefreshToken == "" {
		http.Error(w, "refresh token required", http.StatusBadRequest)
		return
	}

	userID, err := auth.VerifyRefresh(req.RefreshToken, h.jwtSecret)
	if err != nil {
		h.log.ErrorContext(r.Context(), "verify refresh token", slog.String("error", err.Error()))
		http.Error(w, "invalid refresh token", http.StatusUnauthorized)
		return
	}

	if _, err := h.store.GetByID(r.Context(), userID.String()); err != nil {
		http.Error(w, "invalid refresh token", http.StatusUnauthorized)
		return
	}

	token, err := auth.Sign(userID, h.jwtSecret, h.ttl)
	if err != nil {
		h.log.ErrorContext(r.Context(), "sign token", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	refreshToken, err := auth.SignRefresh(userID, h.jwtSecret, h.refreshTTL)
	if err != nil {
		h.log.ErrorContext(r.Context(), "sign refresh token", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(authResponse{Token: token, RefreshToken: refreshToken})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(userIDKey).(uuid.UUID)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	user, err := h.store.GetByID(r.Context(), userID.String())
	if err != nil {
		h.log.ErrorContext(r.Context(), "get user by id", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":         user.ID,
		"email":      user.Email,
		"created_at": user.CreatedAt,
	})
}
