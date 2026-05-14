package ai

import (
	"context"

	"github.com/lbc/echo/internal/domain"
)

type AIClient interface {
	Decompose(ctx context.Context, goal domain.Goal) (Suggestion, error)
}

type Suggestion struct {
	Projects []SuggestedProject `json:"projects"`
}

type SuggestedProject struct {
	Title      string          `json:"title"`
	TargetDate string          `json:"target_date"`
	Tasks      []SuggestedTask `json:"tasks"`
}

type SuggestedTask struct {
	Title         string `json:"title"`
	ScheduledDate string `json:"scheduled_date"`
}