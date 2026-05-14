package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/lbc/echo/internal/domain"
)

type RecurringTemplateStore struct {
	db *DB
}

func NewRecurringTemplateStore(db *DB) *RecurringTemplateStore {
	return &RecurringTemplateStore{db: db}
}

func (s *RecurringTemplateStore) Create(ctx context.Context, tmpl domain.RecurringTemplate) (domain.RecurringTemplate, error) {
	err := s.db.Pool.QueryRow(ctx,
		`INSERT INTO recurring_templates (user_id, title, description, duration_minutes, color, recurrence_rule, next_run_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, user_id, title, description, duration_minutes, color, recurrence_rule, next_run_at, created_at, updated_at`,
		tmpl.UserID, tmpl.Title, tmpl.Description, tmpl.DurationMinutes, tmpl.Color, tmpl.RecurrenceRule, tmpl.NextRunAt,
	).Scan(&tmpl.ID, &tmpl.UserID, &tmpl.Title, &tmpl.Description, &tmpl.DurationMinutes, &tmpl.Color, &tmpl.RecurrenceRule, &tmpl.NextRunAt, &tmpl.CreatedAt, &tmpl.UpdatedAt)
	if err != nil {
		return domain.RecurringTemplate{}, fmt.Errorf("create recurring template: %w", err)
	}
	return tmpl, nil
}

func (s *RecurringTemplateStore) Get(ctx context.Context, userID, id uuid.UUID) (domain.RecurringTemplate, error) {
	var tmpl domain.RecurringTemplate
	err := s.db.Pool.QueryRow(ctx,
		`SELECT id, user_id, title, description, duration_minutes, color, recurrence_rule, next_run_at, created_at, updated_at
		 FROM recurring_templates WHERE id=$1 AND user_id=$2`,
		id, userID,
	).Scan(&tmpl.ID, &tmpl.UserID, &tmpl.Title, &tmpl.Description, &tmpl.DurationMinutes, &tmpl.Color, &tmpl.RecurrenceRule, &tmpl.NextRunAt, &tmpl.CreatedAt, &tmpl.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.RecurringTemplate{}, fmt.Errorf("get recurring template: %w", domain.ErrNotFound)
		}
		return domain.RecurringTemplate{}, fmt.Errorf("get recurring template: %w", err)
	}
	return tmpl, nil
}

func (s *RecurringTemplateStore) Update(ctx context.Context, userID uuid.UUID, tmpl domain.RecurringTemplate) (domain.RecurringTemplate, error) {
	err := s.db.Pool.QueryRow(ctx,
		`UPDATE recurring_templates SET title=$1, description=$2, duration_minutes=$3, color=$4, recurrence_rule=$5, next_run_at=$6, updated_at=NOW()
		 WHERE id=$7 AND user_id=$8
		 RETURNING id, user_id, title, description, duration_minutes, color, recurrence_rule, next_run_at, created_at, updated_at`,
		tmpl.Title, tmpl.Description, tmpl.DurationMinutes, tmpl.Color, tmpl.RecurrenceRule, tmpl.NextRunAt, tmpl.ID, userID,
	).Scan(&tmpl.ID, &tmpl.UserID, &tmpl.Title, &tmpl.Description, &tmpl.DurationMinutes, &tmpl.Color, &tmpl.RecurrenceRule, &tmpl.NextRunAt, &tmpl.CreatedAt, &tmpl.UpdatedAt)
	if err != nil {
		return domain.RecurringTemplate{}, fmt.Errorf("update recurring template: %w", err)
	}
	return tmpl, nil
}

func (s *RecurringTemplateStore) Delete(ctx context.Context, userID, id uuid.UUID) error {
	_, err := s.db.Pool.Exec(ctx,
		`DELETE FROM recurring_templates WHERE id=$1 AND user_id=$2`,
		id, userID,
	)
	if err != nil {
		return fmt.Errorf("delete recurring template: %w", err)
	}
	return nil
}

func (s *RecurringTemplateStore) ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.RecurringTemplate, error) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT id, user_id, title, description, duration_minutes, color, recurrence_rule, next_run_at, created_at, updated_at
		 FROM recurring_templates WHERE user_id=$1 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("list recurring templates: %w", err)
	}
	defer rows.Close()

	var templates []domain.RecurringTemplate
	for rows.Next() {
		var tmpl domain.RecurringTemplate
		if err := rows.Scan(&tmpl.ID, &tmpl.UserID, &tmpl.Title, &tmpl.Description, &tmpl.DurationMinutes, &tmpl.Color, &tmpl.RecurrenceRule, &tmpl.NextRunAt, &tmpl.CreatedAt, &tmpl.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan recurring template: %w", err)
		}
		templates = append(templates, tmpl)
	}
	return templates, rows.Err()
}

func (s *RecurringTemplateStore) UpdateNextRunAt(ctx context.Context, id uuid.UUID, nextRunAt time.Time) error {
	_, err := s.db.Pool.Exec(ctx,
		`UPDATE recurring_templates SET next_run_at=$1, updated_at=NOW() WHERE id=$2`,
		nextRunAt, id,
	)
	if err != nil {
		return fmt.Errorf("update next_run_at: %w", err)
	}
	return nil
}
