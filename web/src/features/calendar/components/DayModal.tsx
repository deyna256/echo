import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import { effectiveStatus, hexToRgb } from '../../../lib/colors'
import type { CalendarTask } from './WeekView'

interface Props {
  date: Date
  tasks: CalendarTask[]
  onClose: () => void
  onTaskClick: (taskId: string) => void
  onAddTask: (date: Date) => void
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export function DayModal({ date, tasks, onClose, onTaskClick, onAddTask }: Props) {
  const queryClient = useQueryClient()

  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'todo' | 'done' | 'postponed' }) =>
      api.patch(`/tasks/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['calendar_tasks'] })
      const prev = queryClient.getQueryData<CalendarTask[]>(['calendar_tasks'])
      queryClient.setQueryData<CalendarTask[]>(['calendar_tasks'], old =>
        old ? old.map(t => t.id === id ? { ...t, status } : t) : old
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['calendar_tasks'], ctx.prev)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['calendar_tasks'] }),
  })

  const ORDER = ['overdue', 'todo', 'postponed', 'done'] as const
  const sorted = [...tasks].sort((a, b) => {
    const ai = ORDER.indexOf(effectiveStatus(a))
    const bi = ORDER.indexOf(effectiveStatus(b))
    if (ai !== bi) return ai - bi
    const at = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0
    const bt = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0
    return at - bt
  })

  // summary line
  const ov = sorted.filter(t => effectiveStatus(t) === 'overdue').length
  const td = sorted.filter(t => effectiveStatus(t) === 'todo').length
  const dn = sorted.filter(t => effectiveStatus(t) === 'done').length
  const ps = sorted.filter(t => effectiveStatus(t) === 'postponed').length
  const summaryParts = [
    ov && `⚠ ${ov} overdue`,
    td && `${td} todo`,
    ps && `${ps} later`,
    dn && `${dn} done`,
  ].filter(Boolean)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#141416', border: '1px solid #252530', borderRadius: 14,
          width: 540, maxWidth: '92vw', maxHeight: '82vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 32px 100px rgba(0,0,0,0.85)',
          overflow: 'hidden',
          animation: 'slide-up 0.15s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #1e1e2a', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{formatDate(date)}</div>
            {summaryParts.length > 0 && (
              <div style={{ fontSize: '.73rem', color: '#3e3e52', marginTop: 3 }}>
                {summaryParts.join(' · ')}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 7, background: '#1c1c28', border: 'none', color: '#52526a', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div style={{ padding: '14px 18px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {sorted.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#2a2a38', fontSize: '.82rem' }}>
              No tasks this day
            </div>
          )}
          {sorted.map(task => {
            const status = effectiveStatus(task)
            const color = task.color ?? '#57535e'
            const rgb = hexToRgb(color)

            const cardStyle: React.CSSProperties = (() => {
              switch (status) {
                case 'overdue':
                  return { border: '1px solid rgba(224,96,80,0.3)', borderTop: '2.5px solid #e06050', background: 'rgba(220,80,64,0.13)' }
                case 'postponed':
                  return { borderTop: '2.5px solid #353542', background: 'rgba(50,50,62,0.32)', filter: 'blur(0.3px) saturate(0.25) opacity(0.68)' }
                case 'done':
                  return { borderTop: '2.5px solid #1e1e2c', background: '#14141c', filter: 'grayscale(1) opacity(0.27)' }
                default:
                  return { borderTop: `2.5px solid ${color}`, background: `rgba(${rgb},0.1)` }
              }
            })()

            const titleColor = status === 'overdue' ? '#e06050'
              : status === 'done' ? '#4a4a5a'
              : status === 'postponed' ? '#505060'
              : '#edeae2'

            const badgeText = status === 'overdue' ? 'LATE'
              : status === 'postponed' ? 'LATER'
              : status === 'done' ? 'DONE' : 'TODO'

            const timeStr = task.scheduled_date
              ? new Date(task.scheduled_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
              : null

            return (
              <div
                key={task.id}
                style={{ borderRadius: 8, padding: '10px 13px 9px', ...cardStyle }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div
                    style={{ fontSize: 12, fontWeight: 700, color: titleColor, flex: 1,
                      textDecoration: status === 'done' ? 'line-through' : 'none',
                      fontStyle: status === 'postponed' ? 'italic' : 'normal',
                    }}
                  >
                    {task.title}
                  </div>
                  <span style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '.07em', padding: '2px 5px', borderRadius: 3, flexShrink: 0, background: `rgba(${rgb},0.15)`, color }}>
                    {badgeText}
                  </span>
                </div>
                {timeStr && (
                  <div style={{ fontSize: 9, color: '#3e3e52', marginTop: 3 }}>
                    {timeStr}{task.duration_minutes ? ` · ${task.duration_minutes}m` : ''}
                  </div>
                )}
                {status !== 'done' && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <button
                      onClick={() => updateStatus.mutate({ id: task.id, status: 'done' })}
                      style={{ fontSize: 9, padding: '4px 11px', borderRadius: 5, cursor: 'pointer', border: 'none', background: 'rgba(74,197,113,0.13)', color: '#4ac571' }}
                    >
                      ✓ Done
                    </button>
                    <button
                      onClick={() => updateStatus.mutate({ id: task.id, status: task.status === 'postponed' ? 'todo' : 'postponed' })}
                      style={{ fontSize: 9, padding: '4px 11px', borderRadius: 5, cursor: 'pointer', border: 'none', background: '#1c1c28', color: '#505068' }}
                    >
                      {task.status === 'postponed' ? '↩ Unpostpone' : '⏸ Postpone'}
                    </button>
                    <button
                      onClick={() => { onTaskClick(task.id); onClose() }}
                      style={{ fontSize: 9, padding: '4px 11px', borderRadius: 5, cursor: 'pointer', border: 'none', background: '#1c1c28', color: '#505068' }}
                    >
                      ✎ Edit
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* add task row */}
          <button
            onClick={() => { onAddTask(date); onClose() }}
            style={{
              marginTop: 2, border: '1.5px dashed #1c1c2a', borderRadius: 8,
              padding: 10, fontSize: 10, color: '#28283a', textAlign: 'center',
              background: 'none', cursor: 'pointer', width: '100%',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#363648'; e.currentTarget.style.color = '#505068' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1c1c2a'; e.currentTarget.style.color = '#28283a' }}
          >
            + Add task for this day
          </button>
        </div>
      </div>
    </div>
  )
}
