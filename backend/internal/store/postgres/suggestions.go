package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/lbc/echo/internal/domain"
)

type SuggestionStore struct {
	db *DB
}

func NewSuggestionStore(db *DB) *SuggestionStore {
	return &SuggestionStore{db: db}
}

func (s *SuggestionStore) Create(ctx context.Context, userID, goalID uuid.UUID, payload []byte) (domain.AISuggestion, error) {
	var sg domain.AISuggestion
	err := s.db.Pool.QueryRow(ctx,
		`INSERT INTO ai_suggestions (user_id, goal_id, payload)
		 VALUES ($1, $2, $3)
		 RETURNING id, user_id, goal_id, payload, status, created_at`,
		userID, goalID, payload,
	).Scan(&sg.ID, &sg.UserID, &sg.GoalID, &sg.Payload, &sg.Status, &sg.CreatedAt)
	if err != nil {
		return domain.AISuggestion{}, fmt.Errorf("create suggestion: %w", err)
	}
	return sg, nil
}

func (s *SuggestionStore) List(ctx context.Context, userID uuid.UUID) ([]domain.AISuggestion, error) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT id, user_id, goal_id, payload, status, created_at
		 FROM ai_suggestions WHERE user_id = $1 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("list suggestions: %w", err)
	}
	defer rows.Close()

	var list []domain.AISuggestion
	for rows.Next() {
		var sg domain.AISuggestion
		if err := rows.Scan(&sg.ID, &sg.UserID, &sg.GoalID, &sg.Payload, &sg.Status, &sg.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan suggestion: %w", err)
		}
		list = append(list, sg)
	}
	return list, rows.Err()
}

func (s *SuggestionStore) Get(ctx context.Context, userID, id uuid.UUID) (domain.AISuggestion, error) {
	var sg domain.AISuggestion
	err := s.db.Pool.QueryRow(ctx,
		`SELECT id, user_id, goal_id, payload, status, created_at
		 FROM ai_suggestions WHERE id = $1 AND user_id = $2`,
		id, userID,
	).Scan(&sg.ID, &sg.UserID, &sg.GoalID, &sg.Payload, &sg.Status, &sg.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.AISuggestion{}, fmt.Errorf("get suggestion: %w", domain.ErrNotFound)
		}
		return domain.AISuggestion{}, fmt.Errorf("get suggestion: %w", err)
	}
	return sg, nil
}

func (s *SuggestionStore) UpdateStatus(ctx context.Context, userID, id uuid.UUID, status domain.SuggestionStatus) error {
	_, err := s.db.Pool.Exec(ctx,
		`UPDATE ai_suggestions SET status = $1 WHERE id = $2 AND user_id = $3`,
		status, id, userID,
	)
	if err != nil {
		return fmt.Errorf("update suggestion status: %w", err)
	}
	return nil
}
