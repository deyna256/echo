import { useMemo } from 'react'
import { Calendar } from 'lucide-react'
import { CalendarTask } from './WeekView'

export interface AgendaViewProps {
  tasksByDate: Record<string, CalendarTask[]>
  onTaskClick: (taskId: string) => void
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function AgendaView({ tasksByDate, onTaskClick }: AgendaViewProps) {
  const sortedDates = Object.keys(tasksByDate).sort()

  const groupedTasks = useMemo(() => {
    const groups: { label: string; date: string; tasks: CalendarTask[] }[] = []
    const today = formatDate(new Date())
    const tomorrow = formatDate(new Date(Date.now() + 86400000))

    sortedDates.forEach((dateKey) => {
      const tasks = tasksByDate[dateKey]
      let label = dateKey
      if (dateKey === today) label = 'Today'
      else if (dateKey === tomorrow) label = 'Tomorrow'
      groups.push({ label, date: dateKey, tasks })
    })

    return groups
  }, [sortedDates, tasksByDate])

  return (
    <div className="flex-1 overflow-y-auto p-5 bg-[#0f0f11]" style={{ display: 'flex', flexDirection: 'column' }}>
      {groupedTasks.map((group) => (
        <div key={group.date} style={{ marginBottom: '28px' }}>
          <div className="flex items-center gap-3 mb-4">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: group.label === 'Today' ? '#c4913a' : '#6a6660' }}
            >
              {group.label}
            </span>
            <span className="flex-1 h-px bg-[#2b2b2f]" />
          </div>
          <div style={{ padding: '0 12px' }}>
            {group.tasks.map((task) => {
              const color = task.color ?? '#c4913a'
              const scheduledDate = task.scheduled_date ? new Date(task.scheduled_date) : null
              const timeStr = scheduledDate
                ? scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                : ''

              return (
                <div
                  key={task.id}
                  onClick={() => onTaskClick(task.id)}
                  className="relative overflow-hidden cursor-pointer transition-all duration-300"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '20px',
                    padding: '18px',
                    marginBottom: '10px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ background: `linear-gradient(180deg, ${color}, ${color}88)` }}
                  />
                  <div className="flex items-start gap-4">
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: task.status === 'done' ? color : 'transparent',
                        borderColor: task.status === 'done' ? color : '#3d3d42',
                      }}
                    >
                      {task.status === 'done' && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0c0c0d" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div
                        className="text-base font-medium mb-1.5"
                        style={{
                          color: '#edeae2',
                          textDecoration: task.status === 'done' ? 'line-through' : 'none',
                          opacity: task.status === 'done' ? 0.5 : 1,
                        }}
                      >
                        {task.title}
                      </div>
                      <div className="flex items-center gap-4 text-xs" style={{ color: '#6a6660' }}>
                        <span>{task.project_name || 'No project'}</span>
                        {timeStr && (
                          <span className="flex items-center gap-1.5">
                            <Calendar size={11} />
                            {timeStr}
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className="text-sm font-semibold px-3 py-1.5 rounded-lg"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        color: '#9a9299',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      {task.duration_minutes || 60}m
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {sortedDates.length === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          <div style={{ textAlign: 'center', padding: '60px 20px', gridColumn: '1 / -1' }}>
            <div className="mb-4" style={{ opacity: 0.5, color: '#6a6660' }}>
              <Calendar size={48} strokeWidth={1} style={{ margin: '0 auto' }} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No upcoming tasks</div>
            <div style={{ fontSize: '13px', color: '#6a6660', marginBottom: '20px' }}>
              Schedule tasks to see them here.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}