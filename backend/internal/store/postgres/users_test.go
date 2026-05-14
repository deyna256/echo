package postgres_test

import (
	"context"
	"testing"
	"time"

	"github.com/lbc/echo/internal/store/postgres"
	testcontainers "github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

func setupDB(t *testing.T) *postgres.DB {
	t.Helper()
	ctx := context.Background()

	container, err := tcpostgres.Run(ctx,
		"postgres:16",
		tcpostgres.WithDatabase("echo_test"),
		tcpostgres.WithUsername("postgres"),
		tcpostgres.WithPassword("postgres"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(30*time.Second),
		),
	)
	if err != nil {
		t.Fatalf("start postgres container: %v", err)
	}
	t.Cleanup(func() {
		if err := container.Terminate(ctx); err != nil {
			t.Logf("terminate container: %v", err)
		}
	})

	dsn, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("connection string: %v", err)
	}

	db, err := postgres.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(db.Close)

	return db
}

func TestUserStore_Create_storesUser(t *testing.T) {
	db := setupDB(t)
	store := postgres.NewUserStore(db)

	user, err := store.Create(context.Background(), "alice@example.com", "hashed")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	if user.Email != "alice@example.com" {
		t.Errorf("Email = %q, want %q", user.Email, "alice@example.com")
	}
	if user.ID.String() == "" {
		t.Error("ID must not be empty")
	}
}

func TestUserStore_GetByEmail_returnsUser(t *testing.T) {
	db := setupDB(t)
	store := postgres.NewUserStore(db)

	_, err := store.Create(context.Background(), "bob@example.com", "hashed")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	got, err := store.GetByEmail(context.Background(), "bob@example.com")
	if err != nil {
		t.Fatalf("GetByEmail: %v", err)
	}
	if got.Email != "bob@example.com" {
		t.Errorf("Email = %q, want %q", got.Email, "bob@example.com")
	}
}

func TestUserStore_Create_duplicateEmail_returnsError(t *testing.T) {
	db := setupDB(t)
	store := postgres.NewUserStore(db)

	_, err := store.Create(context.Background(), "dup@example.com", "hashed")
	if err != nil {
		t.Fatalf("first Create: %v", err)
	}

	_, err = store.Create(context.Background(), "dup@example.com", "hashed")
	if err == nil {
		t.Fatal("expected error on duplicate email, got nil")
	}
}
