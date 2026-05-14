package notifications_test

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/notifications"
)

func TestBus_Publish_storesEvent(t *testing.T) {
	bus := notifications.NewBus()
	userID := uuid.New()
	e := notifications.Event{
		ID:        uuid.New(),
		UserID:    userID,
		Type:      notifications.EventTaskOverdue,
		EntityID:  uuid.New(),
		Title:     "Task 1",
		CreatedAt: time.Now(),
	}

	bus.Publish(context.Background(), e)

	list := bus.List(userID)
	if len(list) != 1 {
		t.Fatalf("len = %d, want 1", len(list))
	}
	if list[0].Type != notifications.EventTaskOverdue {
		t.Errorf("Type = %v, want %v", list[0].Type, notifications.EventTaskOverdue)
	}
}

type testAdapter struct {
	mu    sync.Mutex
	events []notifications.Event
}

func (a *testAdapter) Notify(ctx context.Context, e notifications.Event) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.events = append(a.events, e)
	return nil
}

func TestBus_Publish_callsAdapters(t *testing.T) {
	bus := notifications.NewBus()
	adapter := &testAdapter{}
	bus.Register(adapter)

	e := notifications.Event{ID: uuid.New(), UserID: uuid.New(), Type: notifications.EventTaskOverdue, CreatedAt: time.Now()}
	bus.Publish(context.Background(), e)

	adapter.mu.Lock()
	defer adapter.mu.Unlock()
	if len(adapter.events) != 1 {
		t.Errorf("adapter received %d events, want 1", len(adapter.events))
	}
}

func TestBus_MarkRead_removesEvent(t *testing.T) {
	bus := notifications.NewBus()
	userID := uuid.New()
	e := notifications.Event{ID: uuid.New(), UserID: userID, Type: notifications.EventTaskOverdue, CreatedAt: time.Now()}
	bus.Publish(context.Background(), e)

	ok := bus.MarkRead(context.Background(), userID, e.ID)
	if !ok {
		t.Error("MarkRead returned false, want true")
	}

	list := bus.List(userID)
	if len(list) != 0 {
		t.Errorf("len = %d, want 0 after MarkRead", len(list))
	}
}

func TestBus_List_concurrent(t *testing.T) {
	bus := notifications.NewBus()
	userID := uuid.New()
	eventID := uuid.New()
	e := notifications.Event{ID: eventID, UserID: userID, Type: notifications.EventTaskOverdue, CreatedAt: time.Now()}
	bus.Publish(context.Background(), e)

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			bus.List(userID)
		}()
		wg.Add(1)
		go func() {
			defer wg.Done()
			bus.Publish(context.Background(), notifications.Event{ID: uuid.New(), UserID: userID, Type: notifications.EventTaskOverdue, CreatedAt: time.Now()})
		}()
	}
	wg.Wait()

	list := bus.List(userID)
	if len(list) < 1 {
		t.Errorf("len(list) = %d, want >= 1 after concurrent operations", len(list))
	}
}