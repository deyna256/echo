package postgres_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/domain"
	"github.com/lbc/echo/internal/store/postgres"
)

func createTestGoal(t *testing.T, db *postgres.DB, userID uuid.UUID) domain.Goal {
	t.Helper()
	store := postgres.NewGoalStore(db)
	g, err := store.Create(context.Background(), domain.Goal{
		UserID: userID,
		Title:  "Test Goal",
		Status: domain.GoalStatusActive,
	})
	if err != nil {
		t.Fatalf("createTestGoal: %v", err)
	}
	return g
}

func TestProjectStore_Create_storesProject(t *testing.T) {
	db := setupDB(t)
	user := createTestUser(t, db)
	goal := createTestGoal(t, db, user.ID)
	store := postgres.NewProjectStore(db)

	project, err := store.Create(context.Background(), domain.Project{
		GoalID:      &goal.ID,
		UserID:      user.ID,
		Title:       "Backend API",
		Description: "Build REST API",
		Status:      domain.ProjectStatusActive,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if project.Title != "Backend API" {
		t.Errorf("Title = %q, want %q", project.Title, "Backend API")
	}
	if project.ID == (uuid.UUID{}) {
		t.Error("ID must not be empty")
	}
}

func TestProjectStore_List_returnsProjectsForGoal(t *testing.T) {
	db := setupDB(t)
	user := createTestUser(t, db)
	goal := createTestGoal(t, db, user.ID)
	store := postgres.NewProjectStore(db)

	for _, title := range []string{"Project A", "Project B"} {
		_, err := store.Create(context.Background(), domain.Project{
			GoalID: &goal.ID, UserID: user.ID, Title: title, Status: domain.ProjectStatusActive,
		})
		if err != nil {
			t.Fatalf("Create %s: %v", title, err)
		}
	}

	projects, err := store.List(context.Background(), user.ID, goal.ID)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(projects) != 2 {
		t.Errorf("len = %d, want 2", len(projects))
	}
}

func TestProjectStore_Get_returnsProject(t *testing.T) {
	db := setupDB(t)
	user := createTestUser(t, db)
	goal := createTestGoal(t, db, user.ID)
	store := postgres.NewProjectStore(db)

	created, err := store.Create(context.Background(), domain.Project{
		GoalID: &goal.ID, UserID: user.ID, Title: "My Project", Status: domain.ProjectStatusActive,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	got, err := store.Get(context.Background(), user.ID, created.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Title != "My Project" {
		t.Errorf("Title = %q, want %q", got.Title, "My Project")
	}
}

func TestProjectStore_Update_updatesFields(t *testing.T) {
	db := setupDB(t)
	user := createTestUser(t, db)
	goal := createTestGoal(t, db, user.ID)
	store := postgres.NewProjectStore(db)

	created, err := store.Create(context.Background(), domain.Project{
		GoalID: &goal.ID, UserID: user.ID, Title: "Old", Status: domain.ProjectStatusActive,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	created.Title = "New"
	updated, err := store.Update(context.Background(), user.ID, created)
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if updated.Title != "New" {
		t.Errorf("Title = %q, want %q", updated.Title, "New")
	}
}

func TestProjectStore_Delete_removesProject(t *testing.T) {
	db := setupDB(t)
	user := createTestUser(t, db)
	goal := createTestGoal(t, db, user.ID)
	store := postgres.NewProjectStore(db)

	created, err := store.Create(context.Background(), domain.Project{
		GoalID: &goal.ID, UserID: user.ID, Title: "Temp", Status: domain.ProjectStatusActive,
	})
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
