package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var ErrNotFound = errors.New("not found")

type GoalStatus string

const (
	GoalStatusActive   GoalStatus = "active"
	GoalStatusDone     GoalStatus = "done"
	GoalStatusArchived GoalStatus = "archived"
)

type ProjectStatus string

const (
	ProjectStatusActive   ProjectStatus = "active"
	ProjectStatusDone     ProjectStatus = "done"
	ProjectStatusArchived ProjectStatus = "archived"
)

type TaskStatus string

const (
	TaskStatusTodo      TaskStatus = "todo"
	TaskStatusPostponed TaskStatus = "postponed"
	TaskStatusDone      TaskStatus = "done"
)

type NotificationType string

const (
	NotificationTypeDeadline   NotificationType = "deadline"
	NotificationTypeOverdue    NotificationType = "overdue"
	NotificationTypeSuggestion NotificationType = "suggestion"
)

type SuggestionStatus string

const (
	SuggestionStatusPending  SuggestionStatus = "pending"
	SuggestionStatusAccepted SuggestionStatus = "accepted"
	SuggestionStatusRejected SuggestionStatus = "rejected"
)

type User struct {
	ID           uuid.UUID `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}

type Goal struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	TargetDate  *time.Time `json:"target_date"`
	Status      GoalStatus `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Project struct {
	ID          uuid.UUID  `json:"id"`
	GoalID      *uuid.UUID `json:"goal_id"`
	UserID      uuid.UUID  `json:"user_id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	TargetDate  *time.Time `json:"target_date"`
	Status      ProjectStatus `json:"status"`
	AISuggested bool       `json:"ai_suggested"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Task struct {
	ID                    uuid.UUID  `json:"id"`
	ProjectID             *uuid.UUID `json:"project_id"`
	UserID                uuid.UUID  `json:"user_id"`
	Title                 string     `json:"title"`
	Description           string     `json:"description"`
	ScheduledDate         *time.Time `json:"scheduled_date"`
	DurationMinutes       int        `json:"duration_minutes"`
	Status                TaskStatus `json:"status"`
	AISuggested           bool       `json:"ai_suggested"`
	Position              int        `json:"position"`
	Color                 *string    `json:"color,omitempty"`
	RecurringTemplateID   *uuid.UUID `json:"recurring_template_id,omitempty"`
	RecurringEventID      *uuid.UUID `json:"recurring_event_id,omitempty"`
	OriginalStartTime     *time.Time `json:"original_start_time,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

type RecurringTemplate struct {
	ID              uuid.UUID `json:"id"`
	UserID          uuid.UUID `json:"user_id"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	DurationMinutes int       `json:"duration_minutes"`
	Color           *string   `json:"color,omitempty"`
	RecurrenceRule  string    `json:"recurrence_rule"`
	NextRunAt       time.Time `json:"next_run_at"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type Notification struct {
	ID        uuid.UUID       `json:"id"`
	UserID    uuid.UUID       `json:"user_id"`
	Type      NotificationType `json:"type"`
	Payload   []byte          `json:"payload"`
	ReadAt    *time.Time      `json:"read_at"`
	CreatedAt time.Time       `json:"created_at"`
}

type AISuggestion struct {
	ID        uuid.UUID       `json:"id"`
	UserID    uuid.UUID       `json:"user_id"`
	GoalID    uuid.UUID       `json:"goal_id"`
	Payload   []byte          `json:"payload"`
	Status    SuggestionStatus `json:"status"`
	CreatedAt time.Time       `json:"created_at"`
}
