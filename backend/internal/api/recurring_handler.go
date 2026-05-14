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
	"github.com/lbc/echo/internal/recurring"
)

type recurringTemplateStore interface {
	Get(ctx context.Context, userID, id uuid.UUID) (domain.RecurringTemplate, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.RecurringTemplate, error)
}

type recurringService interface {
	CreateTemplate(ctx context.Context, tmpl domain.RecurringTemplate, days []time.Weekday) (domain.RecurringTemplate, error)
	UpdateTemplate(ctx context.Context, userID uuid.UUID, tmpl domain.RecurringTemplate, days []time.Weekday) error
	DeleteTemplate(ctx context.Context, userID, id uuid.UUID) error
}

type RecurringHandler struct {
	store     recurringTemplateStore
	service   recurringService
	jwtSecret string
	log       *slog.Logger
	mux       *http.ServeMux
}

func NewRecurringHandler(store recurringTemplateStore, service recurringService, jwtSecret string, log *slog.Logger) *RecurringHandler {
	h := &RecurringHandler{
		store:     store,
		service:   service,
		jwtSecret: jwtSecret,
		log:       log,
		mux:       http.NewServeMux(),
	}
	h.mux.Handle("GET /recurring", jwtMiddleware(jwtSecret, http.HandlerFunc(h.list)))
	h.mux.Handle("POST /recurring", jwtMiddleware(jwtSecret, http.HandlerFunc(h.create)))
	h.mux.Handle("PUT /recurring/{id}", jwtMiddleware(jwtSecret, http.HandlerFunc(h.update)))
	h.mux.Handle("DELETE /recurring/{id}", jwtMiddleware(jwtSecret, http.HandlerFunc(h.delete)))
	return h
}

func (h *RecurringHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.mux.ServeHTTP(w, r)
}

type recurringRequest struct {
	Title           string   `json:"title"`
	Description     string   `json:"description"`
	DurationMinutes int      `json:"duration_minutes"`
	Color           *string  `json:"color"`
	Days            []string `json:"days"`
	StartDate       string   `json:"start_date"`
}

func (h *RecurringHandler) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	templates, err := h.store.ListByUser(r.Context(), userID)
	if err != nil {
		h.log.ErrorContext(r.Context(), "list recurring templates", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if templates == nil {
		templates = []domain.RecurringTemplate{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(templates)
}

func (h *RecurringHandler) create(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req recurringRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	if req.Title == "" {
		http.Error(w, "title required", http.StatusBadRequest)
		return
	}

	days := parseDays(req.Days)
	if len(days) == 0 {
		days = []time.Weekday{time.Monday, time.Wednesday, time.Friday}
	}

	var startAt time.Time
	if req.StartDate != "" {
		if parsed, err := time.Parse(time.RFC3339, req.StartDate); err == nil {
			startAt = parsed
		}
	}
	if startAt.IsZero() {
		startAt = time.Now()
	}

	tmpl := domain.RecurringTemplate{
		UserID:          userID,
		Title:           req.Title,
		Description:     req.Description,
		DurationMinutes: req.DurationMinutes,
		Color:           req.Color,
		NextRunAt:       startAt,
	}

	created, err := h.service.CreateTemplate(r.Context(), tmpl, days)
	if err != nil {
		h.log.ErrorContext(r.Context(), "create recurring template", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

func (h *RecurringHandler) update(w http.ResponseWriter, r *http.Request) {
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
		h.log.ErrorContext(r.Context(), "get recurring template", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	var req recurringRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	days := parseDays(req.Days)
	if len(days) == 0 {
		days = recurring.ParseDaysFromRule(existing.RecurrenceRule)
	}

	if req.Title != "" {
		existing.Title = req.Title
	}
	if req.Description != "" {
		existing.Description = req.Description
	}
	if req.DurationMinutes > 0 {
		existing.DurationMinutes = req.DurationMinutes
	}
	if req.Color != nil {
		existing.Color = req.Color
	}

	if err := h.service.UpdateTemplate(r.Context(), userID, existing, days); err != nil {
		h.log.ErrorContext(r.Context(), "update recurring template", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	updated, err := h.store.Get(r.Context(), userID, id)
	if err != nil {
		h.log.ErrorContext(r.Context(), "get updated recurring template", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

func (h *RecurringHandler) delete(w http.ResponseWriter, r *http.Request) {
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

	if err := h.service.DeleteTemplate(r.Context(), userID, id); err != nil {
		h.log.ErrorContext(r.Context(), "delete recurring template", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func parseDays(days []string) []time.Weekday {
	var result []time.Weekday
	for _, d := range days {
		switch d {
		case "mo", "monday", "Mon", "Monday":
			result = append(result, time.Monday)
		case "tu", "tuesday", "Tue", "Tuesday":
			result = append(result, time.Tuesday)
		case "we", "wednesday", "Wed", "Wednesday":
			result = append(result, time.Wednesday)
		case "th", "thursday", "Thu", "Thursday":
			result = append(result, time.Thursday)
		case "fr", "friday", "Fri", "Friday":
			result = append(result, time.Friday)
		case "sa", "saturday", "Sat", "Saturday":
			result = append(result, time.Saturday)
		case "su", "sunday", "Sun", "Sunday":
			result = append(result, time.Sunday)
		}
	}
	return result
}
