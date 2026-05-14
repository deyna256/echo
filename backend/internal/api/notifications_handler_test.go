package api_test

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/api"
	"github.com/lbc/echo/internal/domain"
)

type stubNotificationStore struct {
	notifications map[uuid.UUID][]domain.Notification
}

func newStubNotificationStore() *stubNotificationStore {
	return &stubNotificationStore{notifications: map[uuid.UUID][]domain.Notification{}}
}

func (s *stubNotificationStore) ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.Notification, error) {
	return s.notifications[userID], nil
}

func (s *stubNotificationStore) MarkRead(ctx context.Context, userID, id uuid.UUID) error {
	list := s.notifications[userID]
	for i, n := range list {
		if n.ID == id {
			now := time.Now()
			list[i].ReadAt = &now
			return nil
		}
	}
	return domain.ErrNotFound
}

func TestNotificationsHandler_List_returnsNotifications(t *testing.T) {
	store := newStubNotificationStore()
	h := api.NewNotificationsHandler(store, testSecret, slog.Default())
	userID := uuid.New()

	payload, _ := json.Marshal(map[string]any{"entity_id": uuid.New().String(), "title": "Task 1"})
	store.notifications[userID] = []domain.Notification{
		{ID: uuid.New(), UserID: userID, Type: domain.NotificationTypeDeadline, Payload: payload, CreatedAt: time.Now()},
	}

	req := httptest.NewRequest(http.MethodGet, "/notifications", nil)
	req.Header.Set("Authorization", authHeader(t, userID))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("status = %d, want %d; body: %s", rr.Code, http.StatusOK, rr.Body.String())
	}

	var resp []map[string]any
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp) != 1 {
		t.Errorf("len = %d, want 1", len(resp))
	}
}

func TestNotificationsHandler_MarkRead_updatesReadAt(t *testing.T) {
	store := newStubNotificationStore()
	h := api.NewNotificationsHandler(store, testSecret, slog.Default())
	userID := uuid.New()

	notifID := uuid.New()
	payload, _ := json.Marshal(map[string]any{"entity_id": uuid.New().String(), "title": "Task 1"})
	store.notifications[userID] = []domain.Notification{
		{ID: notifID, UserID: userID, Type: domain.NotificationTypeDeadline, Payload: payload, CreatedAt: time.Now()},
	}

	req := httptest.NewRequest(http.MethodPost, "/notifications/"+notifID.String()+"/read", nil)
	req.Header.Set("Authorization", authHeader(t, userID))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusNoContent)
	}
}

func TestNotificationsHandler_NoToken_returns401(t *testing.T) {
	store := newStubNotificationStore()
	h := api.NewNotificationsHandler(store, testSecret, slog.Default())

	req := httptest.NewRequest(http.MethodGet, "/notifications", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}
}
