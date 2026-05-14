package postgres_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/domain"
	"github.com/lbc/echo/internal/store/postgres"
)

func createTestUser(t *testing.T, db *postgres.DB) domain.User {
	t.Helper()
	store := postgres.NewUserStore(db)
	u, err := store.Create(context.Background(), "testuser@example.com", "hash")
	if err != nil {
		t.Fatalf("createTestUser: %v", err)
	}
	return u
}

func TestGoalStore_Create_storesGoal(t *testing.T) {
	db := setupDB(t)
	user := createTestUser(t, db)
	store := postgres.NewGoalStore(db)

	goal, err := store.Create(context.Background(), domain.Goal{
		UserID:      user.ID,
		Title:       "Learn Go",
		Description: "Master Go in 3 months",
		Status:      domain.GoalStatusActive,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if goal.Title != "Learn Go" {
		t.Errorf("Title = %q, want %q", goal.Title, "Learn Go")
	}
	if goal.ID == (uuid.UUID{}) {
		t.Error("ID must not be empty")
	}
}

func TestGoalStore_List_returnsUserGoals(t *testing.T) {
	db := setupDB(t)
	user := createTestUser(t, db)
	store := postgres.NewGoalStore(db)

	_, err := store.Create(context.Background(), domain.Goal{UserID: user.ID, Title: "Goal A", Status: domain.GoalStatusActive})
	if err != nil {
		t.Fatalf("Create A: %v", err)
	}
	_, err = store.Create(context.Background(), domain.Goal{UserID: user.ID, Title: "Goal B", Status: domain.GoalStatusActive})
	if err != nil {
		t.Fatalf("Create B: %v", err)
	}

	goals, err := store.List(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(goals) != 2 {
		t.Errorf("len = %d, want 2", len(goals))
	}
}

func TestGoalStore_Get_returnsGoal(t *testing.T) {
	db := setupDB(t)
	user := createTestUser(t, db)
	store := postgres.NewGoalStore(db)

	created, err := store.Create(context.Background(), domain.Goal{UserID: user.ID, Title: "My Goal", Status: domain.GoalStatusActive})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	got, err := store.Get(context.Background(), user.ID, created.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Title != "My Goal" {
		t.Errorf("Title = %q, want %q", got.Title, "My Goal")
	}
}

func TestGoalStore_Update_updatesFields(t *testing.T) {
	db := setupDB(t)
	user := createTestUser(t, db)
	store := postgres.NewGoalStore(db)

	created, err := store.Create(context.Background(), domain.Goal{UserID: user.ID, Title: "Old Title", Status: domain.GoalStatusActive})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	created.Title = "New Title"
	created.Status = domain.GoalStatusDone
	updated, err := store.Update(context.Background(), user.ID, created)
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if updated.Title != "New Title" {
		t.Errorf("Title = %q, want %q", updated.Title, "New Title")
	}
	if updated.Status != domain.GoalStatusDone {
		t.Errorf("Status = %q, want %q", updated.Status, domain.GoalStatusDone)
	}
}

func TestGoalStore_Delete_removesGoal(t *testing.T) {
	db := setupDB(t)
	user := createTestUser(t, db)
	store := postgres.NewGoalStore(db)

	created, err := store.Create(context.Background(), domain.Goal{UserID: user.ID, Title: "Temp", Status: domain.GoalStatusActive})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	if err := store.Delete(context.Background(), user.ID, created.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	_, err = store.Get(context.Background(), user.ID, created.ID)
	if err == nil {
		t.Fatal("expected error after delete, got nil")
	}
}
