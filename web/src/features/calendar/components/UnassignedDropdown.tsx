import { useEffect, useRef } from 'react'
import type { ContextTask } from '../../../contexts/CalendarContext'

interface Props {
  tasks: ContextTask[]
  onClose: () => void
}

export function UnassignedDropdown({ tasks, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

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
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #2b2b2f' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#8080a0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Unassigned tasks
        </span>
      </div>
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {tasks.length === 0 ? (
          <div style={{ padding: '20px 12px', fontSize: 11, color: '#3a3a48', textAlign: 'center' }}>
            All tasks are scheduled
          </div>
        ) : tasks.map(task => (
          <div
            key={task.id}
            draggable
            onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
              borderBottom: '1px solid #1a1a1e', cursor: 'grab',
            }}
          >
            <span style={{ fontSize: 12, color: '#2e2e38', flexShrink: 0 }}>⠿</span>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: task.color ?? '#57535e', flexShrink: 0 }} />
            <span
              style={{ flex: 1, fontSize: 11, color: '#c8c4bc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {task.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
