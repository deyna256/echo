package ai_test

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/ai"
	"github.com/lbc/echo/internal/domain"
)

func TestMinimaxClient_Decompose_parsesProjects(t *testing.T) {
	suggestion := ai.Suggestion{
		Projects: []ai.SuggestedProject{
			{
				Title:      "Backend API",
				TargetDate: "2026-06-01",
				Tasks: []ai.SuggestedTask{
					{Title: "Setup DB", ScheduledDate: "2026-05-10"},
				},
			},
		},
	}
	payload, _ := json.Marshal(suggestion)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-api-key" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"base_resp": map[string]any{"status_code": 0, "status_msg": "success"},
			"content": []any{
				map[string]any{"type": "text", "text": string(payload)},
			},
			"usage": map[string]any{"input_tokens": 10, "output_tokens": 246},
		})
	}))
	defer srv.Close()

	client := ai.NewMinimaxClient("test-api-key", srv.URL, slog.Default())
	goal := domain.Goal{
		ID:          uuid.New(),
		Title:       "Launch Echo MVP",
		Description: "Ship the product",
		TargetDate:  func() *time.Time { t := time.Now().Add(90 * 24 * time.Hour); return &t }(),
	}

	got, err := client.Decompose(context.Background(), goal)
	if err != nil {
		t.Fatalf("Decompose: %v", err)
	}
	if len(got.Projects) != 1 {
		t.Fatalf("len(Projects) = %d, want 1", len(got.Projects))
	}
	if got.Projects[0].Title != "Backend API" {
		t.Errorf("Title = %q, want %q", got.Projects[0].Title, "Backend API")
	}
	if len(got.Projects[0].Tasks) != 1 {
		t.Errorf("len(Tasks) = %d, want 1", len(got.Projects[0].Tasks))
	}
}

func TestMinimaxClient_Decompose_extractsJSONFromProse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"base_resp": map[string]any{"status_code": 0},
			"content": []any{
				map[string]any{
					"type": "text",
					"text": `Here is your plan: {"projects":[{"title":"Auth","target_date":"2026-06-01","tasks":[{"title":"Setup JWT","scheduled_date":"2026-05-15"}]}]}`,
				},
			},
			"usage": map[string]any{"input_tokens": 10, "output_tokens": 90},
		})
	}))
	defer srv.Close()

	client := ai.NewMinimaxClient("key", srv.URL, slog.Default())
	goal := domain.Goal{Title: "Build app"}

	got, err := client.Decompose(context.Background(), goal)
	if err != nil {
		t.Fatalf("Decompose: %v", err)
	}
	if len(got.Projects) != 1 {
		t.Errorf("len(Projects) = %d, want 1", len(got.Projects))
	}
}

func TestMinimaxClient_Decompose_apiError_returnsError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "service unavailable", http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	client := ai.NewMinimaxClient("key", srv.URL, slog.Default())
	goal := domain.Goal{Title: "Test"}

	_, err := client.Decompose(context.Background(), goal)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}
