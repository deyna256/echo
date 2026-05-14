package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/ai"
	"github.com/lbc/echo/internal/api"
	"github.com/lbc/echo/internal/domain"
)

type stubAISuggestionStore struct {
	suggestions map[uuid.UUID]domain.AISuggestion
}

func newStubAISuggestionStore() *stubAISuggestionStore {
	return &stubAISuggestionStore{suggestions: map[uuid.UUID]domain.AISuggestion{}}
}

func (s *stubAISuggestionStore) List(ctx context.Context, userID uuid.UUID) ([]domain.AISuggestion, error) {
	var result []domain.AISuggestion
	for _, sg := range s.suggestions {
		if sg.UserID == userID {
			result = append(result, sg)
		}
	}
	return result, nil
}

func (s *stubAISuggestionStore) Get(ctx context.Context, userID, id uuid.UUID) (domain.AISuggestion, error) {
	sg, ok := s.suggestions[id]
	if !ok || sg.UserID != userID {
		return domain.AISuggestion{}, domain.ErrNotFound
	}
	return sg, nil
}

func (s *stubAISuggestionStore) UpdateStatus(ctx context.Context, userID, id uuid.UUID, status domain.SuggestionStatus) error {
	sg, ok := s.suggestions[id]
	if !ok {
		return domain.ErrNotFound
	}
	sg.Status = status
	s.suggestions[id] = sg
	return nil
}

type stubMaterializeProjectStore struct {
	created []domain.Project
}

func (s *stubMaterializeProjectStore) Create(ctx context.Context, p domain.Project) (domain.Project, error) {
	p.ID = uuid.New()
	p.CreatedAt = time.Now()
	p.UpdatedAt = time.Now()
	s.created = append(s.created, p)
	return p, nil
}

type stubMaterializeTaskStore struct {
	created []domain.Task
}

func (s *stubMaterializeTaskStore) Create(ctx context.Context, task domain.Task) (domain.Task, error) {
	task.ID = uuid.New()
	task.CreatedAt = time.Now()
	task.UpdatedAt = time.Now()
	s.created = append(s.created, task)
	return task, nil
}

func seedSuggestion(t *testing.T, store *stubAISuggestionStore, userID, goalID uuid.UUID, suggestion ai.Suggestion) domain.AISuggestion {
	t.Helper()
	payload, err := json.Marshal(suggestion)
	if err != nil {
		t.Fatalf("marshal suggestion: %v", err)
	}
	id := uuid.New()
	sg := domain.AISuggestion{
		ID:        id,
		UserID:    userID,
		GoalID:    goalID,
		Payload:   payload,
		Status:    domain.SuggestionStatusPending,
		CreatedAt: time.Now(),
	}
	store.suggestions[id] = sg
	return sg
}

func TestSuggestionsHandler_List_returnsSuggestions(t *testing.T) {
	store := newStubAISuggestionStore()
	h := api.NewSuggestionsHandler(store, &stubMaterializeProjectStore{}, &stubMaterializeTaskStore{}, testSecret, slog.Default())
	userID := uuid.New()

	seedSuggestion(t, store, userID, uuid.New(), ai.Suggestion{Projects: []ai.SuggestedProject{{Title: "P1"}}})

	req := httptest.NewRequest(http.MethodGet, "/ai_suggestions", nil)
	req.Header.Set("Authorization", authHeader(t, userID))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("status = %d, want %d; body: %s", rr.Code, http.StatusOK, rr.Body.String())
	}
	var list []domain.AISuggestion
	if err := json.NewDecoder(rr.Body).Decode(&list); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(list) != 1 {
		t.Errorf("len = %d, want 1", len(list))
	}
}

func TestSuggestionsHandler_Accept_materializesProjects(t *testing.T) {
	store := newStubAISuggestionStore()
	projectStore := &stubMaterializeProjectStore{}
	taskStore := &stubMaterializeTaskStore{}
	h := api.NewSuggestionsHandler(store, projectStore, taskStore, testSecret, slog.Default())

	userID := uuid.New()
	goalID := uuid.New()
	suggestion := ai.Suggestion{
		Projects: []ai.SuggestedProject{
			{Title: "Backend", TargetDate: "2026-06-01", Tasks: []ai.SuggestedTask{
				{Title: "Setup DB", ScheduledDate: "2026-05-10"},
				{Title: "Write tests", ScheduledDate: "2026-05-15"},
			}},
			{Title: "Frontend", TargetDate: "2026-07-01", Tasks: []ai.SuggestedTask{
				{Title: "Design UI", ScheduledDate: "2026-06-10"},
			}},
		},
	}
	sg := seedSuggestion(t, store, userID, goalID, suggestion)

	body, _ := json.Marshal(map[string]any{"project_indices": []int{0}})
	req := httptest.NewRequest(http.MethodPost, "/ai_suggestions/"+sg.ID.String()+"/accept", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader(t, userID))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d; body: %s", rr.Code, http.StatusNoContent, rr.Body.String())
	}
	if len(projectStore.created) != 1 {
		t.Errorf("projects created = %d, want 1", len(projectStore.created))
	}
	if projectStore.created[0].Title != "Backend" {
		t.Errorf("project title = %q, want %q", projectStore.created[0].Title, "Backend")
	}
	if !projectStore.created[0].AISuggested {
		t.Error("project.AISuggested must be true")
	}
	if len(taskStore.created) != 2 {
		t.Errorf("tasks created = %d, want 2", len(taskStore.created))
	}

	updated := store.suggestions[sg.ID]
	if updated.Status != domain.SuggestionStatusAccepted {
		t.Errorf("status = %q, want %q", updated.Status, domain.SuggestionStatusAccepted)
	}
}

func TestSuggestionsHandler_Reject_updatesStatus(t *testing.T) {
	store := newStubAISuggestionStore()
	h := api.NewSuggestionsHandler(store, &stubMaterializeProjectStore{}, &stubMaterializeTaskStore{}, testSecret, slog.Default())

	userID := uuid.New()
	sg := seedSuggestion(t, store, userID, uuid.New(), ai.Suggestion{})

	req := httptest.NewRequest(http.MethodPost, "/ai_suggestions/"+sg.ID.String()+"/reject", nil)
	req.Header.Set("Authorization", authHeader(t, userID))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusNoContent)
	}
	updated := store.suggestions[sg.ID]
	if updated.Status != domain.SuggestionStatusRejected {
		t.Errorf("status = %q, want %q", updated.Status, domain.SuggestionStatusRejected)
	}
}

func TestSuggestionsHandler_NoToken_returns401(t *testing.T) {
	h := api.NewSuggestionsHandler(newStubAISuggestionStore(), &stubMaterializeProjectStore{}, &stubMaterializeTaskStore{}, testSecret, slog.Default())
	req := httptest.NewRequest(http.MethodGet, "/ai_suggestions", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}
}
