package postgres_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/domain"
	"github.com/lbc/echo/internal/store/postgres"
)

func createTestProject(t *testing.T, db *postgres.DB, userID uuid.UUID, goalID *uuid.UUID) domain.Project {
	t.Helper()
	store := postgres.NewProjectStore(db)
	p, err := store.Create(context.Background(), domain.Project{
		GoalID: goalID, UserID: userID, Title: "Test Project", Status: domain.ProjectStatusActive,
	})
	if err != nil {
		t.Fatalf("createTestProject: %v", err)
	}
	return p
}

func TestTaskStore_Create_storesTask(t *testing.T) {
	db := setupDB(t)
	user := createTestUser(t, db)
	goal := createTestGoal(t, db, user.ID)
	project := createTestProject(t, db, user.ID, &goal.ID)
	store := postgres.NewTaskStore(db)

	task, err := store.Create(context.Background(), domain.Task{
		ProjectID: &project.ID,
		UserID:    user.ID,
		Title:     "Write tests",
		Status:    domain.TaskStatusTodo,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if task.Title != "Write tests" {
		t.Errorf("Title = %q, want %q", task.Title, "Write tests")
	}
	if task.ID == (uuid.UUID{}) {
		t.Error("ID must not be empty")
	}
}

func TestTaskStore_List_returnsTasksForProject(t *testing.T) {
	db := setupDB(t)
	user := createTestUser(t, db)
	goal := createTestGoal(t, db, user.ID)
	project := createTestProject(t, db, user.ID, &goal.ID)
	store := postgres.NewTaskStore(db)

	for _, title := range []string{"Task 1", "Task 2", "Task 3"} {
		_, err := store.Create(context.Background(), domain.Task{
			ProjectID: &project.ID, UserID: user.ID, Title: title, Status: domain.TaskStatusTodo,
		})
		if err != nil {
			t.Fatalf("Create %s: %v", title, err)
		}
	}

	tasks, err := store.List(context.Background(), user.ID, project.ID)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(tasks) != 3 {
		t.Errorf("len = %d, want 3", len(tasks))
	}
}

func TestTaskStore_Update_updatesStatus(t *testing.T) {
	db := setupDB(t)
	user := createTestUser(t, db)
	goal := createTestGoal(t, db, user.ID)
	project := createTestProject(t, db, user.ID, &goal.ID)
	store := postgres.NewTaskStore(db)

	created, err := store.Create(context.Background(), domain.Task{
		ProjectID: &project.ID, UserID: user.ID, Title: "Do thing", Status: domain.TaskStatusTodo,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	created.Status = domain.TaskStatusDone
	updated, err := store.Update(context.Background(), user.ID, created)
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if updated.Status != domain.TaskStatusDone {
		t.Errorf("Status = %q, want %q", updated.Status, domain.TaskStatusDone)
	}
}

func TestTaskStore_Delete_removesTask(t *testing.T) {
	db := setupDB(t)
	user := createTestUser(t, db)
	goal := createTestGoal(t, db, user.ID)
	project := createTestProject(t, db, user.ID, &goal.ID)
	store := postgres.NewTaskStore(db)

	created, err := store.Create(context.Background(), domain.Task{
		ProjectID: &project.ID, UserID: user.ID, Title: "Temp task", Status: domain.TaskStatusTodo,
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
