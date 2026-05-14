package api

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/ai"
	"github.com/lbc/echo/internal/domain"
)

type aiSuggestionStore interface {
	List(ctx context.Context, userID uuid.UUID) ([]domain.AISuggestion, error)
	Get(ctx context.Context, userID, id uuid.UUID) (domain.AISuggestion, error)
	UpdateStatus(ctx context.Context, userID, id uuid.UUID, status domain.SuggestionStatus) error
}

type materializeProjectStore interface {
	Create(ctx context.Context, p domain.Project) (domain.Project, error)
}

type materializeTaskStore interface {
	Create(ctx context.Context, task domain.Task) (domain.Task, error)
}

type SuggestionsHandler struct {
	suggestions aiSuggestionStore
	projects    materializeProjectStore
	tasks       materializeTaskStore
	jwtSecret   string
	log         *slog.Logger
	mux         *http.ServeMux
}

func NewSuggestionsHandler(
	suggestions aiSuggestionStore,
	projects materializeProjectStore,
	tasks materializeTaskStore,
	jwtSecret string,
	log *slog.Logger,
) *SuggestionsHandler {
	h := &SuggestionsHandler{
		suggestions: suggestions,
		projects:    projects,
		tasks:       tasks,
		jwtSecret:   jwtSecret,
		log:         log,
		mux:         http.NewServeMux(),
	}
	protected := func(fn http.HandlerFunc) http.Handler { return jwtMiddleware(jwtSecret, fn) }
	h.mux.Handle("GET /ai_suggestions", protected(h.list))
	h.mux.Handle("POST /ai_suggestions/{id}/accept", protected(h.accept))
	h.mux.Handle("POST /ai_suggestions/{id}/reject", protected(h.reject))
	return h
}

func (h *SuggestionsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.mux.ServeHTTP(w, r)
}

func (h *SuggestionsHandler) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	list, err := h.suggestions.List(r.Context(), userID)
	if err != nil {
		h.log.ErrorContext(r.Context(), "list suggestions", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if list == nil {
		list = []domain.AISuggestion{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

type acceptRequest struct {
	ProjectIndices []int `json:"project_indices"`
}

func (h *SuggestionsHandler) accept(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	sg, err := h.suggestions.Get(r.Context(), userID, id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		h.log.ErrorContext(r.Context(), "get suggestion for accept", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if sg.Status != domain.SuggestionStatusPending {
		http.Error(w, "suggestion already processed", http.StatusConflict)
		return
	}

	var req acceptRequest
	if r.ContentLength > 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
	}

	var suggestion ai.Suggestion
	if err := json.Unmarshal(sg.Payload, &suggestion); err != nil {
		h.log.ErrorContext(r.Context(), "unmarshal suggestion payload", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	indexSet := make(map[int]bool, len(req.ProjectIndices))
	for _, idx := range req.ProjectIndices {
		indexSet[idx] = true
	}

	for i, sp := range suggestion.Projects {
		if !indexSet[i] {
			continue
		}
		project, err := h.projects.Create(r.Context(), domain.Project{
			GoalID:      &sg.GoalID,
			UserID:      userID,
			Title:       sp.Title,
			TargetDate:  parseDate(sp.TargetDate),
			Status:      domain.ProjectStatusActive,
			AISuggested: true,
		})
		if err != nil {
			h.log.ErrorContext(r.Context(), "create project from suggestion", slog.String("error", err.Error()))
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		for pos, st := range sp.Tasks {
			if _, err := h.tasks.Create(r.Context(), domain.Task{
				ProjectID:     &project.ID,
				UserID:        userID,
				Title:         st.Title,
				ScheduledDate: parseDate(st.ScheduledDate),
				Status:        domain.TaskStatusTodo,
				AISuggested:   true,
				Position:      pos,
			}); err != nil {
				h.log.ErrorContext(r.Context(), "create task from suggestion", slog.String("error", err.Error()))
				http.Error(w, "internal error", http.StatusInternalServerError)
				return
			}
		}
	}

	if err := h.suggestions.UpdateStatus(r.Context(), userID, id, domain.SuggestionStatusAccepted); err != nil {
		h.log.ErrorContext(r.Context(), "update suggestion status", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *SuggestionsHandler) reject(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	sg, err := h.suggestions.Get(r.Context(), userID, id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		h.log.ErrorContext(r.Context(), "get suggestion for reject", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if sg.Status != domain.SuggestionStatusPending {
		http.Error(w, "suggestion already processed", http.StatusConflict)
		return
	}
	if err := h.suggestions.UpdateStatus(r.Context(), userID, id, domain.SuggestionStatusRejected); err != nil {
		h.log.ErrorContext(r.Context(), "reject suggestion", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func parseDate(s string) *time.Time {
	if s == "" {
		return nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil
	}
	return &t
}