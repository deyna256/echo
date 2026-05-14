package api

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/ai"
	"github.com/lbc/echo/internal/domain"
)

type GoalWithContext struct {
	Goal     domain.Goal      `json:"goal"`
	Projects []domain.Project `json:"projects"`
	Tasks    []domain.Task    `json:"tasks"`
}

type AIMessage struct {
	ID        uuid.UUID `json:"id"`
	GoalID    uuid.UUID `json:"goal_id"`
	UserID    uuid.UUID `json:"user_id"`
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	CreatedAt string    `json:"created_at"`
}

type AIMessageStore interface {
	Create(ctx context.Context, msg AIMessage) (AIMessage, error)
	List(ctx context.Context, goalID, userID uuid.UUID) ([]AIMessage, error)
}

type ProjectLister interface {
	List(ctx context.Context, userID, goalID uuid.UUID) ([]domain.Project, error)
}

type TaskLister interface {
	ListByGoal(ctx context.Context, userID, goalID uuid.UUID) ([]domain.Task, error)
}

type GoalGetter interface {
	Get(ctx context.Context, userID, id uuid.UUID) (domain.Goal, error)
}

type AIHandler struct {
	goals     GoalGetter
	projects  ProjectLister
	tasks     TaskLister
	msgStore  AIMessageStore
	ai        *ai.MinimaxClient
	jwtSecret string
	log       *slog.Logger
	mux       *http.ServeMux
}

func NewAIHandler(
	goals GoalGetter,
	projects ProjectLister,
	tasks TaskLister,
	messages AIMessageStore,
	aiClient *ai.MinimaxClient,
	jwtSecret string,
	log *slog.Logger,
) *AIHandler {
	h := &AIHandler{
		goals:     goals,
		projects:  projects,
		tasks:     tasks,
		msgStore:  messages,
		ai:        aiClient,
		jwtSecret: jwtSecret,
		log:       log,
		mux:       http.NewServeMux(),
	}

	h.mux.Handle("GET /ai/context/{goalID}", jwtMiddleware(jwtSecret, http.HandlerFunc(h.context)))
	h.mux.Handle("POST /ai/chat", jwtMiddleware(jwtSecret, http.HandlerFunc(h.chat)))
	h.mux.Handle("GET /ai/messages", jwtMiddleware(jwtSecret, http.HandlerFunc(h.messagesEndpoint)))
	h.mux.Handle("POST /ai/improve/goal-title", jwtMiddleware(jwtSecret, http.HandlerFunc(h.improveGoalTitle)))
	h.mux.Handle("POST /ai/improve/goal-description", jwtMiddleware(jwtSecret, http.HandlerFunc(h.improveGoalDescription)))
	h.mux.Handle("POST /ai/improve/project", jwtMiddleware(jwtSecret, http.HandlerFunc(h.improveProject)))

	return h
}

func (h *AIHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.mux.ServeHTTP(w, r)
}

func (h *AIHandler) context(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	goalID, err := uuid.Parse(r.PathValue("goalID"))
	if err != nil {
		http.Error(w, "invalid goal id", http.StatusBadRequest)
		return
	}

	goal, err := h.goals.Get(r.Context(), userID, goalID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		h.log.ErrorContext(r.Context(), "get goal for context", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	projects, err := h.projects.List(r.Context(), userID, goalID)
	if err != nil {
		h.log.ErrorContext(r.Context(), "list projects for context", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	tasks, err := h.tasks.ListByGoal(r.Context(), userID, goalID)
	if err != nil {
		h.log.ErrorContext(r.Context(), "list tasks for context", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	result := GoalWithContext{
		Goal:     goal,
		Projects: projects,
		Tasks:    tasks,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(result); err != nil {
		h.log.ErrorContext(r.Context(), "encode goal context", slog.String("error", err.Error()))
	}
}

type chatRequest struct {
	GoalID  string `json:"goal_id"`
	Message string `json:"message"`
}

type chatResponse struct {
	Response    string              `json:"response"`
	Suggestions []ai.SuggestionItem `json:"suggestions,omitempty"`
}

func (h *AIHandler) chat(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req chatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	if req.Message == "" {
		http.Error(w, "message required", http.StatusBadRequest)
		return
	}

	goalID, err := uuid.Parse(req.GoalID)
	if err != nil {
		http.Error(w, "invalid goal id", http.StatusBadRequest)
		return
	}

	goal, err := h.goals.Get(r.Context(), userID, goalID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		h.log.ErrorContext(r.Context(), "get goal for chat", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	projects, err := h.projects.List(r.Context(), userID, goalID)
	if err != nil {
		h.log.ErrorContext(r.Context(), "list projects for chat", slog.String("error", err.Error()))
	}
	if err != nil {
		h.log.ErrorContext(r.Context(), "list projects for chat", slog.String("error", err.Error()))
	}
	tasks, err := h.tasks.ListByGoal(r.Context(), userID, goalID)
	if err != nil {
		h.log.ErrorContext(r.Context(), "list tasks for chat", slog.String("error", err.Error()))
	}

	if _, err := h.msgStore.Create(r.Context(), AIMessage{
		GoalID:  goalID,
		UserID:  userID,
		Role:    "user",
		Content: req.Message,
	}); err != nil {
		h.log.ErrorContext(r.Context(), "store user message", slog.String("error", err.Error()))
	}

	chatHistory, err := h.msgStore.List(r.Context(), goalID, userID)
	if err != nil {
		h.log.ErrorContext(r.Context(), "list messages for chat", slog.String("error", err.Error()))
	}

	chatMsgs := make([]ai.ChatMessage, len(chatHistory))
	for i, m := range chatHistory {
		chatMsgs[i] = ai.ChatMessage{
			Role:    m.Role,
			Content: m.Content,
		}
	}

	gc := ai.GoalContext{
		Goal:     goal,
		Projects: projects,
		Tasks:    tasks,
	}

	result, err := h.ai.Chat(r.Context(), gc, chatMsgs)
	if err != nil {
		h.log.ErrorContext(r.Context(), "ai chat", slog.String("error", err.Error()))
		http.Error(w, "ai error", http.StatusInternalServerError)
		return
	}

	if _, err := h.msgStore.Create(r.Context(), AIMessage{
		GoalID:  goalID,
		UserID:  userID,
		Role:    "assistant",
		Content: result.Text,
	}); err != nil {
		h.log.ErrorContext(r.Context(), "store assistant message", slog.String("error", err.Error()))
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(chatResponse{
		Response:    result.Text,
		Suggestions: result.Suggestions,
	}); err != nil {
		h.log.ErrorContext(r.Context(), "encode chat response", slog.String("error", err.Error()))
	}
}

func (h *AIHandler) messagesEndpoint(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	goalIDStr := r.URL.Query().Get("goal_id")
	if goalIDStr == "" {
		http.Error(w, "goal_id required", http.StatusBadRequest)
		return
	}

	goalID, err := uuid.Parse(goalIDStr)
	if err != nil {
		http.Error(w, "invalid goal id", http.StatusBadRequest)
		return
	}

	msgs, err := h.msgStore.List(r.Context(), goalID, userID)
	if err != nil {
		h.log.ErrorContext(r.Context(), "list messages", slog.String("error", err.Error()))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(msgs); err != nil {
		h.log.ErrorContext(r.Context(), "encode messages", slog.String("error", err.Error()))
	}
}

func (h *AIHandler) improveGoalTitle(w http.ResponseWriter, r *http.Request) {
	if _, ok := userIDFromContext(r.Context()); !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req ai.ImproveGoalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	result, err := h.ai.ImproveGoalTitle(r.Context(), req)
	if err != nil {
		h.log.ErrorContext(r.Context(), "improve goal title", slog.String("error", err.Error()))
		http.Error(w, "ai error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(result); err != nil {
		h.log.ErrorContext(r.Context(), "encode improve title result", slog.String("error", err.Error()))
	}
}

func (h *AIHandler) improveGoalDescription(w http.ResponseWriter, r *http.Request) {
	if _, ok := userIDFromContext(r.Context()); !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req ai.ImproveGoalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	result, err := h.ai.ImproveGoalDescription(r.Context(), req)
	if err != nil {
		h.log.ErrorContext(r.Context(), "improve goal description", slog.String("error", err.Error()))
		http.Error(w, "ai error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(result); err != nil {
		h.log.ErrorContext(r.Context(), "encode improve description result", slog.String("error", err.Error()))
	}
}

func (h *AIHandler) improveProject(w http.ResponseWriter, r *http.Request) {
	if _, ok := userIDFromContext(r.Context()); !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req ai.ImproveProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	result, err := h.ai.ImproveProject(r.Context(), req)
	if err != nil {
		h.log.ErrorContext(r.Context(), "improve project", slog.String("error", err.Error()))
		http.Error(w, "ai error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(result); err != nil {
		h.log.ErrorContext(r.Context(), "encode improve project result", slog.String("error", err.Error()))
	}
}
