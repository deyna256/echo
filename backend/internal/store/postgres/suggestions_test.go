package postgres_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/lbc/echo/internal/domain"
	"github.com/lbc/echo/internal/store/postgres"
)

func TestSuggestionStore_Create_storesSuggestion(t *testing.T) {
	db := setupDB(t)
	user := createTestUser(t, db)
	goal := createTestGoal(t, db, user.ID)
	store := postgres.NewSuggestionStore(db)

	payload, _ := json.Marshal(map[string]any{"projects": []any{}})
	s, err := store.Create(context.Background(), user.ID, goal.ID, payload)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if s.ID.String() == "" {
		t.Error("ID must not be empty")
	}
	if s.Status != domain.SuggestionStatusPending {
		t.Errorf("Status = %q, want %q", s.Status, domain.SuggestionStatusPending)
	}
}

func TestSuggestionStore_List_returnsUserSuggestions(t *testing.T) {
	db := setupDB(t)
	user := createTestUser(t, db)
	goal := createTestGoal(t, db, user.ID)
	store := postgres.NewSuggestionStore(db)

	payload, _ := json.Marshal(map[string]any{"projects": []any{}})
	_, err := store.Create(context.Background(), user.ID, goal.ID, payload)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	list, err := store.List(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 1 {
		t.Errorf("len = %d, want 1", len(list))
	}
}

func TestSuggestionStore_UpdateStatus_changesStatus(t *testing.T) {
	db := setupDB(t)
	user := createTestUser(t, db)
	goal := createTestGoal(t, db, user.ID)
	store := postgres.NewSuggestionStore(db)

	payload, _ := json.Marshal(map[string]any{"projects": []any{}})
	s, err := store.Create(context.Background(), user.ID, goal.ID, payload)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	if err := store.UpdateStatus(context.Background(), user.ID, s.ID, domain.SuggestionStatusAccepted); err != nil {
		t.Fatalf("UpdateStatus: %v", err)
	}

	got, err := store.Get(context.Background(), user.ID, s.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Status != domain.SuggestionStatusAccepted {
		t.Errorf("Status = %q, want %q", got.Status, domain.SuggestionStatusAccepted)
	}
}