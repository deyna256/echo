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

type stubProjectStore struct {
	projects map[uuid.UUID]domain.Project
}

func newStubProjectStore() *stubProjectStore {
	return &stubProjectStore{projects: map[uuid.UUID]domain.Project{}}
}

func (s *stubProjectStore) Create(ctx context.Context, p domain.Project) (domain.Project, error) {
	p.ID = uuid.New()
	p.CreatedAt = time.Now()
	p.UpdatedAt = time.Now()
	s.projects[p.ID] = p
	return p, nil
}

func (s *stubProjectStore) List(ctx context.Context, userID, goalID uuid.UUID) ([]domain.Project, error) {
	var result []domain.Project
	for _, p := range s.projects {
		if p.UserID == userID && p.GoalID != nil && *p.GoalID == goalID {
			result = append(result, p)
		}
	}
	return result, nil
}

func (s *stubProjectStore) ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.Project, error) {
	var result []domain.Project
	for _, p := range s.projects {
		if p.UserID == userID {
			result = append(result, p)
		}
	}
	return result, nil
}

func (s *stubProjectStore) ListUnattached(ctx context.Context, userID uuid.UUID) ([]domain.Project, error) {
	var result []domain.Project
	for _, p := range s.projects {
		if p.UserID == userID && p.GoalID == nil {
			result = append(result, p)
		}
	}
	return result, nil
}

func (s *stubProjectStore) Get(ctx context.Context, userID, id uuid.UUID) (domain.Project, error) {
	p, ok := s.projects[id]
	if !ok || p.UserID != userID {
		return domain.Project{}, fmt.Errorf("get project: %w", domain.ErrNotFound)
	}
	return p, nil
}

func (s *stubProjectStore) Update(ctx context.Context, userID uuid.UUID, p domain.Project) (domain.Project, error) {
	existing, ok := s.projects[p.ID]
	if !ok || existing.UserID != userID {
		return domain.Project{}, fmt.Errorf("update project: %w", domain.ErrNotFound)
	}
	p.UpdatedAt = time.Now()
	s.projects[p.ID] = p
	return p, nil
}

func (s *stubProjectStore) Delete(ctx context.Context, userID, id uuid.UUID) error {
	p, ok := s.projects[id]
	if !ok || p.UserID != userID {
		return fmt.Errorf("not found")
	}
	delete(s.projects, id)
	return nil
}

func TestProjectsHandler_Create_returnsProject(t *testing.T) {
	store := newStubProjectStore()
	goalID := uuid.New()
	userID := uuid.New()
	h := api.NewProjectsHandler(store, testSecret, slog.Default())

	body, _ := json.Marshal(map[string]string{"title": "Backend API"})
	req := httptest.NewRequest(http.MethodPost, "/goals/"+goalID.String()+"/projects", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader(t, userID))
	rr := httptest.NewRecorder()

	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d; body: %s", rr.Code, http.StatusCreated, rr.Body.String())
	}

	var proj domain.Project
	if err := json.NewDecoder(rr.Body).Decode(&proj); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if proj.Title != "Backend API" {
		t.Errorf("title = %q, want %q", proj.Title, "Backend API")
	}
	if proj.GoalID == nil || *proj.GoalID != goalID {
		t.Errorf("goalID = %v, want %v", proj.GoalID, goalID)
	}
}

func TestProjectsHandler_NoToken_returns401(t *testing.T) {
	store := newStubProjectStore()
	goalID := uuid.New()
	h := api.NewProjectsHandler(store, testSecret, slog.Default())

	req := httptest.NewRequest(http.MethodGet, "/goals/"+goalID.String()+"/projects", nil)
	rr := httptest.NewRecorder()

	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}
}
