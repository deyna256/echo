package planner

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/google/uuid"
	"github.com/lbc/echo/internal/ai"
	"github.com/lbc/echo/internal/domain"
)

type suggestionStore interface {
	Create(ctx context.Context, userID, goalID uuid.UUID, payload []byte) (domain.AISuggestion, error)
}

type Planner struct {
	ai    ai.AIClient
	store suggestionStore
	log   *slog.Logger
}

func New(aiClient ai.AIClient, store suggestionStore, log *slog.Logger) *Planner {
	return &Planner{ai: aiClient, store: store, log: log}
}

func (p *Planner) Decompose(ctx context.Context, goal domain.Goal) {
	p.log.InfoContext(ctx, "planner decompose start", slog.String("goal_id", goal.ID.String()))

	suggestion, err := p.ai.Decompose(ctx, goal)
	if err != nil {
		p.log.ErrorContext(ctx, "planner ai decompose", slog.String("goal_id", goal.ID.String()), slog.String("error", err.Error()))
		return
	}

	payload, err := json.Marshal(suggestion)
	if err != nil {
		p.log.ErrorContext(ctx, "planner marshal suggestion", slog.String("goal_id", goal.ID.String()), slog.String("error", err.Error()))
		return
	}

	if _, err := p.store.Create(ctx, goal.UserID, goal.ID, payload); err != nil {
		p.log.ErrorContext(ctx, "planner save suggestion", slog.String("goal_id", goal.ID.String()), slog.String("error", err.Error()))
		return
	}

	p.log.InfoContext(ctx, "planner decompose done", slog.String("goal_id", goal.ID.String()), slog.Int("projects", len(suggestion.Projects)))
}
