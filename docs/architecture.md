# Architecture: Echo Frontend

**Date:** 2026-05-01
**Status:** Decided

## Overview

React SPA with Vite. Go backend serves static build and provides REST API. Hybrid feature/layer structure with Zustand for UI state and TanStack Query for server state.

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Build | Vite | Fast HMR, simple config, Go serves build |
| Framework | React 18 + TypeScript | Main SPA |
| Styling | Tailwind CSS | Utility-first, matches UI mockups |
| Server state | TanStack Query | Polling, caching, optimistic updates |
| UI state | Zustand | Minimal, flat store for modals/wizard/navigation |
| Routing | React Router v6 | Standard, nested routes |
| HTTP client | Native fetch + typed wrapper | No deps, simple CRUD |
| Validation | Valibot | Lightweight, type-safe |
| AI | REST submit + SSE stream | Wizard flow with real-time feedback |

## System Context

```
┌─────────────────────────────────────────────────────┐
│ Browser                                             │
│  ┌─────────────────────────────────────────────┐   │
│  │ React SPA (Vite build)                      │   │
│  │  ├── Goals List / Detail                   │   │
│  │  ├── Wizard (D+C flow)                     │   │
│  │  ├── Calendar (Week/Month/Agenda)          │   │
│  │  └── Inbox                                 │   │
│  └─────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP / SSE
┌──────────────────────▼──────────────────────────────┐
│ Go Backend (cmd/server)                              │
│  ├── /api/*  → REST handlers                        │
│  ├── /static/* → SPA build                         │
│  ├── /events/* → SSE endpoint                      │
│  └── fallback → index.html                         │
└─────────────────────────────────────────────────────┘
```

## Components

| Component | Responsibility | Location |
|-----------|---------------|----------|
| `App` | Root, providers (QueryClient, Router) | `src/main.tsx` |
| `AuthLayout` | Login/Register pages | `features/auth/` |
| `DashboardLayout` | Goals/Calendar/Inbox shell | `features/goals/`, `features/calendar/`, `features/inbox/` |
| `WizardFlow` | D+C wizard steps | `features/wizard/` |
| `AIChatPanel` | Chat messages + prompts | `features/wizard/components/` |

## Key Flows

### 1. User enters goal via Wizard (D+C)
1. User fills goal title/description/target_date in Step 1
2. `POST /goals` → goal created with `status=active`
3. Wizard polls `GET /goals/:id/suggestion` every 5s OR connects to `GET /events/goal/:id`
4. On `AISuggestionReady` event, overlay shows AI-proposed projects/tasks
5. User accepts/rejects projects → `POST /ai_suggestions/:id/accept`
6. Projects + tasks materialized in DB

### 2. Goals list + detail
1. Goals list: `GET /goals` via TanStack Query (30s polling)
2. Click goal → `GET /goals/:id` + `GET /goals/:id/projects` + `GET /projects/:id/tasks`
3. TanStack Query caches responses, stale after 30s

### 3. Calendar
1. Week/Month/Agenda views: `GET /tasks?due_date=...` via TanStack Query
2. No real-time updates, manual refresh or polling

### 4. Inbox
1. Polling `GET /notifications` every 30s via TanStack Query
2. Mark as read: `POST /notifications/:id/read`

## Data (Frontend)

TanStack Query keys as single source of truth for server data:

```
useGoals()           → ['goals']
useGoal(id)         → ['goals', id]
useProjects(goalID) → ['projects', goalID]
useTasks(projectID) → ['tasks', projectID]
useNotifications()  → ['notifications']
```

Zustand stores (UI state only):

```
uiStore:
  - selectedGoalId: string | null
  - wizardStep: 1-4
  - activeModal: 'newGoal' | 'addProject' | 'addTask' | 'settings' | null
  - aiPanelCollapsed: boolean

authStore:
  - token: string | null
  - userId: string | null
```

## API Client (`src/lib/api.ts`)

Minimal typed wrapper around fetch:

```typescript
const api = {
  get: <T>(path: string) => fetchJson<T>(path),
  post: <T>(path: string, body: unknown) => fetchJson<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => fetchJson<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => fetchJson(path, { method: 'DELETE' }),
}
```

Error handling: throws typed `ApiError { status, message }`.

## File Structure

```
web/
├── src/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/   # LoginForm, RegisterForm
│   │   │   └── pages/       # LoginPage, RegisterPage
│   │   ├── goals/
│   │   │   ├── components/  # GoalCard, GoalDetail, ProjectsList
│   │   │   ├── hooks/       # useGoals, useGoal mutations
│   │   │   └── pages/       # GoalsListPage, GoalDetailPage
│   │   ├── wizard/
│   │   │   ├── components/  # StepIndicator, AIChatPanel, ProjectPicker
│   │   │   ├── hooks/       # useWizard, useAiSuggestion
│   │   │   └── pages/       # WizardPage
│   │   ├── calendar/
│   │   │   ├── components/ # WeekView, MonthView, AgendaView
│   │   │   ├── hooks/       # useCalendarTasks
│   │   │   └── pages/       # CalendarPage
│   │   └── inbox/
│   │       ├── components/  # NotificationItem
│   │       ├── hooks/       # useNotifications
│   │       └── pages/       # InboxPage
│   ├── components/           # shared UI (Button, Input, Modal, Skeleton)
│   ├── lib/
│   │   ├── api.ts          # fetch wrapper
│   │   ├── constants.ts
│   │   └── utils.ts
│   ├── hooks/               # useAuth, useAIChannel (SSE)
│   ├── stores/              # Zustand stores (uiStore, authStore)
│   ├── types/               # domain types mirror
│   └── pages/              # route composition (AppRoutes)
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Open Questions

| Question | Status |
|----------|--------|
| Landing page (marketing) — separate static site or part of Go backend? | Open |
| Real-time collaboration (shared goals) — future? | Out of scope for MVP |
| Mobile app — React Native or PWA? | Out of scope for MVP |
