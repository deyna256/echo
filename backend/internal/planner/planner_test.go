package planner_test

import (
	"context"
	"encoding/json"
	"log/slog"
	"testing"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/ai"
	"github.com/lbc/echo/internal/domain"
	"github.com/lbc/echo/internal/planner"
)

type mockAI struct {
	result ai.Suggestion
	err    error
}

func (m *mockAI) Decompose(ctx context.Context, goal domain.Goal) (ai.Suggestion, error) {
	return m.result, m.err
}

type mockSuggestionStore struct {
	created []domain.AISuggestion
}

func (m *mockSuggestionStore) Create(ctx context.Context, userID, goalID uuid.UUID, payload []byte) (domain.AISuggestion, error) {
	s := domain.AISuggestion{
		ID:      uuid.New(),
		UserID:  userID,
		GoalID:  goalID,
		Payload: payload,
		Status:  domain.SuggestionStatusPending,
	}
	m.created = append(m.created, s)
	return s, nil
}

func TestPlanner_Decompose_savesSuggestion(t *testing.T) {
	suggestion := ai.Suggestion{
		Projects: []ai.SuggestedProject{
			{Title: "Backend", TargetDate: "2026-06-01", Tasks: []ai.SuggestedTask{
				{Title: "Setup DB", ScheduledDate: "2026-05-10"},
			}},
		},
	}
	aiClient := &mockAI{result: suggestion}
	store := &mockSuggestionStore{}
	p := planner.New(aiClient, store, slog.Default())

	goal := domain.Goal{ID: uuid.New(), UserID: uuid.New(), Title: "Learn Go"}
	p.Decompose(context.Background(), goal)

	if len(store.created) != 1 {
		t.Fatalf("created = %d, want 1", len(store.created))
	}
	var got ai.Suggestion
	if err := json.Unmarshal(store.created[0].Payload, &got); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}
	if len(got.Projects) != 1 {
		t.Errorf("projects = %d, want 1", len(got.Projects))
	}
	if got.Projects[0].Title != "Backend" {
		t.Errorf("Title = %q, want %q", got.Projects[0].Title, "Backend")
	}
}

func TestPlanner_Decompose_aiError_skipsStore(t *testing.T) {
	aiClient := &mockAI{err: context.DeadlineExceeded}
	store := &mockSuggestionStore{}
	p := planner.New(aiClient, store, slog.Default())

	goal := domain.Goal{ID: uuid.New(), UserID: uuid.New(), Title: "Test"}
	p.Decompose(context.Background(), goal)

	if len(store.created) != 0 {
		t.Errorf("created = %d, want 0 (should skip store on AI error)", len(store.created))
	}
}
