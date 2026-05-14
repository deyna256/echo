package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/api"
	"github.com/lbc/echo/internal/domain"
)

type stubTaskStore struct {
	tasks map[uuid.UUID]domain.Task
}

func newStubTaskStore() *stubTaskStore {
	return &stubTaskStore{tasks: map[uuid.UUID]domain.Task{}}
}

func (s *stubTaskStore) Create(ctx context.Context, task domain.Task) (domain.Task, error) {
	task.ID = uuid.New()
	task.CreatedAt = time.Now()
	task.UpdatedAt = time.Now()
	s.tasks[task.ID] = task
	return task, nil
}

func (s *stubTaskStore) List(ctx context.Context, userID, projectID uuid.UUID) ([]domain.Task, error) {
	var result []domain.Task
	for _, t := range s.tasks {
		if t.UserID == userID && t.ProjectID != nil && *t.ProjectID == projectID {
			result = append(result, t)
		}
	}
	return result, nil
}

func (s *stubTaskStore) ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.Task, error) {
	var result []domain.Task
	for _, t := range s.tasks {
		if t.UserID == userID {
			result = append(result, t)
		}
	}
	return result, nil
}

func (s *stubTaskStore) Get(ctx context.Context, userID, id uuid.UUID) (domain.Task, error) {
	t, ok := s.tasks[id]
	if !ok || t.UserID != userID {
		return domain.Task{}, fmt.Errorf("get task: %w", domain.ErrNotFound)
	}
	return t, nil
}

func (s *stubTaskStore) Update(ctx context.Context, userID uuid.UUID, task domain.Task) (domain.Task, error) {
	existing, ok := s.tasks[task.ID]
	if !ok || existing.UserID != userID {
		return domain.Task{}, fmt.Errorf("update task: %w", domain.ErrNotFound)
	}
	task.UpdatedAt = time.Now()
	s.tasks[task.ID] = task
	return task, nil
}

func (s *stubTaskStore) Delete(ctx context.Context, userID, id uuid.UUID) error {
	t, ok := s.tasks[id]
	if !ok || t.UserID != userID {
		return fmt.Errorf("not found")
	}
	delete(s.tasks, id)
	return nil
}

func TestTasksHandler_Create_returnsTask(t *testing.T) {
	store := newStubTaskStore()
	projectID := uuid.New()
	userID := uuid.New()
	h := api.NewTasksHandler(store, testSecret, slog.Default())

	body, _ := json.Marshal(map[string]string{"title": "Write tests"})
	req := httptest.NewRequest(http.MethodPost, "/projects/"+projectID.String()+"/tasks", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader(t, userID))
	rr := httptest.NewRecorder()

	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d; body: %s", rr.Code, http.StatusCreated, rr.Body.String())
	}

	var task domain.Task
	if err := json.NewDecoder(rr.Body).Decode(&task); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if task.Title != "Write tests" {
		t.Errorf("title = %q, want %q", task.Title, "Write tests")
	}
	if task.ProjectID == nil || *task.ProjectID != projectID {
		t.Errorf("projectID = %v, want %v", task.ProjectID, projectID)
	}
}

func TestTasksHandler_NoToken_returns401(t *testing.T) {
	store := newStubTaskStore()
	projectID := uuid.New()
	h := api.NewTasksHandler(store, testSecret, slog.Default())

	req := httptest.NewRequest(http.MethodGet, "/projects/"+projectID.String()+"/tasks", nil)
	rr := httptest.NewRecorder()

	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}
}
