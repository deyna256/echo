export type GoalStatus = 'active' | 'done' | 'archived'
export type ProjectStatus = 'active' | 'done' | 'archived'
export type TaskStatus = 'todo' | 'postponed' | 'done'
export type NotificationType = 'deadline' | 'overdue' | 'suggestion'
export type SuggestionStatus = 'pending' | 'accepted' | 'rejected'

export interface User {
  id: string
  email: string
  password_hash?: string
  created_at: string
}

export interface Goal {
  id: string
  user_id: string
  title: string
  description: string
  target_date: string | null
  status: GoalStatus
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  goal_id: string | null
  user_id: string
  title: string
  description: string
  target_date: string | null
  status: ProjectStatus
  ai_suggested: boolean
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  project_id: string | null
  user_id: string
  title: string
  description: string
  scheduled_date: string | null
  duration_minutes: number
  status: TaskStatus
  ai_suggested: boolean
  position: number
  color?: string
  recurring_template_id?: string | null
  recurring_event_id?: string | null
  original_start_time?: string | null
  created_at: string
  updated_at: string
}

export interface RecurringTemplate {
  id: string
  user_id: string
  title: string
  description: string
  duration_minutes: number
  color?: string
  recurrence_rule: string
  next_run_at: string
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface AISuggestion {
  id: string
  goal_id: string
  user_id: string
  payload: AISuggestionPayload
  status: SuggestionStatus
  created_at: string
}

export interface AISuggestionPayload {
  projects: Array<{
    title: string
    target_date: string | null
    tasks: Array<{
      title: string
      due_date: string | null
    }>
  }>
}

export interface AuthResponse {
  token: string
  refresh_token: string
}

export interface CreateGoalRequest {
  title: string
  description?: string
  target_date?: string
}

export interface CreateProjectRequest {
  title: string
  description?: string
  target_date?: string
}

export interface CreateTaskRequest {
  title: string
  description?: string
  scheduled_date?: string
  duration_minutes?: number
}

export interface AcceptSuggestionRequest {
  project_indices: number[]
}
