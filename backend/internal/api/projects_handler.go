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

type projectStore interface {
	Create(ctx context.Context, p domain.Project) (domain.Project, error)
	List(ctx context.Context, userID, goalID uuid.UUID) ([]domain.Project, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.Project, error)
	ListUnattached(ctx context.Context, userID uuid.UUID) ([]domain.Project, error)
	Get(ctx context.Context, userID, id uuid.UUID) (domain.Project, error)
	Update(ctx context.Context, userID uuid.UUID, p domain.Project) (domain.Project, error)
	Delete(ctx context.Context, userID, id uuid.UUID) error
}

type ProjectsHandler struct {
	store     projectStore
	jwtSecret string
	log       *slog.Logger
	mux       *http.ServeMux
}

func NewProjectsHandler(store projectStore, jwtSecret string, log *slog.Logger) *ProjectsHandler {
	h := &ProjectsHandler{
		store:     store,
		jwtSecret: jwtSecret,
		log:       log,
		mux:       http.NewServeMux(),
	}

	h.mux.Handle("GET /goals/{goalID}/projects", jwtMiddleware(jwtSecret, http.HandlerFunc(h.list)))
	h.mux.Handle("GET /projects", jwtMiddleware(jwtSecret, http.HandlerFunc(h.listByUser)))
	h.mux.Handle("GET /projects/unattached", jwtMiddleware(jwtSecret, http.HandlerFunc(h.listUnattached)))
	h.mux.Handle("POST /goals/{goalID}/projects", jwtMiddleware(jwtSecret, http.HandlerFunc(h.create)))
	h.mux.Handle("POST /projects", jwtMiddleware(jwtSecret, http.HandlerFunc(h.createStandalone)))
	h.mux.Handle("GET /goals/{goalID}/projects/{id}", jwtMiddleware(jwtSecret, http.HandlerFunc(h.get)))
	h.mux.Handle("PUT /goals/{goalID}/projects/{id}", jwtMiddleware(jwtSecret, http.HandlerFunc(h.update)))
	h.mux.Handle("PATCH /projects/{id}", jwtMiddleware(jwtSecret, http.HandlerFunc(h.updateStandalone)))
	h.mux.Handle("PATCH /projects/{id}/attach", jwtMiddleware(jwtSecret, http.HandlerFunc(h.attachToGoal)))
	h.mux.Handle("DELETE /projects/{id}", jwtMiddleware(jwtSecret, http.HandlerFunc(h.deleteStandalone)))
	h.mux.Handle("DELETE /goals/{goalID}/projects/{id}", jwtMiddleware(jwtSecret, http.HandlerFunc(h.delete)))

	return h
}

func (h *ProjectsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.mux.ServeHTTP(w, r)
}

type projectRequest struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	TargetDate  *string `json:"target_date"`
	Status      string  `json:"status"`
	GoalID      *string `json:"goal_id"`
}

func (h *ProjectsHandler) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	goalID, err := uuid.Parse(r.PathValue("goalID"))
	if err != nil {
		http.Error(w, "invalid goalID", http.StatusBadRequest)
		return
	}

	projects, err := h.store.List(r.Context(), userID, goalID)
	if err != nil {
		h.log.ErrorContext(r.Context(), "list projects", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if projects == nil {
		projects = []domain.Project{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(projects)
}

func (h *ProjectsHandler) listByUser(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	projects, err := h.store.ListByUser(r.Context(), userID)
	if err != nil {
		h.log.ErrorContext(r.Context(), "list projects by user", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if projects == nil {
		projects = []domain.Project{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(projects)
}

func (h *ProjectsHandler) listUnattached(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	projects, err := h.store.ListUnattached(r.Context(), userID)
	if err != nil {
		h.log.ErrorContext(r.Context(), "list unattached projects", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if projects == nil {
		projects = []domain.Project{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(projects)
}

func (h *ProjectsHandler) create(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	goalID, err := uuid.Parse(r.PathValue("goalID"))
	if err != nil {
		http.Error(w, "invalid goalID", http.StatusBadRequest)
		return
	}

	var req projectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		http.Error(w, "title required", http.StatusBadRequest)
		return
	}

	status := domain.ProjectStatus(req.Status)
	if status == "" {
		status = domain.ProjectStatusActive
	}

	p := domain.Project{
		GoalID:      &goalID,
		UserID:      userID,
		Title:       req.Title,
		Description: req.Description,
		Status:      status,
	}

	created, err := h.store.Create(r.Context(), p)
	if err != nil {
		h.log.ErrorContext(r.Context(), "create project", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

func (h *ProjectsHandler) createStandalone(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req projectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		http.Error(w, "title required", http.StatusBadRequest)
		return
	}

	status := domain.ProjectStatus(req.Status)
	if status == "" {
		status = domain.ProjectStatusActive
	}

	p := domain.Project{
		UserID:      userID,
		Title:       req.Title,
		Description: req.Description,
		Status:      status,
	}

	created, err := h.store.Create(r.Context(), p)
	if err != nil {
		h.log.ErrorContext(r.Context(), "create project", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

func (h *ProjectsHandler) get(w http.ResponseWriter, r *http.Request) {
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

	project, err := h.store.Get(r.Context(), userID, id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		h.log.ErrorContext(r.Context(), "get project", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(project)
}

func (h *ProjectsHandler) update(w http.ResponseWriter, r *http.Request) {
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
		h.log.ErrorContext(r.Context(), "get project", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	var req projectRequest
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
		existing.Status = domain.ProjectStatus(req.Status)
	}
	if req.GoalID != nil {
		goalID, err := uuid.Parse(*req.GoalID)
		if err == nil {
			existing.GoalID = &goalID
		}
	}

	updated, err := h.store.Update(r.Context(), userID, existing)
	if err != nil {
		h.log.ErrorContext(r.Context(), "update project", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

func (h *ProjectsHandler) delete(w http.ResponseWriter, r *http.Request) {
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
		h.log.ErrorContext(r.Context(), "delete project", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *ProjectsHandler) deleteStandalone(w http.ResponseWriter, r *http.Request) {
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
		h.log.ErrorContext(r.Context(), "delete project", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *ProjectsHandler) updateStandalone(w http.ResponseWriter, r *http.Request) {
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
		h.log.ErrorContext(r.Context(), "get project", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	var req projectRequest
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
		existing.Status = domain.ProjectStatus(req.Status)
	}
	if req.GoalID != nil {
		goalID, err := uuid.Parse(*req.GoalID)
		if err == nil {
			existing.GoalID = &goalID
		}
	}

	updated, err := h.store.Update(r.Context(), userID, existing)
	if err != nil {
		h.log.ErrorContext(r.Context(), "update project", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

func (h *ProjectsHandler) attachToGoal(w http.ResponseWriter, r *http.Request) {
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

	var req projectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	if req.GoalID == nil {
		http.Error(w, "goal_id required", http.StatusBadRequest)
		return
	}

	goalID, err := uuid.Parse(*req.GoalID)
	if err != nil {
		http.Error(w, "invalid goal_id", http.StatusBadRequest)
		return
	}

	existing, err := h.store.Get(r.Context(), userID, id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		h.log.ErrorContext(r.Context(), "get project", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	existing.GoalID = &goalID
	updated, err := h.store.Update(r.Context(), userID, existing)
	if err != nil {
		h.log.ErrorContext(r.Context(), "update project", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}
