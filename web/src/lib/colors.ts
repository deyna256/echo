import type { Task } from '../types'

/** Convert a 6-digit '#rrggbb' hex color to 'r,g,b' for use in rgba(). Callers must supply a 6-digit hex fallback. */
export function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

/** Computed display status — 'overdue' is not stored in DB. */
export function effectiveStatus(
  task: Pick<Task, 'status' | 'scheduled_date'>,
  now: Date = new Date()
): 'todo' | 'overdue' | 'postponed' | 'done' {
  if (task.status === 'done') return 'done'
  if (task.status === 'postponed') return 'postponed'
  if (task.scheduled_date && new Date(task.scheduled_date) < now) return 'overdue'
  return 'todo'
}
