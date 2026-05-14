package api

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/domain"
)

const defaultDuration = 10

func parseTaskDate(s *string) *time.Time {
	if s == nil {
		return nil
	}
	if t, err := time.Parse(time.RFC3339, *s); err == nil {
		return &t
	}
	if t, err := time.Parse("2006-01-02", *s); err == nil {
		return &t
	}
	return nil
}

type taskStore interface {
	Create(ctx context.Context, task domain.Task) (domain.Task, error)
	List(ctx context.Context, userID, projectID uuid.UUID) ([]domain.Task, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.Task, error)
	Get(ctx context.Context, userID, id uuid.UUID) (domain.Task, error)
	Update(ctx context.Context, userID uuid.UUID, task domain.Task) (domain.Task, error)
	Delete(ctx context.Context, userID, id uuid.UUID) error
}

type TasksHandler struct {
	store     taskStore
	jwtSecret string
	log       *slog.Logger
	mux       *http.ServeMux
}

func NewTasksHandler(store taskStore, jwtSecret string, log *slog.Logger) *TasksHandler {
	h := &TasksHandler{
		store:     store,
		jwtSecret: jwtSecret,
		log:       log,
		mux:       http.NewServeMux(),
	}

	h.mux.Handle("GET /projects/{projectID}/tasks", jwtMiddleware(jwtSecret, http.HandlerFunc(h.list)))
	h.mux.Handle("GET /tasks", jwtMiddleware(jwtSecret, http.HandlerFunc(h.listByUser)))
	h.mux.Handle("POST /projects/{projectID}/tasks", jwtMiddleware(jwtSecret, http.HandlerFunc(h.create)))
	h.mux.Handle("POST /tasks", jwtMiddleware(jwtSecret, http.HandlerFunc(h.createStandalone)))
	h.mux.Handle("PUT /tasks/{id}", jwtMiddleware(jwtSecret, http.HandlerFunc(h.updateStandalone)))
	h.mux.Handle("PATCH /tasks/{id}", jwtMiddleware(jwtSecret, http.HandlerFunc(h.updateStandalone)))
	h.mux.Handle("GET /projects/{projectID}/tasks/{id}", jwtMiddleware(jwtSecret, http.HandlerFunc(h.get)))
	h.mux.Handle("PUT /projects/{projectID}/tasks/{id}", jwtMiddleware(jwtSecret, http.HandlerFunc(h.update)))
	h.mux.Handle("DELETE /projects/{projectID}/tasks/{id}", jwtMiddleware(jwtSecret, http.HandlerFunc(h.delete)))

	return h
}

func (h *TasksHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.mux.ServeHTTP(w, r)
}

type taskRequest struct {
	Title           string  `json:"title"`
	Description     string  `json:"description"`
	ScheduledDate   *string `json:"scheduled_date"`
	DurationMinutes int     `json:"duration_minutes"`
	Status          string  `json:"status"`
	Position        int     `json:"position"`
	Color           *string `json:"color"`
	ProjectID       *string `json:"project_id"`
}

func (h *TasksHandler) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		http.Error(w, "invalid projectID", http.StatusBadRequest)
		return
	}

	tasks, err := h.store.List(r.Context(), userID, projectID)
	if err != nil {
		h.log.ErrorContext(r.Context(), "list tasks", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if tasks == nil {
		tasks = []domain.Task{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tasks)
}

func (h *TasksHandler) listByUser(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	tasks, err := h.store.ListByUser(r.Context(), userID)
	if err != nil {
		h.log.ErrorContext(r.Context(), "list tasks by user", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if tasks == nil {
		tasks = []domain.Task{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tasks)
}

func (h *TasksHandler) create(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	projectID, err := uuid.Parse(r.PathValue("projectID"))
	if err != nil {
		http.Error(w, "invalid projectID", http.StatusBadRequest)
		return
	}

	var req taskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		http.Error(w, "title required", http.StatusBadRequest)
		return
	}

	status := domain.TaskStatus(req.Status)
	if status == "" {
		status = domain.TaskStatusTodo
	}

	scheduledDate := parseTaskDate(req.ScheduledDate)

	durationMinutes := req.DurationMinutes
	if durationMinutes == 0 {
		durationMinutes = defaultDuration
	}

	task := domain.Task{
		ProjectID:       &projectID,
		UserID:          userID,
		Title:           req.Title,
		Description:     req.Description,
		ScheduledDate:   scheduledDate,
		DurationMinutes: durationMinutes,
		Status:          status,
		Position:        req.Position,
		Color:           req.Color,
	}

	created, err := h.store.Create(r.Context(), task)
	if err != nil {
		h.log.ErrorContext(r.Context(), "create task", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

func (h *TasksHandler) createStandalone(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req taskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		http.Error(w, "title required", http.StatusBadRequest)
		return
	}

	status := domain.TaskStatus(req.Status)
	if status == "" {
		status = domain.TaskStatusTodo
	}

	scheduledDate := parseTaskDate(req.ScheduledDate)

	durationMinutes := req.DurationMinutes
	if durationMinutes == 0 {
		durationMinutes = defaultDuration
	}

	task := domain.Task{
		UserID:          userID,
		Title:           req.Title,
		Description:     req.Description,
		ScheduledDate:   scheduledDate,
		DurationMinutes: durationMinutes,
		Status:          status,
		Position:        req.Position,
		Color:           req.Color,
	}

	created, err := h.store.Create(r.Context(), task)
	if err != nil {
		h.log.ErrorContext(r.Context(), "create task", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

func (h *TasksHandler) get(w http.ResponseWriter, r *http.Request) {
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

	task, err := h.store.Get(r.Context(), userID, id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		h.log.ErrorContext(r.Context(), "get task", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(task)
}

func (h *TasksHandler) update(w http.ResponseWriter, r *http.Request) {
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
		h.log.ErrorContext(r.Context(), "get task for update", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	var req taskRequest
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
		existing.Status = domain.TaskStatus(req.Status)
	}
	if req.Position != 0 {
		existing.Position = req.Position
	}
	if req.ScheduledDate != nil {
		existing.ScheduledDate = parseTaskDate(req.ScheduledDate)
	}
	if req.DurationMinutes > 0 {
		existing.DurationMinutes = req.DurationMinutes
	}
	if req.Color != nil {
		existing.Color = req.Color
	}

	updated, err := h.store.Update(r.Context(), userID, existing)
	if err != nil {
		h.log.ErrorContext(r.Context(), "update task", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

func (h *TasksHandler) updateStandalone(w http.ResponseWriter, r *http.Request) {
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
		h.log.ErrorContext(r.Context(), "get task for update", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	var req taskRequest
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
		existing.Status = domain.TaskStatus(req.Status)
	}
	if req.Position != 0 {
		existing.Position = req.Position
	}
	if req.ScheduledDate != nil {
		existing.ScheduledDate = parseTaskDate(req.ScheduledDate)
	}
	if req.DurationMinutes > 0 {
		existing.DurationMinutes = req.DurationMinutes
	}
	if req.Color != nil {
		existing.Color = req.Color
	}
	if req.ProjectID != nil {
		if *req.ProjectID == "" {
			existing.ProjectID = nil
		} else if pid, err := uuid.Parse(*req.ProjectID); err == nil {
			existing.ProjectID = &pid
		}
	}

	updated, err := h.store.Update(r.Context(), userID, existing)
	if err != nil {
		h.log.ErrorContext(r.Context(), "update task", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

func (h *TasksHandler) delete(w http.ResponseWriter, r *http.Request) {
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
		h.log.ErrorContext(r.Context(), "delete task", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
