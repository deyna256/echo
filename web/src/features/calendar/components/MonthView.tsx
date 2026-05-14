import { useState, useMemo } from 'react'
import type { CalendarTask } from './WeekView'
import { DayModal } from './DayModal'

export interface MonthViewProps {
  currentDate: Date
  tasks: CalendarTask[]
  onTaskClick: (taskId: string) => void
  onAddTask: (date: Date) => void
}

function getDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function MonthView({ currentDate, tasks, onTaskClick, onAddTask }: MonthViewProps) {
  const today = new Date()
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const todayStr = getDateString(today)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = (firstDay.getDay() + 6) % 7
    const totalDays = startPadding + lastDay.getDate()
    const weekCount = Math.ceil(totalDays / 7)
    const result: Date[][] = []
    for (let w = 0; w < weekCount; w++) {
      const week: Date[] = []
      for (let d = 0; d < 7; d++) {
        week.push(new Date(year, month, w * 7 + d - startPadding + 1))
      }
      result.push(week)
    }
    return result
  }, [year, month])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>()
    for (const task of tasks) {
      if (!task.scheduled_date) continue
      const key = task.scheduled_date.split('T')[0]
      map.set(key, [...(map.get(key) ?? []), task])
    }
    return map
  }, [tasks])

  const now = new Date()

  function cellBg(dayTasks: CalendarTask[], isCurrentMonth: boolean, hasOverdue: boolean, overdueCount: number, isWeekend: boolean): string {
    const weekend = isWeekend ? 'rgba(0,0,0,0.15)' : 'transparent'
    if (!isCurrentMonth || !dayTasks.length) return weekend
    if (hasOverdue) {
      const intensity = Math.min(0.20, 0.10 + overdueCount * 0.04)
      return `rgba(220,70,56,${intensity})`
    }
    const cnt = dayTasks.length
    const intensity = cnt <= 2 ? 0.06 : cnt <= 5 ? 0.13 : 0.22
    return `rgba(80,90,200,${intensity})`
  }

  return (
    <>
      <div className="flex-1 overflow-auto bg-[#0f0f11] p-4">
        <div
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(7,1fr)',
            gap: '1px', background: '#1e1e24', borderRadius: 12,
            overflow: 'hidden', height: 'calc(100vh - 140px)', minHeight: 400,
          }}
        >
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} style={{ background: '#0f0f16', padding: '5px 0', textAlign: 'center', fontSize: 8, color: '#2e2e3a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em' }}>
              {d}
            </div>
          ))}

          {weeks.map(week =>
            week.map(day => {
              const dateStr = getDateString(day)
              const dayTasks = tasksByDay.get(dateStr) ?? []
              const isCurrentMonth = day.getMonth() === month
              const isToday = isCurrentMonth && dateStr === todayStr
              const isWeekend = day.getDay() === 0 || day.getDay() === 6

              const hasOverdue = isCurrentMonth && dayTasks.some(t =>
                t.status === 'todo' && t.scheduled_date && new Date(t.scheduled_date) < now
              )
              const overdueCount = hasOverdue
                ? dayTasks.filter(t => t.status === 'todo' && t.scheduled_date && new Date(t.scheduled_date) < now).length
                : 0

              return (
                <div
                  key={dateStr}
                  onClick={() => isCurrentMonth && setSelectedDay(day)}
                  style={{
                    background: cellBg(dayTasks, isCurrentMonth, hasOverdue, overdueCount, isWeekend),
                    opacity: isCurrentMonth ? 1 : 0.12,
                    cursor: isCurrentMonth ? 'pointer' : 'default',
                    position: 'relative',
                    display: 'flex', flexDirection: 'column',
                    transition: 'filter 0.1s',
                  }}
                  onMouseEnter={e => { if (isCurrentMonth) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.15)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = '' }}
                >
                  {/* overdue badge */}
                  {hasOverdue && (
                    <div style={{
                      position: 'absolute', top: 3, left: 4, zIndex: 1,
                      fontSize: 7, fontWeight: 700, padding: '1.5px 5px',
                      borderRadius: 10, background: 'rgba(224,80,64,0.12)', color: '#e06050',
                    }}>
                      ⚠ {overdueCount}
                    </div>
                  )}

                  {/* date number */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '3px 4px 2px', flexShrink: 0 }}>
                    {isToday ? (
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg,#c4913a,#d4a44e)', color: '#0c0c0d', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {day.getDate()}
                      </span>
                    ) : (
                      <span style={{ width: 20, height: 20, borderRadius: '50%', fontSize: 10, fontWeight: 600, color: '#3a3a4a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {day.getDate()}
                      </span>
                    )}
                  </div>

                  {/* task count */}
                  {isCurrentMonth && dayTasks.length > 0 && (
                    <div style={{
                      position: 'absolute', bottom: 5, left: 5,
                      fontSize: 9, fontWeight: 700,
                      color: hasOverdue ? '#e06050' : '#6060a0',
                    }}>
                      {dayTasks.length}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {selectedDay && (
        <DayModal
          date={selectedDay}
          tasks={tasksByDay.get(getDateString(selectedDay)) ?? []}
          onClose={() => setSelectedDay(null)}
          onTaskClick={onTaskClick}
          onAddTask={onAddTask}
        />
      )}
    </>
  )
}
