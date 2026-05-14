package notifications

import (
	"time"

	"github.com/google/uuid"
)

type EventType string

const (
	EventTaskOverdue             EventType = "task_overdue"
	EventTaskDeadlineApproaching EventType = "task_deadline_approaching"
	EventGoalDeadlineApproaching EventType = "goal_deadline_approaching"
)

type Event struct {
	ID            uuid.UUID
	UserID        uuid.UUID
	Type          EventType
	EntityID      uuid.UUID
	Title         string
	ScheduledDate time.Time
	CreatedAt     time.Time
}
