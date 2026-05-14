package scheduler

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/domain"
	"github.com/lbc/echo/internal/notifications"
)

type TaskStore interface {
	ListOverdue(ctx context.Context, before time.Time) ([]domain.Task, error)
	ListByDueWindow(ctx context.Context, windowStart, windowEnd time.Time) ([]domain.Task, error)
}

type GoalStore interface {
	ListByTargetWindow(ctx context.Context, windowStart, windowEnd time.Time) ([]domain.Goal, error)
}

type Scheduler struct {
	tasks        TaskStore
	goals        GoalStore
	bus          *notifications.Bus
	tickInterval time.Duration
	warnWindow   time.Duration
	log          *slog.Logger
	stopCh       chan struct{}
	wg           sync.WaitGroup
}

const defaultTickInterval = 5 * time.Minute

func New(tasks TaskStore, goals GoalStore, bus *notifications.Bus, log *slog.Logger) *Scheduler {
	return &Scheduler{
		tasks:        tasks,
		goals:        goals,
		bus:          bus,
		tickInterval: defaultTickInterval,
		warnWindow:   24 * time.Hour,
		log:          log,
		stopCh:       make(chan struct{}),
	}
}

func (s *Scheduler) Start(ctx context.Context) {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		ticker := time.NewTicker(s.tickInterval)
		defer ticker.Stop()
		s.checkDeadlines(ctx)
		for {
			select {
			case <-ticker.C:
				s.checkDeadlines(ctx)
			case <-s.stopCh:
				return
			case <-ctx.Done():
				return
			}
		}
	}()
}

func (s *Scheduler) Stop() {
	close(s.stopCh)
	s.wg.Wait()
}

func (s *Scheduler) checkDeadlines(ctx context.Context) {
	s.log.InfoContext(ctx, "scheduler tick")

	now := time.Now()
	windowEnd := now.Add(s.warnWindow)

	tasks, err := s.tasks.ListOverdue(ctx, now)
	if err != nil {
		s.log.ErrorContext(ctx, "scheduler list overdue", slog.String("error", err.Error()))
	} else {
		for _, t := range tasks {
			s.publish(ctx, notifications.EventTaskOverdue, t.ID, t.UserID, t.Title, time.Time{})
		}
	}

	tasks, err = s.tasks.ListByDueWindow(ctx, now, windowEnd)
	if err != nil {
		s.log.ErrorContext(ctx, "scheduler list task window", slog.String("error", err.Error()))
	} else {
		for _, t := range tasks {
			if t.ScheduledDate != nil {
				s.publish(ctx, notifications.EventTaskDeadlineApproaching, t.ID, t.UserID, t.Title, *t.ScheduledDate)
			}
		}
	}

	goals, err := s.goals.ListByTargetWindow(ctx, now, windowEnd)
	if err != nil {
		s.log.ErrorContext(ctx, "scheduler list goal window", slog.String("error", err.Error()))
	} else {
		for _, g := range goals {
			if g.TargetDate != nil {
				s.publish(ctx, notifications.EventGoalDeadlineApproaching, g.ID, g.UserID, g.Title, *g.TargetDate)
			}
		}
	}
}

func (s *Scheduler) publish(ctx context.Context, typ notifications.EventType, entityID, userID uuid.UUID, title string, scheduledDate time.Time) {
	e := notifications.Event{
		ID:            uuid.New(),
		UserID:        userID,
		Type:          typ,
		EntityID:      entityID,
		Title:         title,
		ScheduledDate: scheduledDate,
		CreatedAt:     time.Now(),
	}
	s.bus.Publish(ctx, e)
	s.log.InfoContext(ctx, "scheduler event", slog.String("type", string(typ)), slog.String("entity_id", entityID.String()))
}
