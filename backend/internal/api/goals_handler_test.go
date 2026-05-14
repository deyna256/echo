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
	"github.com/lbc/echo/internal/auth"
	"github.com/lbc/echo/internal/domain"
)

type stubGoalStore struct {
	goals map[uuid.UUID]domain.Goal
}

func newStubGoalStore() *stubGoalStore {
	return &stubGoalStore{goals: map[uuid.UUID]domain.Goal{}}
}

func (s *stubGoalStore) Create(ctx context.Context, g domain.Goal) (domain.Goal, error) {
	g.ID = uuid.New()
	g.CreatedAt = time.Now()
	g.UpdatedAt = time.Now()
	s.goals[g.ID] = g
	return g, nil
}

func (s *stubGoalStore) List(ctx context.Context, userID uuid.UUID) ([]domain.Goal, error) {
	var result []domain.Goal
	for _, g := range s.goals {
		if g.UserID == userID {
			result = append(result, g)
		}
	}
	return result, nil
}

func (s *stubGoalStore) Get(ctx context.Context, userID, id uuid.UUID) (domain.Goal, error) {
	g, ok := s.goals[id]
	if !ok || g.UserID != userID {
		return domain.Goal{}, fmt.Errorf("get goal: %w", domain.ErrNotFound)
	}
	return g, nil
}

func (s *stubGoalStore) Update(ctx context.Context, userID uuid.UUID, g domain.Goal) (domain.Goal, error) {
	existing, ok := s.goals[g.ID]
	if !ok || existing.UserID != userID {
		return domain.Goal{}, fmt.Errorf("update goal: %w", domain.ErrNotFound)
	}
	g.UpdatedAt = time.Now()
	s.goals[g.ID] = g
	return g, nil
}

func (s *stubGoalStore) Delete(ctx context.Context, userID, id uuid.UUID) error {
	g, ok := s.goals[id]
	if !ok || g.UserID != userID {
		return fmt.Errorf("not found")
	}
	delete(s.goals, id)
	return nil
}

func authHeader(t *testing.T, userID uuid.UUID) string {
	t.Helper()
	token, err := auth.Sign(userID, testSecret, time.Hour)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return "Bearer " + token
}

func TestGoalsHandler_Create_returnsGoal(t *testing.T) {
	store := newStubGoalStore()
	h := api.NewGoalsHandler(store, testSecret, slog.Default(), nil)

	body, _ := json.Marshal(map[string]string{"title": "Learn Go", "description": "Master Go"})
	req := httptest.NewRequest(http.MethodPost, "/goals", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader(t, uuid.New()))
	rr := httptest.NewRecorder()

	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d; body: %s", rr.Code, http.StatusCreated, rr.Body.String())
	}

	var goal domain.Goal
	if err := json.NewDecoder(rr.Body).Decode(&goal); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if goal.Title != "Learn Go" {
		t.Errorf("title = %q, want %q", goal.Title, "Learn Go")
	}
}

func TestGoalsHandler_List_returnsGoals(t *testing.T) {
	store := newStubGoalStore()
	userID := uuid.New()

	store.goals[uuid.New()] = domain.Goal{ID: uuid.New(), UserID: userID, Title: "G1", Status: domain.GoalStatusActive}
	store.goals[uuid.New()] = domain.Goal{ID: uuid.New(), UserID: userID, Title: "G2", Status: domain.GoalStatusActive}

	h := api.NewGoalsHandler(store, testSecret, slog.Default(), nil)

	req := httptest.NewRequest(http.MethodGet, "/goals", nil)
	req.Header.Set("Authorization", authHeader(t, userID))
	rr := httptest.NewRecorder()

	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", rr.Code, http.StatusOK, rr.Body.String())
	}

	var goals []domain.Goal
	if err := json.NewDecoder(rr.Body).Decode(&goals); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(goals) != 2 {
		t.Errorf("got %d goals, want 2", len(goals))
	}
}

func TestGoalsHandler_NoToken_returns401(t *testing.T) {
	store := newStubGoalStore()
	h := api.NewGoalsHandler(store, testSecret, slog.Default(), nil)

	req := httptest.NewRequest(http.MethodGet, "/goals", nil)
	rr := httptest.NewRecorder()

	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}
}
