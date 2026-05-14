package api

import (
	"log/slog"
	"net/http"
)

func NewServer(addr string, goals *GoalsHandler, projects *ProjectsHandler, tasks *TasksHandler, auth *AuthHandler, suggestions *SuggestionsHandler, notifications *NotificationsHandler, ai *AIHandler, recurring *RecurringHandler, jwtSecret string, log *slog.Logger) *http.Server {
	mux := http.NewServeMux()

	mux.HandleFunc("POST /api/auth/register", auth.Register)
	mux.HandleFunc("POST /api/auth/login", auth.Login)
	mux.HandleFunc("POST /api/auth/refresh", auth.Refresh)
	mux.Handle("/api/auth/me", jwtMiddleware(jwtSecret, http.HandlerFunc(auth.Me)))
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/api/goals", http.StripPrefix("/api", goals))
	mux.Handle("/api/goals/", http.StripPrefix("/api", goals))
	mux.Handle("/api/goals/{goalID}/projects", http.StripPrefix("/api", projects))
	mux.Handle("/api/goals/{goalID}/projects/", http.StripPrefix("/api", projects))
	mux.Handle("/api/projects", http.StripPrefix("/api", projects))
	mux.Handle("/api/projects/", http.StripPrefix("/api", projects))
	mux.Handle("/api/projects/{projectID}/tasks", http.StripPrefix("/api", tasks))
	mux.Handle("/api/projects/{projectID}/tasks/", http.StripPrefix("/api", tasks))
	mux.Handle("/api/tasks", http.StripPrefix("/api", tasks))
	mux.Handle("/api/tasks/", http.StripPrefix("/api", tasks))
	mux.Handle("/api/ai_suggestions", http.StripPrefix("/api", suggestions))
	mux.Handle("/api/ai_suggestions/", http.StripPrefix("/api", suggestions))
	mux.Handle("/api/notifications", http.StripPrefix("/api", notifications))
	mux.Handle("/api/notifications/", http.StripPrefix("/api", notifications))
	mux.Handle("/api/ai/", http.StripPrefix("/api", ai))
	mux.Handle("/api/recurring", http.StripPrefix("/api", recurring))
	mux.Handle("/api/recurring/", http.StripPrefix("/api", recurring))

	handler := loggingMiddleware(mux, log)

	return &http.Server{
		Addr:    addr,
		Handler: handler,
	}
}

func loggingMiddleware(next http.Handler, log *slog.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.InfoContext(r.Context(), "request",
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
		)
		next.ServeHTTP(w, r)
	})
}

