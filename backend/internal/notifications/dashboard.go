package notifications

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/domain"
)

type notificationStore interface {
	Create(ctx context.Context, n domain.Notification) error
}

type DashboardAdapter struct {
	store notificationStore
}

func NewDashboardAdapter(store notificationStore) *DashboardAdapter {
	return &DashboardAdapter{store: store}
}

func (a *DashboardAdapter) Notify(ctx context.Context, e Event) error {
	payload, _ := json.Marshal(map[string]any{
		"entity_id":      e.EntityID.String(),
		"title":          e.Title,
		"scheduled_date": e.ScheduledDate.Format(time.RFC3339),
	})
	n := domain.Notification{
		ID:        uuid.New(),
		UserID:    e.UserID,
		Type:      domain.NotificationType(e.Type),
		Payload:   payload,
		CreatedAt: e.CreatedAt,
	}
	return a.store.Create(ctx, n)
}
