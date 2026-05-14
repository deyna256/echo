package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/lbc/echo/internal/domain"
)

type ProjectStore struct {
	db *DB
}

func NewProjectStore(db *DB) *ProjectStore {
	return &ProjectStore{db: db}
}

func (s *ProjectStore) Create(ctx context.Context, p domain.Project) (domain.Project, error) {
	err := s.db.Pool.QueryRow(ctx,
		`INSERT INTO projects (goal_id, user_id, title, description, target_date, status, ai_suggested)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, goal_id, user_id, title, description, target_date, status, ai_suggested, created_at, updated_at`,
		p.GoalID, p.UserID, p.Title, p.Description, p.TargetDate, p.Status, p.AISuggested,
	).Scan(&p.ID, &p.GoalID, &p.UserID, &p.Title, &p.Description, &p.TargetDate, &p.Status, &p.AISuggested, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return domain.Project{}, fmt.Errorf("create project: %w", err)
	}
	return p, nil
}

func (s *ProjectStore) List(ctx context.Context, userID, goalID uuid.UUID) ([]domain.Project, error) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT id, goal_id, user_id, title, description, target_date, status, ai_suggested, created_at, updated_at
		 FROM projects WHERE user_id=$1 AND goal_id=$2 ORDER BY created_at ASC`,
		userID, goalID,
	)
	if err != nil {
		return nil, fmt.Errorf("list projects: %w", err)
	}
	defer rows.Close()

	var projects []domain.Project
	for rows.Next() {
		var p domain.Project
		if err := rows.Scan(&p.ID, &p.GoalID, &p.UserID, &p.Title, &p.Description, &p.TargetDate, &p.Status, &p.AISuggested, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan project: %w", err)
		}
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

func (s *ProjectStore) ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.Project, error) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT id, goal_id, user_id, title, description, target_date, status, ai_suggested, created_at, updated_at
		 FROM projects WHERE user_id=$1 ORDER BY created_at ASC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("list projects by user: %w", err)
	}
	defer rows.Close()

	var projects []domain.Project
	for rows.Next() {
		var p domain.Project
		if err := rows.Scan(&p.ID, &p.GoalID, &p.UserID, &p.Title, &p.Description, &p.TargetDate, &p.Status, &p.AISuggested, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan project: %w", err)
		}
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

func (s *ProjectStore) ListUnattached(ctx context.Context, userID uuid.UUID) ([]domain.Project, error) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT id, goal_id, user_id, title, description, target_date, status, ai_suggested, created_at, updated_at
		 FROM projects WHERE user_id=$1 AND goal_id IS NULL ORDER BY created_at ASC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("list unattached projects: %w", err)
	}
	defer rows.Close()

	var projects []domain.Project
	for rows.Next() {
		var p domain.Project
		if err := rows.Scan(&p.ID, &p.GoalID, &p.UserID, &p.Title, &p.Description, &p.TargetDate, &p.Status, &p.AISuggested, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan project: %w", err)
		}
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

func (s *ProjectStore) Get(ctx context.Context, userID, id uuid.UUID) (domain.Project, error) {
	var p domain.Project
	err := s.db.Pool.QueryRow(ctx,
		`SELECT id, goal_id, user_id, title, description, target_date, status, ai_suggested, created_at, updated_at
		 FROM projects WHERE id=$1 AND user_id=$2`,
		id, userID,
	).Scan(&p.ID, &p.GoalID, &p.UserID, &p.Title, &p.Description, &p.TargetDate, &p.Status, &p.AISuggested, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Project{}, fmt.Errorf("get project: %w", domain.ErrNotFound)
		}
		return domain.Project{}, fmt.Errorf("get project: %w", err)
	}
	return p, nil
}

func (s *ProjectStore) Update(ctx context.Context, userID uuid.UUID, p domain.Project) (domain.Project, error) {
	err := s.db.Pool.QueryRow(ctx,
		`UPDATE projects SET title=$1, description=$2, target_date=$3, status=$4, updated_at=NOW()
		 WHERE id=$5 AND user_id=$6
		 RETURNING id, goal_id, user_id, title, description, target_date, status, ai_suggested, created_at, updated_at`,
		p.Title, p.Description, p.TargetDate, p.Status, p.ID, userID,
	).Scan(&p.ID, &p.GoalID, &p.UserID, &p.Title, &p.Description, &p.TargetDate, &p.Status, &p.AISuggested, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return domain.Project{}, fmt.Errorf("update project: %w", err)
	}
	return p, nil
}

func (s *ProjectStore) Delete(ctx context.Context, userID, id uuid.UUID) error {
	_, err := s.db.Pool.Exec(ctx,
		`DELETE FROM projects WHERE id=$1 AND user_id=$2`,
		id, userID,
	)
	if err != nil {
		return fmt.Errorf("delete project: %w", err)
	}
	return nil
}
