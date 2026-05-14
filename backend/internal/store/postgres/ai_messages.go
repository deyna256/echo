package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lbc/echo/internal/api"
)

type AIMessageStore struct {
	pool *pgxpool.Pool
}

func NewAIMessageStore(pool *pgxpool.Pool) *AIMessageStore {
	return &AIMessageStore{pool: pool}
}

func (s *AIMessageStore) Create(ctx context.Context, msg api.AIMessage) (api.AIMessage, error) {
	var id uuid.UUID
	err := s.pool.QueryRow(ctx, `
		INSERT INTO ai_messages (goal_id, user_id, role, content)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, msg.GoalID, msg.UserID, msg.Role, msg.Content).Scan(&id)
	if err != nil {
		return api.AIMessage{}, err
	}
	msg.ID = id
	return msg, nil
}

func (s *AIMessageStore) List(ctx context.Context, goalID, userID uuid.UUID) ([]api.AIMessage, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, goal_id, user_id, role, content, created_at
		FROM ai_messages
		WHERE goal_id = $1 AND user_id = $2
		ORDER BY created_at ASC
	`, goalID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []api.AIMessage
	for rows.Next() {
		var msg api.AIMessage
		if err := rows.Scan(&msg.ID, &msg.GoalID, &msg.UserID, &msg.Role, &msg.Content, &msg.CreatedAt); err != nil {
			return nil, err
		}
		msgs = append(msgs, msg)
	}
	return msgs, nil
}
