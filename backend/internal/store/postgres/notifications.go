package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/domain"
)

type NotificationStore struct {
	db *DB
}

func NewNotificationStore(db *DB) *NotificationStore {
	return &NotificationStore{db: db}
}

func (s *NotificationStore) Create(ctx context.Context, n domain.Notification) error {
	_, err := s.db.Pool.Exec(ctx,
		`INSERT INTO notifications (user_id, type, payload, read_at, created_at)
		 VALUES ($1, $2, $3, $4, $5)`,
		n.UserID, n.Type, n.Payload, n.ReadAt, n.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("create notification: %w", err)
	}
	return nil
}

func (s *NotificationStore) ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.Notification, error) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT id, user_id, type, payload, read_at, created_at
		 FROM notifications WHERE user_id=$1 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}
	defer rows.Close()

	var list []domain.Notification
	for rows.Next() {
		var n domain.Notification
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Payload, &n.ReadAt, &n.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan notification: %w", err)
		}
		list = append(list, n)
	}
	return list, rows.Err()
}

func (s *NotificationStore) MarkRead(ctx context.Context, userID, id uuid.UUID) error {
	_, err := s.db.Pool.Exec(ctx,
		`UPDATE notifications SET read_at=$1 WHERE id=$2 AND user_id=$3`,
		time.Now(), id, userID,
	)
	if err != nil {
		return fmt.Errorf("mark read: %w", err)
	}
	return nil
}