package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/lbc/echo/internal/domain"
)

type UserStore struct {
	db *DB
}

func NewUserStore(db *DB) *UserStore {
	return &UserStore{db: db}
}

func (s *UserStore) Create(ctx context.Context, email, passwordHash string) (domain.User, error) {
	var u domain.User
	err := s.db.Pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash)
		 VALUES ($1, $2)
		 RETURNING id, email, password_hash, created_at`,
		email, passwordHash,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.CreatedAt)
	if err != nil {
		return domain.User{}, fmt.Errorf("create user: %w", err)
	}
	return u, nil
}

func (s *UserStore) GetByEmail(ctx context.Context, email string) (domain.User, error) {
	var u domain.User
	err := s.db.Pool.QueryRow(ctx,
		`SELECT id, email, password_hash, created_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, fmt.Errorf("get user by email: %w", domain.ErrNotFound)
		}
		return domain.User{}, fmt.Errorf("get user by email: %w", err)
	}
	return u, nil
}

func (s *UserStore) GetByID(ctx context.Context, id string) (domain.User, error) {
	var u domain.User
	err := s.db.Pool.QueryRow(ctx,
		`SELECT id, email, password_hash, created_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.User{}, fmt.Errorf("get user by id: %w", domain.ErrNotFound)
		}
		return domain.User{}, fmt.Errorf("get user by id: %w", err)
	}
	return u, nil
}
