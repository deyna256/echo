import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import type { ContextTask } from '../../../contexts/CalendarContext'

interface Props {
  tasks: ContextTask[]
  onClose: () => void
}

const MAX_SHOW = 20

export function OverdueDropdown({ tasks, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const updateTask = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'todo' | 'done' | 'postponed' }) =>
      api.patch(`/tasks/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['calendar_tasks'] })
      const prev = queryClient.getQueryData<ContextTask[]>(['calendar_tasks'])
      queryClient.setQueryData<ContextTask[]>(['calendar_tasks'], old =>
        old ? old.map(t => t.id === id ? { ...t, status } : t) : old
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['calendar_tasks'], ctx.prev)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['calendar_tasks'] }),
  })

  const sorted = [...tasks]
    .sort((a, b) => new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime())
    .slice(0, MAX_SHOW)

  const extra = tasks.length - MAX_SHOW

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
        width: 240, background: '#141416', border: '1px solid #2b2b2f',
        borderRadius: 10, overflow: 'hidden',
        boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
        animation: 'fadeIn 0.12s ease-out',
      }}
    >
      {/* header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #2b2b2f', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#e06050', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Overdue tasks
        </span>
        <span style={{ fontSize: 10, color: '#3a3a48' }}>drag to calendar</span>
      </div>

      {/* list */}
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {sorted.map(task => {
          const date = new Date(task.scheduled_date!)
          const label = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
          return (
            <div
              key={task.id}
              draggable
              onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                borderBottom: '1px solid #1a1a1e', cursor: 'grab',
              }}
            >
              {/* drag handle */}
              <span style={{ fontSize: 12, color: '#2e2e38', flexShrink: 0 }}>⠿</span>

              {/* color dot */}
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: task.color ?? '#e06050', flexShrink: 0 }} />

              {/* title */}
              <span
                style={{ flex: 1, fontSize: 11, color: '#c8c4bc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {task.title}
              </span>

              {/* date */}
              <span style={{ fontSize: 10, color: '#3a3a48', flexShrink: 0 }}>{label}</span>

              {/* quick actions */}
              <button
                title="Mark done"
                onClick={() => updateTask.mutate({ id: task.id, status: 'done' })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4ac571', fontSize: 13, padding: '0 2px' }}
              >✓</button>
              <button
                title="Postpone"
                onClick={() => updateTask.mutate({ id: task.id, status: 'postponed' })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6060a0', fontSize: 12, padding: '0 2px' }}
              >⏸</button>
            </div>
          )
        })}
        {extra > 0 && (
          <div style={{ padding: '6px 12px', fontSize: 10, color: '#2e2e3a', textAlign: 'center' }}>
            +{extra} more
          </div>
        )}
      </div>
    </div>
  )
}
