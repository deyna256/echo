import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import type { Task } from '../../../types'

interface RecurringTemplate {
  id: string
  title: string
  description: string
  duration_minutes: number
  color?: string | null
  recurrence_rule: string
}

interface TaskFormProps {
  task?: Task
  initialDate?: Date
  onClose: () => void
  onSaved: () => void
}

function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function parseDaysFromRule(rule: string): string[] {
  const match = rule.match(/BYDAY=([A-Z,]+)/)
  if (!match) return []
  return match[1].split(',').map(d => d.toLowerCase().slice(0, 2))
}

const COLOR_PALETTE = [
  { hex: '#c4913a', name: 'gold' },
  { hex: '#4daa74', name: 'jade' },
  { hex: '#d95b5b', name: 'ember' },
  { hex: '#5b8dd9', name: 'blue' },
  { hex: '#8b6dd9', name: 'violet' },
  { hex: '#d96b8b', name: 'rose' },
  { hex: '#4daaaa', name: 'teal' },
  { hex: '#c87d4a', name: 'amber' },
]

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]

export function TaskForm({ task, initialDate, onClose, onSaved }: TaskFormProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')

  const startDate = task?.scheduled_date ? new Date(task.scheduled_date) : null

  const [date, setDate] = useState(
    startDate
      ? toDateInput(startDate)
      : initialDate
        ? toDateInput(initialDate)
        : toDateInput(new Date()),
  )
  const [startTime, setStartTime] = useState(
    startDate ? toTimeInput(startDate) : initialDate ? toTimeInput(initialDate) : '09:00',
  )
  const [duration, setDuration] = useState(task?.duration_minutes?.toString() ?? '60')
  const [color, setColor] = useState(task?.color ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isScheduled, setIsScheduled] = useState(!!(task?.scheduled_date || initialDate))
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringDays, setRecurringDays] = useState<string[]>(['mo', 'we', 'fr'])

  const { data: recurringTemplate } = useQuery<RecurringTemplate[]>({
    queryKey: ['recurring_templates'],
    queryFn: () => api.get<RecurringTemplate[]>('/recurring'),
    enabled: !!task?.recurring_template_id,
  })

  useEffect(() => {
    if (!task?.recurring_template_id || !recurringTemplate) return
    const tmpl = recurringTemplate.find(t => t.id === task.recurring_template_id)
    if (!tmpl) return
    setIsRecurring(true)
    const days = parseDaysFromRule(tmpl.recurrence_rule)
    if (days.length > 0) setRecurringDays(days)
  }, [recurringTemplate, task?.recurring_template_id])

  const dateFixed = !task && !!initialDate

  const createTaskMutation = useMutation({
    mutationFn: (data: { title: string; description?: string; scheduledDate?: string; durationMinutes: number; color?: string }) =>
      api.post<Task>('/tasks', { title: data.title, description: data.description, scheduled_date: data.scheduledDate || null, duration_minutes: data.durationMinutes, color: data.color }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['calendar_tasks'] }) },
  })

  const createRecurringMutation = useMutation({
    mutationFn: (data: { title: string; description?: string; durationMinutes: number; color?: string; days: string[]; startDate?: string }) =>
      api.post('/recurring', { title: data.title, description: data.description, duration_minutes: data.durationMinutes, color: data.color, days: data.days, start_date: data.startDate }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['calendar_tasks'] }) },
  })

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, ...data }: { taskId: string; title?: string; description?: string; scheduledDate?: string; durationMinutes?: number; color?: string; status?: string }) =>
      api.patch(`/tasks/${taskId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['calendar_tasks'] }) },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.delete(`/tasks/${taskId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['calendar_tasks'] }) },
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (task) {
        await updateTaskMutation.mutateAsync({
          taskId: task.id,
          title: title.trim(),
          description: description.trim() || undefined,
          scheduled_date: isScheduled ? new Date(`${date}T${startTime}:00`).toISOString() : null,
          duration_minutes: parseInt(duration, 10) || 60,
          color: color || undefined,
        })
      } else if (isRecurring && recurringDays.length > 0) {
        await createRecurringMutation.mutateAsync({
          title: title.trim(),
          description: description.trim() || undefined,
          durationMinutes: parseInt(duration, 10) || 60,
          color: color || undefined,
          days: recurringDays,
          startDate: date && startTime ? new Date(`${date}T${startTime}:00`).toISOString() : undefined,
        })
        setSuccessMsg('Recurring tasks created — they appear on their scheduled days')
        setSaving(false)
        setTimeout(onSaved, 2000)
        return
      } else {
        await createTaskMutation.mutateAsync({
          title: title.trim(),
          description: description.trim() || undefined,
          scheduledDate: isScheduled ? new Date(`${date}T${startTime}:00`).toISOString() : undefined,
          durationMinutes: parseInt(duration, 10) || 60,
          color: color || undefined,
        })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(next: 'done' | 'postponed' | 'todo') {
    if (!task) return
    setSaving(true)
    try {
      await updateTaskMutation.mutateAsync({ taskId: task.id, status: next })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!task) return
    setSaving(true)
    try {
      await deleteTaskMutation.mutateAsync(task.id)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '480px', background: 'rgba(20, 20, 22, 0.98)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '28px', boxShadow: '0 40px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)', overflow: 'hidden' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#edeae2', letterSpacing: '-0.01em' }}>
            {task ? 'Edit Task' : 'New Task'}
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '50%',
              color: '#6a6660',
              cursor: 'pointer',
              transition: 'all 0.25s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(217,91,91,0.15)'; e.currentTarget.style.color = '#d95b5b'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#6a6660'; e.currentTarget.style.transform = 'none'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '32px' }}>

          {successMsg && (
            <div style={{ fontSize: '12px', color: '#4ac571', border: '1px solid rgba(74,197,113,0.2)', background: 'rgba(74,197,113,0.06)', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' }}>
              {successMsg}
            </div>
          )}
          {error && (
            <div style={{ fontSize: '12px', color: '#d95b5b', border: '1px solid rgba(217,91,91,0.2)', background: 'rgba(217,91,91,0.05)', padding: '16px 20px', borderRadius: '16px', marginBottom: '24px' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#9a9299', marginBottom: '12px', letterSpacing: '0.02em' }}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(12,12,13,0.6)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px',
                padding: '18px 20px',
                fontSize: '15px',
                color: '#edeae2',
                transition: 'all 0.25s',
              }}
              placeholder="What needs to be done?"
              required
              autoFocus
              onFocus={(e) => { e.currentTarget.style.borderColor = '#c4913a'; e.currentTarget.style.background = 'rgba(12,12,13,0.8)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(196,145,58,0.1)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(12,12,13,0.6)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#9a9299', marginBottom: '12px', letterSpacing: '0.02em' }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(12,12,13,0.6)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px',
                padding: '18px 20px',
                fontSize: '15px',
                color: '#edeae2',
                transition: 'all 0.25s',
                resize: 'none',
                minHeight: '70px',
              }}
              placeholder="Add details..."
              onFocus={(e) => { e.currentTarget.style.borderColor = '#c4913a'; e.currentTarget.style.background = 'rgba(12,12,13,0.8)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(196,145,58,0.1)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(12,12,13,0.6)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#9a9299', marginBottom: '12px', letterSpacing: '0.02em' }}>
              <span>Schedule</span>
              <button
                type="button"
                onClick={() => setIsScheduled(!isScheduled)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  background: isScheduled ? 'linear-gradient(135deg, #c4913a, #d4a44e)' : 'rgba(255,255,255,0.03)',
                  border: isScheduled ? 'none' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 50,
                  fontSize: 11,
                  fontWeight: isScheduled ? 600 : 500,
                  color: isScheduled ? '#0c0c0d' : '#9a9299',
                  cursor: 'pointer',
                  transition: 'all 0.25s',
                }}
              >
                {isScheduled ? 'Scheduled' : 'Unassigned'}
              </button>
            </label>
            {isScheduled && (
              <div style={{ display: 'grid', gridTemplateColumns: dateFixed ? '1fr' : '1fr 1fr', gap: '16px' }}>
                {dateFixed ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '14px', color: '#9a9299', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '18px 20px', background: 'rgba(255,255,255,0.03)' }}>
                        {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        style={{
                          flex: 1,
                          background: 'rgba(12,12,13,0.6)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '16px',
                          padding: '18px 20px',
                          fontSize: '15px',
                          color: '#edeae2',
                        }}
                        required
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#c4913a'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(196,145,58,0.1)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(12,12,13,0.6)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '16px',
                          padding: '18px 20px',
                          fontSize: '15px',
                          color: '#edeae2',
                        }}
                        required
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#c4913a'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(196,145,58,0.1)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                    </div>
                    <div>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(12,12,13,0.6)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '16px',
                          padding: '18px 20px',
                          fontSize: '15px',
                          color: '#edeae2',
                        }}
                        required
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#c4913a'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(196,145,58,0.1)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label
              style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
              onClick={() => setIsRecurring(!isRecurring)}
            >
              <div style={{
                width: '48px',
                height: '26px',
                borderRadius: '13px',
                background: isRecurring ? 'linear-gradient(135deg, #c4913a, #d4a44e)' : 'rgba(255,255,255,0.08)',
                position: 'relative',
                transition: 'all 0.25s',
                boxShadow: isRecurring ? '0 2px 8px rgba(196,145,58,0.35)' : 'none',
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: isRecurring ? '#0c0c0d' : '#6a6660',
                  position: 'absolute',
                  top: '3px',
                  right: isRecurring ? '3px' : '3px',
                  left: isRecurring ? 'auto' : '3px',
                  transition: 'all 0.25s',
                }} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: isRecurring ? '#9a9299' : '#6a6660', letterSpacing: '0.02em', transition: 'color 0.25s' }}>
                Repeat
              </span>
            </label>

            {isRecurring && (
              <>
                <div style={{
                  marginTop: '14px',
                  background: 'rgba(12,12,13,0.4)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    {(['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const).map((day) => {
                      const active = recurringDays.includes(day)
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (active) {
                              setRecurringDays(recurringDays.filter(d => d !== day))
                            } else {
                              setRecurringDays([...recurringDays, day])
                            }
                          }}
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: active ? 'linear-gradient(135deg, #c4913a, #d4a44e)' : 'rgba(255,255,255,0.05)',
                            border: active ? 'none' : '2px solid rgba(255,255,255,0.08)',
                            color: active ? '#0c0c0d' : '#9a9299',
                            fontSize: '11px',
                            fontWeight: active ? 700 : 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: active ? '0 4px 12px rgba(196,145,58,0.3)' : 'none',
                          }}
                        >
                          {day === 'mo' ? 'Mo' : day === 'tu' ? 'Tu' : day === 'we' ? 'We' : day === 'th' ? 'Th' : day === 'fr' ? 'Fr' : day === 'sa' ? 'Sa' : 'Su'}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {recurringDays.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#6a6660', textAlign: 'center' }}>
                    Weekly on {recurringDays.map(d => d === 'mo' ? 'Monday' : d === 'tu' ? 'Tuesday' : d === 'we' ? 'Wednesday' : d === 'th' ? 'Thursday' : d === 'fr' ? 'Friday' : d === 'sa' ? 'Saturday' : 'Sunday').join(', ')}
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#9a9299', marginBottom: '12px', letterSpacing: '0.02em' }}>Duration</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d.toString())}
                  style={{
                    flex: 1,
                    padding: '16px 8px',
                    background: duration === d.toString() ? 'linear-gradient(135deg, #c4913a, #d4a44e)' : 'rgba(255,255,255,0.03)',
                    border: duration === d.toString() ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '16px',
                    fontSize: '13px',
                    fontWeight: duration === d.toString() ? 700 : 500,
                    color: duration === d.toString() ? '#0c0c0d' : '#9a9299',
                    cursor: 'pointer',
                    transition: 'all 0.25s',
                    boxShadow: duration === d.toString() ? '0 4px 16px rgba(196,145,58,0.3)' : 'none',
                  }}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#9a9299', marginBottom: '12px', letterSpacing: '0.02em' }}>Color</label>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(color === c.hex ? '' : c.hex)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    border: color === c.hex ? '3px solid white' : '3px solid transparent',
                    background: c.hex,
                    cursor: 'pointer',
                    transition: 'all 0.25s',
                  }}
                  title={c.name}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              ))}
              {color && (
                <button
                  type="button"
                  onClick={() => setColor('')}
                  style={{ fontSize: '12px', color: '#6a6660', background: 'none', border: 'none', cursor: 'pointer', marginLeft: '4px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#9a9299'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#6a6660'; }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
            <button
              type="submit"
              disabled={saving || !!successMsg}
              style={{
                flex: 1,
                padding: '18px 28px',
                background: 'linear-gradient(135deg, #c4913a, #d4a44e)',
                border: 'none',
                borderRadius: '50px',
                fontSize: '15px',
                fontWeight: 600,
                color: '#0c0c0d',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.4 : 1,
                transition: 'all 0.3s',
                boxShadow: '0 4px 20px rgba(196,145,58,0.35)',
              }}
              onMouseEnter={(e) => { if (!saving) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(196,145,58,0.45)'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(196,145,58,0.35)'; }}
            >
              {saving ? 'Saving…' : 'Save Task'}
            </button>
          </div>

          {task && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 16, borderTop: '1px solid #2b2b2f' }}>
              {/* Done toggle */}
              <button
                type="button"
                onClick={() => handleStatusChange(task.status === 'done' ? 'todo' : 'done')}
                disabled={saving}
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: '1px solid rgba(74,197,113,0.3)',
                  background: task.status === 'done' ? 'rgba(74,197,113,0.15)' : 'transparent',
                  color: '#4ac571', cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.4 : 1, transition: 'all 0.15s',
                }}
              >
                {task.status === 'done' ? '↩ Undone' : '✓ Done'}
              </button>

              {/* Postpone toggle */}
              <button
                type="button"
                onClick={() => handleStatusChange(task.status === 'postponed' ? 'todo' : 'postponed')}
                disabled={saving}
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: '1px solid rgba(100,100,140,0.3)',
                  background: task.status === 'postponed' ? 'rgba(80,80,120,0.2)' : 'transparent',
                  color: task.status === 'postponed' ? '#8080b0' : '#6a6660',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.4 : 1, transition: 'all 0.15s',
                }}
              >
                {task.status === 'postponed' ? '↩ Unpostpone' : '⏸ Postpone'}
              </button>

              {/* spacer */}
              <div style={{ flex: 1 }} />

              {/* Delete */}
              <button
                type="button"
                onClick={handleDelete}
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: '1px solid rgba(217,91,91,0.3)', background: 'transparent',
                  color: '#d95b5b', cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                Delete
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}