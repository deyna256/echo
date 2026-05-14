package scheduler_test

import (
	"context"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/domain"
	"github.com/lbc/echo/internal/notifications"
	"github.com/lbc/echo/internal/scheduler"
)

type mockTaskStore struct {
	mu      sync.Mutex
	overdue []domain.Task
	window  []domain.Task
}

func (m *mockTaskStore) ListOverdue(ctx context.Context, before time.Time) ([]domain.Task, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.overdue, nil
}

func (m *mockTaskStore) ListByDueWindow(ctx context.Context, windowStart, windowEnd time.Time) ([]domain.Task, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.window, nil
}

type mockGoalStore struct {
	mu     sync.Mutex
	window []domain.Goal
}

func (m *mockGoalStore) ListByTargetWindow(ctx context.Context, windowStart, windowEnd time.Time) ([]domain.Goal, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.window, nil
}

func TestScheduler_publishesOverdue(t *testing.T) {
	userID := uuid.New()
	taskID := uuid.New()
	future := time.Now().Add(-24 * time.Hour)
	taskStore := &mockTaskStore{
		overdue: []domain.Task{
			{ID: taskID, UserID: userID, Title: "Overdue Task", ScheduledDate: &future},
		},
	}
	goalStore := &mockGoalStore{}
	bus := notifications.NewBus()
	log := slog.Default()

	s := scheduler.New(taskStore, goalStore, bus, log)
	ctx := context.Background()

	s.Start(ctx)
	time.Sleep(100 * time.Millisecond)
	s.Stop()

	list := bus.List(userID)
	if len(list) != 1 {
		t.Fatalf("len(list) = %d, want 1", len(list))
	}
	if list[0].Type != notifications.EventTaskOverdue {
		t.Errorf("Type = %v, want %v", list[0].Type, notifications.EventTaskOverdue)
	}
	if list[0].EntityID != taskID {
		t.Errorf("EntityID = %v, want %v", list[0].EntityID, taskID)
	}
	if list[0].Title != "Overdue Task" {
		t.Errorf("Title = %q, want %q", list[0].Title, "Overdue Task")
	}
}

func TestScheduler_publishesDeadlineApproaching(t *testing.T) {
	userID := uuid.New()
	taskID := uuid.New()
	future := time.Now().Add(12 * time.Hour)
	taskStore := &mockTaskStore{
		window: []domain.Task{
			{ID: taskID, UserID: userID, Title: "Soon Task", ScheduledDate: &future},
		},
	}
	goalStore := &mockGoalStore{}
	bus := notifications.NewBus()
	log := slog.Default()

	s := scheduler.New(taskStore, goalStore, bus, log)
	ctx := context.Background()

	s.Start(ctx)
	time.Sleep(100 * time.Millisecond)
	s.Stop()

	list := bus.List(userID)
	if len(list) != 1 {
		t.Fatalf("len(list) = %d, want 1", len(list))
	}
	if list[0].Type != notifications.EventTaskDeadlineApproaching {
		t.Errorf("Type = %v, want %v", list[0].Type, notifications.EventTaskDeadlineApproaching)
	}
	if list[0].EntityID != taskID {
		t.Errorf("EntityID = %v, want %v", list[0].EntityID, taskID)
	}
	if list[0].Title != "Soon Task" {
		t.Errorf("Title = %q, want %q", list[0].Title, "Soon Task")
	}
}