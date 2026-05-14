package main

import (
	"context"
	"errors"
	"flag"
	"log/slog"
	"net/http"
	"os"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"

	"github.com/lbc/echo/internal/ai"
	"github.com/lbc/echo/internal/api"
	"github.com/lbc/echo/internal/config"
	"github.com/lbc/echo/internal/notifications"
	"github.com/lbc/echo/internal/planner"
	"github.com/lbc/echo/internal/recurring"
	"github.com/lbc/echo/internal/scheduler"
	"github.com/lbc/echo/internal/store/postgres"
)

func main() {
	migrateCmd := flag.String("migrate", "", "run migrations: 'up' or 'down'")
	flag.Parse()

	if *migrateCmd != "" {
		runMigrations(*migrateCmd)
		return
	}

	startServer()
}

func runMigrations(cmd string) {
	cfg := config.FromEnv()

	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	m, err := migrate.New("file://./migrations", cfg.DatabaseURL)
	if err != nil {
		log.Error("failed to create migrator", slog.String("error", err.Error()))
		os.Exit(1)
	}

	switch cmd {
	case "up":
		if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
			log.Error("migration up failed", slog.String("error", err.Error()))
			os.Exit(1)
		}
		log.Info("migrations applied")
	case "down":
		if err := m.Down(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
			log.Error("migration down failed", slog.String("error", err.Error()))
			os.Exit(1)
		}
		log.Info("migrations rolled back")
	default:
		log.Error("unknown migrate command", slog.String("cmd", cmd))
		os.Exit(1)
	}
}

func startServer() {
	cfg := config.FromEnv()

	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	m, err := migrate.New("file://./migrations", cfg.DatabaseURL)
	if err != nil {
		log.Error("failed to create migrator", slog.String("error", err.Error()))
		os.Exit(1)
	}
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		log.Error("migration failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
	log.Info("migrations applied")

	db, err := postgres.Open(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Error("failed to connect to database", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer db.Close()

	userStore := postgres.NewUserStore(db)
	goalStore := postgres.NewGoalStore(db)
	projectStore := postgres.NewProjectStore(db)
	taskStore := postgres.NewTaskStore(db)
	suggestionStore := postgres.NewSuggestionStore(db)
	notificationStore := postgres.NewNotificationStore(db)
	messageStore := postgres.NewAIMessageStore(db.Pool)

	bus := notifications.NewBus()
	sched := scheduler.New(taskStore, goalStore, bus, log)
	bus.Register(notifications.NewDashboardAdapter(notificationStore))

	aiClient := ai.NewMinimaxClient(cfg.MinimaxAPIKey, cfg.MinimaxBaseURL, log)
	p := planner.New(aiClient, suggestionStore, log)

	authHandler := api.NewAuthHandler(userStore, cfg.JWTSecret, cfg.JWTTokenTTL, cfg.JWTRefreshTTL, log)
	goalsHandler := api.NewGoalsHandler(goalStore, cfg.JWTSecret, log, p)
	projectsHandler := api.NewProjectsHandler(projectStore, cfg.JWTSecret, log)
	tasksHandler := api.NewTasksHandler(taskStore, cfg.JWTSecret, log)
	suggestionsHandler := api.NewSuggestionsHandler(suggestionStore, projectStore, taskStore, cfg.JWTSecret, log)
	notificationsHandler := api.NewNotificationsHandler(notificationStore, cfg.JWTSecret, log)
	aiHandler := api.NewAIHandler(goalStore, projectStore, taskStore, messageStore, aiClient, cfg.JWTSecret, log)

	templateStore := postgres.NewRecurringTemplateStore(db)
	recurringService := recurring.New(templateStore, taskStore)
	recurringHandler := api.NewRecurringHandler(templateStore, recurringService, cfg.JWTSecret, log)

	srv := api.NewServer(cfg.Addr, goalsHandler, projectsHandler, tasksHandler, authHandler, suggestionsHandler, notificationsHandler, aiHandler, recurringHandler, cfg.JWTSecret, log)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go sched.Start(ctx)

	log.Info("server started", slog.String("addr", cfg.Addr))

	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Error("server error", slog.String("error", err.Error()))
		os.Exit(1)
	}

	sched.Stop()
}