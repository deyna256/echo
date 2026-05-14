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

type TaskStore struct {
	db *DB
}

func NewTaskStore(db *DB) *TaskStore {
	return &TaskStore{db: db}
}

func (s *TaskStore) Create(ctx context.Context, task domain.Task) (domain.Task, error) {
	if task.DurationMinutes == 0 {
		task.DurationMinutes = 10
	}
	err := s.db.Pool.QueryRow(ctx,
		`INSERT INTO tasks (project_id, user_id, title, description, scheduled_date, duration_minutes, status, ai_suggested, position, color, recurring_template_id, recurring_event_id, original_start_time)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		 RETURNING id, project_id, user_id, title, description, scheduled_date, duration_minutes, status, ai_suggested, position, color, recurring_template_id, recurring_event_id, original_start_time, created_at, updated_at`,
		task.ProjectID, task.UserID, task.Title, task.Description, task.ScheduledDate, task.DurationMinutes,
		task.Status, task.AISuggested, task.Position, task.Color, task.RecurringTemplateID, task.RecurringEventID, task.OriginalStartTime,
	).Scan(&task.ID, &task.ProjectID, &task.UserID, &task.Title, &task.Description,
		&task.ScheduledDate, &task.DurationMinutes, &task.Status, &task.AISuggested, &task.Position, &task.Color, &task.RecurringTemplateID, &task.RecurringEventID, &task.OriginalStartTime, &task.CreatedAt, &task.UpdatedAt)
	if err != nil {
		return domain.Task{}, fmt.Errorf("create task: %w", err)
	}
	return task, nil
}

func (s *TaskStore) List(ctx context.Context, userID, projectID uuid.UUID) ([]domain.Task, error) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT id, project_id, user_id, title, description, scheduled_date, duration_minutes, status, ai_suggested, position, color, recurring_template_id, recurring_event_id, original_start_time, created_at, updated_at
		 FROM tasks WHERE user_id=$1 AND project_id=$2 ORDER BY position ASC, created_at ASC`,
		userID, projectID,
	)
	if err != nil {
		return nil, fmt.Errorf("list tasks: %w", err)
	}
	defer rows.Close()

	var tasks []domain.Task
	for rows.Next() {
		var task domain.Task
		if err := rows.Scan(&task.ID, &task.ProjectID, &task.UserID, &task.Title, &task.Description,
			&task.ScheduledDate, &task.DurationMinutes, &task.Status, &task.AISuggested, &task.Position, &task.Color, &task.RecurringTemplateID, &task.RecurringEventID, &task.OriginalStartTime, &task.CreatedAt, &task.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan task: %w", err)
		}
		tasks = append(tasks, task)
	}
	return tasks, rows.Err()
}

func (s *TaskStore) Get(ctx context.Context, userID, id uuid.UUID) (domain.Task, error) {
	var task domain.Task
	err := s.db.Pool.QueryRow(ctx,
		`SELECT id, project_id, user_id, title, description, scheduled_date, duration_minutes, status, ai_suggested, position, color, recurring_template_id, recurring_event_id, original_start_time, created_at, updated_at
		 FROM tasks WHERE id=$1 AND user_id=$2`,
		id, userID,
	).Scan(&task.ID, &task.ProjectID, &task.UserID, &task.Title, &task.Description,
		&task.ScheduledDate, &task.DurationMinutes, &task.Status, &task.AISuggested, &task.Position, &task.Color, &task.RecurringTemplateID, &task.RecurringEventID, &task.OriginalStartTime, &task.CreatedAt, &task.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Task{}, fmt.Errorf("get task: %w", domain.ErrNotFound)
		}
		return domain.Task{}, fmt.Errorf("get task: %w", err)
	}
	return task, nil
}

func (s *TaskStore) Update(ctx context.Context, userID uuid.UUID, task domain.Task) (domain.Task, error) {
	err := s.db.Pool.QueryRow(ctx,
		`UPDATE tasks SET project_id=$1, title=$2, description=$3, scheduled_date=$4, duration_minutes=$5, status=$6, position=$7, color=$8, recurring_template_id=$11, recurring_event_id=$12, original_start_time=$13, updated_at=NOW()
		 WHERE id=$9 AND user_id=$10
		 RETURNING id, project_id, user_id, title, description, scheduled_date, duration_minutes, status, ai_suggested, position, color, recurring_template_id, recurring_event_id, original_start_time, created_at, updated_at`,
		task.ProjectID, task.Title, task.Description, task.ScheduledDate, task.DurationMinutes, task.Status, task.Position, task.Color, task.ID, userID, task.RecurringTemplateID, task.RecurringEventID, task.OriginalStartTime,
	).Scan(&task.ID, &task.ProjectID, &task.UserID, &task.Title, &task.Description,
		&task.ScheduledDate, &task.DurationMinutes, &task.Status, &task.AISuggested, &task.Position, &task.Color, &task.RecurringTemplateID, &task.RecurringEventID, &task.OriginalStartTime, &task.CreatedAt, &task.UpdatedAt)
	if err != nil {
		return domain.Task{}, fmt.Errorf("update task: %w", err)
	}
	return task, nil
}

func (s *TaskStore) Delete(ctx context.Context, userID, id uuid.UUID) error {
	_, err := s.db.Pool.Exec(ctx,
		`DELETE FROM tasks WHERE id=$1 AND user_id=$2`,
		id, userID,
	)
	if err != nil {
		return fmt.Errorf("delete task: %w", err)
	}
	return nil
}

func (s *TaskStore) ListUnassigned(ctx context.Context, userID uuid.UUID) ([]domain.Task, error) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT id, project_id, user_id, title, description, scheduled_date, duration_minutes, status, ai_suggested, position, color, recurring_template_id, recurring_event_id, original_start_time, created_at, updated_at
		 FROM tasks WHERE user_id=$1 AND project_id IS NULL ORDER BY created_at ASC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("list unassigned tasks: %w", err)
	}
	defer rows.Close()

	var tasks []domain.Task
	for rows.Next() {
		var task domain.Task
		if err := rows.Scan(&task.ID, &task.ProjectID, &task.UserID, &task.Title, &task.Description,
			&task.ScheduledDate, &task.DurationMinutes, &task.Status, &task.AISuggested, &task.Position, &task.Color, &task.RecurringTemplateID, &task.RecurringEventID, &task.OriginalStartTime, &task.CreatedAt, &task.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan task: %w", err)
		}
		tasks = append(tasks, task)
	}
	return tasks, rows.Err()
}

func (s *TaskStore) ListByGoal(ctx context.Context, userID, goalID uuid.UUID) ([]domain.Task, error) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT t.id, t.project_id, t.user_id, t.title, t.description, t.scheduled_date, t.duration_minutes, t.status, t.ai_suggested, t.position, t.color, t.recurring_template_id, t.recurring_event_id, t.original_start_time, t.created_at, t.updated_at
		 FROM tasks t
		 JOIN projects p ON t.project_id = p.id
		 WHERE t.user_id=$1 AND p.goal_id=$2
		 ORDER BY t.position ASC, t.created_at ASC`,
		userID, goalID,
	)
	if err != nil {
		return nil, fmt.Errorf("list tasks by goal: %w", err)
	}
	defer rows.Close()

	var tasks []domain.Task
	for rows.Next() {
		var task domain.Task
		if err := rows.Scan(&task.ID, &task.ProjectID, &task.UserID, &task.Title, &task.Description,
			&task.ScheduledDate, &task.DurationMinutes, &task.Status, &task.AISuggested, &task.Position, &task.Color, &task.RecurringTemplateID, &task.RecurringEventID, &task.OriginalStartTime, &task.CreatedAt, &task.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan task: %w", err)
		}
		tasks = append(tasks, task)
	}
	return tasks, rows.Err()
}

func (s *TaskStore) ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.Task, error) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT id, project_id, user_id, title, description, scheduled_date, duration_minutes, status, ai_suggested, position, color, recurring_template_id, recurring_event_id, original_start_time, created_at, updated_at
		 FROM tasks WHERE user_id=$1 ORDER BY position ASC, created_at ASC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("list tasks by user: %w", err)
	}
	defer rows.Close()

	var tasks []domain.Task
	for rows.Next() {
		var task domain.Task
		if err := rows.Scan(&task.ID, &task.ProjectID, &task.UserID, &task.Title, &task.Description,
			&task.ScheduledDate, &task.DurationMinutes, &task.Status, &task.AISuggested, &task.Position, &task.Color, &task.RecurringTemplateID, &task.RecurringEventID, &task.OriginalStartTime, &task.CreatedAt, &task.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan task: %w", err)
		}
		tasks = append(tasks, task)
	}
	return tasks, rows.Err()
}

func (s *TaskStore) ListOverdue(ctx context.Context, before time.Time) ([]domain.Task, error) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT id, project_id, user_id, title, description, scheduled_date, duration_minutes, status, ai_suggested, position, color, recurring_template_id, recurring_event_id, original_start_time, created_at, updated_at
		 FROM tasks WHERE status = 'todo' AND scheduled_date < $1`,
		before,
	)
	if err != nil {
		return nil, fmt.Errorf("list overdue: %w", err)
	}
	defer rows.Close()

	var list []domain.Task
	for rows.Next() {
		var t domain.Task
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.UserID, &t.Title, &t.Description,
			&t.ScheduledDate, &t.DurationMinutes, &t.Status, &t.AISuggested, &t.Position, &t.Color, &t.RecurringTemplateID, &t.RecurringEventID, &t.OriginalStartTime, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan task: %w", err)
		}
		list = append(list, t)
	}
	return list, rows.Err()
}

func (s *TaskStore) ListByDueWindow(ctx context.Context, windowStart, windowEnd time.Time) ([]domain.Task, error) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT id, project_id, user_id, title, description, scheduled_date, duration_minutes, status, ai_suggested, position, color, recurring_template_id, recurring_event_id, original_start_time, created_at, updated_at
		 FROM tasks WHERE status = 'todo' AND scheduled_date >= $1 AND scheduled_date <= $2`,
		windowStart, windowEnd,
	)
	if err != nil {
		return nil, fmt.Errorf("list by due window: %w", err)
	}
	defer rows.Close()

	var list []domain.Task
	for rows.Next() {
		var t domain.Task
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.UserID, &t.Title, &t.Description,
			&t.ScheduledDate, &t.DurationMinutes, &t.Status, &t.AISuggested, &t.Position, &t.Color, &t.RecurringTemplateID, &t.RecurringEventID, &t.OriginalStartTime, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan task: %w", err)
		}
		list = append(list, t)
	}
	return list, rows.Err()
}

func (s *TaskStore) DeleteByTemplate(ctx context.Context, templateID uuid.UUID) (int64, error) {
	result, err := s.db.Pool.Exec(ctx,
		`DELETE FROM tasks WHERE recurring_template_id = $1 AND scheduled_date > NOW()`,
		templateID,
	)
	if err != nil {
		return 0, fmt.Errorf("delete by template: %w", err)
	}
	return result.RowsAffected(), nil
}
