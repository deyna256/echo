package api

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/domain"
)

type goalStore interface {
	Create(ctx context.Context, g domain.Goal) (domain.Goal, error)
	List(ctx context.Context, userID uuid.UUID) ([]domain.Goal, error)
	Get(ctx context.Context, userID, id uuid.UUID) (domain.Goal, error)
	Update(ctx context.Context, userID uuid.UUID, g domain.Goal) (domain.Goal, error)
	Delete(ctx context.Context, userID, id uuid.UUID) error
}

type goalDecomposer interface {
	Decompose(ctx context.Context, goal domain.Goal)
}

type GoalsHandler struct {
	store      goalStore
	jwtSecret  string
	log        *slog.Logger
	decomposer goalDecomposer
	mux        *http.ServeMux
}

func NewGoalsHandler(store goalStore, jwtSecret string, log *slog.Logger, decomposer goalDecomposer) *GoalsHandler {
	h := &GoalsHandler{
		store:      store,
		jwtSecret:  jwtSecret,
		log:        log,
		decomposer: decomposer,
		mux:        http.NewServeMux(),
	}

	h.mux.Handle("GET /goals", jwtMiddleware(jwtSecret, http.HandlerFunc(h.list)))
	h.mux.Handle("POST /goals", jwtMiddleware(jwtSecret, http.HandlerFunc(h.create)))
	h.mux.Handle("GET /goals/{id}", jwtMiddleware(jwtSecret, http.HandlerFunc(h.get)))
	h.mux.Handle("PUT /goals/{id}", jwtMiddleware(jwtSecret, http.HandlerFunc(h.update)))
	h.mux.Handle("DELETE /goals/{id}", jwtMiddleware(jwtSecret, http.HandlerFunc(h.delete)))

	return h
}

func (h *GoalsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.mux.ServeHTTP(w, r)
}

type goalRequest struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	TargetDate  *string `json:"target_date"`
	Status      string  `json:"status"`
}

func (h *GoalsHandler) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	goals, err := h.store.List(r.Context(), userID)
	if err != nil {
		h.log.ErrorContext(r.Context(), "list goals", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if goals == nil {
		goals = []domain.Goal{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(goals)
}

func (h *GoalsHandler) create(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req goalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		http.Error(w, "title required", http.StatusBadRequest)
		return
	}

	status := domain.GoalStatus(req.Status)
	if status == "" {
		status = domain.GoalStatusActive
	}

	g := domain.Goal{
		UserID:      userID,
		Title:       req.Title,
		Description: req.Description,
		Status:      status,
	}

	created, err := h.store.Create(r.Context(), g)
	if err != nil {
		h.log.ErrorContext(r.Context(), "create goal", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)

	if h.decomposer != nil {
		go h.decomposer.Decompose(context.Background(), created)
	}
}

func (h *GoalsHandler) get(w http.ResponseWriter, r *http.Request) {
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

	goal, err := h.store.Get(r.Context(), userID, id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		h.log.ErrorContext(r.Context(), "get goal", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(goal)
}

func (h *GoalsHandler) update(w http.ResponseWriter, r *http.Request) {
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

	existing, err := h.store.Get(r.Context(), userID, id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		h.log.ErrorContext(r.Context(), "get goal for update", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	var req goalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	if req.Title != "" {
		existing.Title = req.Title
	}
	if req.Description != "" {
		existing.Description = req.Description
	}
	if req.Status != "" {
		existing.Status = domain.GoalStatus(req.Status)
	}

	updated, err := h.store.Update(r.Context(), userID, existing)
	if err != nil {
		h.log.ErrorContext(r.Context(), "update goal", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

func (h *GoalsHandler) delete(w http.ResponseWriter, r *http.Request) {
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

	if err := h.store.Delete(r.Context(), userID, id); err != nil {
		h.log.ErrorContext(r.Context(), "delete goal", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
