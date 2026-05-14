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

type GoalStore struct {
	db *DB
}

func NewGoalStore(db *DB) *GoalStore {
	return &GoalStore{db: db}
}

func (s *GoalStore) Create(ctx context.Context, g domain.Goal) (domain.Goal, error) {
	err := s.db.Pool.QueryRow(ctx,
		`INSERT INTO goals (user_id, title, description, target_date, status)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, user_id, title, description, target_date, status, created_at, updated_at`,
		g.UserID, g.Title, g.Description, g.TargetDate, g.Status,
	).Scan(&g.ID, &g.UserID, &g.Title, &g.Description, &g.TargetDate, &g.Status, &g.CreatedAt, &g.UpdatedAt)
	if err != nil {
		return domain.Goal{}, fmt.Errorf("create goal: %w", err)
	}
	return g, nil
}

func (s *GoalStore) List(ctx context.Context, userID uuid.UUID) ([]domain.Goal, error) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT id, user_id, title, description, target_date, status, created_at, updated_at
		 FROM goals WHERE user_id = $1 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("list goals: %w", err)
	}
	defer rows.Close()

	var goals []domain.Goal
	for rows.Next() {
		var g domain.Goal
		if err := rows.Scan(&g.ID, &g.UserID, &g.Title, &g.Description, &g.TargetDate, &g.Status, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan goal: %w", err)
		}
		goals = append(goals, g)
	}
	return goals, rows.Err()
}

func (s *GoalStore) Get(ctx context.Context, userID, id uuid.UUID) (domain.Goal, error) {
	var g domain.Goal
	err := s.db.Pool.QueryRow(ctx,
		`SELECT id, user_id, title, description, target_date, status, created_at, updated_at
		 FROM goals WHERE id = $1 AND user_id = $2`,
		id, userID,
	).Scan(&g.ID, &g.UserID, &g.Title, &g.Description, &g.TargetDate, &g.Status, &g.CreatedAt, &g.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Goal{}, fmt.Errorf("get goal: %w", domain.ErrNotFound)
		}
		return domain.Goal{}, fmt.Errorf("get goal: %w", err)
	}
	return g, nil
}

func (s *GoalStore) Update(ctx context.Context, userID uuid.UUID, g domain.Goal) (domain.Goal, error) {
	err := s.db.Pool.QueryRow(ctx,
		`UPDATE goals SET title=$1, description=$2, target_date=$3, status=$4, updated_at=NOW()
		 WHERE id=$5 AND user_id=$6
		 RETURNING id, user_id, title, description, target_date, status, created_at, updated_at`,
		g.Title, g.Description, g.TargetDate, g.Status, g.ID, userID,
	).Scan(&g.ID, &g.UserID, &g.Title, &g.Description, &g.TargetDate, &g.Status, &g.CreatedAt, &g.UpdatedAt)
	if err != nil {
		return domain.Goal{}, fmt.Errorf("update goal: %w", err)
	}
	return g, nil
}

func (s *GoalStore) Delete(ctx context.Context, userID, id uuid.UUID) error {
	_, err := s.db.Pool.Exec(ctx,
		`DELETE FROM goals WHERE id=$1 AND user_id=$2`,
		id, userID,
	)
	if err != nil {
		return fmt.Errorf("delete goal: %w", err)
	}
	return nil
}

func (s *GoalStore) ListByTargetWindow(ctx context.Context, windowStart, windowEnd time.Time) ([]domain.Goal, error) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT id, user_id, title, description, target_date, status, created_at, updated_at
		 FROM goals WHERE status = 'active' AND target_date >= $1 AND target_date <= $2`,
		windowStart, windowEnd,
	)
	if err != nil {
		return nil, fmt.Errorf("list by target window: %w", err)
	}
	defer rows.Close()

	var list []domain.Goal
	for rows.Next() {
		var g domain.Goal
		if err := rows.Scan(&g.ID, &g.UserID, &g.Title, &g.Description, &g.TargetDate, &g.Status, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan goal: %w", err)
		}
		list = append(list, g)
	}
	return list, rows.Err()
}
