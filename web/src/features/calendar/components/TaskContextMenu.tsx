import { useEffect, useRef } from 'react'
import type { CalendarTask } from './WeekView'

interface Props {
  task: CalendarTask
  x: number
  y: number
  onClose: () => void
  onPostpone: () => void
  onMoveToTomorrow: () => void
  onMoveToNextWeek: () => void
  onEdit: () => void
  onDelete: () => void
}

export function TaskContextMenu({
  task, x, y, onClose,
  onPostpone, onMoveToTomorrow, onMoveToNextWeek, onEdit, onDelete,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const isPostponed = task.status === 'postponed'

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

  // clamp to viewport
  const left = Math.min(x, window.innerWidth - 200)
  const top  = Math.min(y, window.innerHeight - 220)

  function handleDelete() {
    if (window.confirm(`Delete "${task.title}"?`)) {
      onDelete()
      onClose()
    }
  }

  const item = (label: string, onClick: () => void, danger = false) => (
    <button
      onMouseDown={e => { e.stopPropagation(); onClick() }}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '7px 12px', fontSize: 12, fontWeight: 500,
        background: 'none', border: 'none', cursor: 'pointer',
        color: danger ? '#d95b5b' : '#c8c4bc',
        borderRadius: 6,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? 'rgba(217,91,91,0.1)' : 'rgba(255,255,255,0.06)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {label}
    </button>
  )

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left, top, zIndex: 1000,
        background: '#1a1a1e',
        border: '1px solid #2b2b2f',
        borderRadius: 10,
        padding: '4px',
        minWidth: 180,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        animation: 'fadeIn 0.1s ease-out',
      }}
    >
      {item(isPostponed ? '↩ Unpostpone' : '⏸ Postpone', onPostpone)}
      {task.scheduled_date && item('→ Move to tomorrow', onMoveToTomorrow)}
      {task.scheduled_date && item('⇉ Move to next week', onMoveToNextWeek)}
      {item('✎ Edit', onEdit)}
      <div style={{ height: 1, background: '#2b2b2f', margin: '4px 8px' }} />
      {item('✕ Delete', handleDelete, true)}
    </div>
  )
}
