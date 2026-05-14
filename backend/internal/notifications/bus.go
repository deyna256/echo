package notifications

import (
	"context"
	"sync"

	"github.com/google/uuid"
)

type Adapter interface {
	Notify(ctx context.Context, e Event) error
}

type Bus struct {
	mu       sync.RWMutex
	users    map[uuid.UUID][]Event
	adapters []Adapter
}

func NewBus() *Bus {
	return &Bus{users: make(map[uuid.UUID][]Event)}
}

func (b *Bus) Register(a Adapter) {
	b.adapters = append(b.adapters, a)
}

func (b *Bus) Publish(ctx context.Context, e Event) {
	for _, a := range b.adapters {
		_ = a.Notify(ctx, e)
	}
	b.mu.Lock()
	b.users[e.UserID] = append(b.users[e.UserID], e)
	b.mu.Unlock()
}

func (b *Bus) List(userID uuid.UUID) []Event {
	b.mu.RLock()
	defer b.mu.RUnlock()
	events := b.users[userID]
	if events == nil {
		return []Event{}
	}
	result := make([]Event, len(events))
	copy(result, events)
	return result
}

func (b *Bus) MarkRead(ctx context.Context, userID, notifID uuid.UUID) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	events := b.users[userID]
	for i, e := range events {
		if e.ID == notifID {
			b.users[userID] = append(events[:i], events[i+1:]...)
			return true
		}
	}
	return false
}
