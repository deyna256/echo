package api

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/domain"
)

type NotificationStore interface {
	ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.Notification, error)
	MarkRead(ctx context.Context, userID, id uuid.UUID) error
}

type NotificationsHandler struct {
	store     NotificationStore
	jwtSecret string
	log       *slog.Logger
	mux       *http.ServeMux
}

func NewNotificationsHandler(store NotificationStore, jwtSecret string, log *slog.Logger) *NotificationsHandler {
	h := &NotificationsHandler{
		store:     store,
		jwtSecret: jwtSecret,
		log:       log,
		mux:       http.NewServeMux(),
	}
	protected := func(fn http.HandlerFunc) http.Handler { return jwtMiddleware(jwtSecret, fn) }
	h.mux.Handle("GET /notifications", protected(h.list))
	h.mux.Handle("POST /notifications/{id}/read", protected(h.markRead))
	return h
}

func (h *NotificationsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.mux.ServeHTTP(w, r)
}

type notificationResponse struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	EntityID  string `json:"entity_id"`
	Title     string `json:"title"`
	DueDate   string `json:"due_date,omitempty"`
	ReadAt    string `json:"read_at,omitempty"`
	CreatedAt string `json:"created_at"`
}

func (h *NotificationsHandler) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	notifications, err := h.store.ListByUser(r.Context(), userID)
	if err != nil {
		h.log.ErrorContext(r.Context(), "list notifications", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if notifications == nil {
		notifications = []domain.Notification{}
	}
	resp := make([]notificationResponse, len(notifications))
	for i, n := range notifications {
		var payload map[string]any
		json.Unmarshal(n.Payload, &payload)
		entityID, _ := payload["entity_id"].(string)
		title, _ := payload["title"].(string)
		dueDate, _ := payload["due_date"].(string)

		var readAt string
		if n.ReadAt != nil {
			readAt = n.ReadAt.Format(time.RFC3339)
		}

		resp[i] = notificationResponse{
			ID:        n.ID.String(),
			Type:      string(n.Type),
			EntityID:  entityID,
			Title:     title,
			DueDate:   dueDate,
			ReadAt:    readAt,
			CreatedAt: n.CreatedAt.Format(time.RFC3339),
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *NotificationsHandler) markRead(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	if err := h.store.MarkRead(r.Context(), userID, id); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		h.log.ErrorContext(r.Context(), "mark read", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
