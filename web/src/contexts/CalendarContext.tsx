import { createContext, useContext, useState, useCallback } from 'react'

type CalendarView = 'week' | 'month' | 'agenda'

// Define minimal type locally to avoid circular imports
export interface ContextTask {
  id: string
  status: 'todo' | 'postponed' | 'done'
  scheduled_date: string | null
  title: string
  color?: string | null
}

interface CalendarContextValue {
  view: CalendarView
  setView: (v: CalendarView) => void
  currentDate: Date
  setCurrentDate: (d: Date) => void
  tasks: ContextTask[]
  setTasks: (tasks: ContextTask[]) => void
}

const CalendarContext = createContext<CalendarContextValue | null>(null)

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<CalendarView>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [tasks, setTasks] = useState<ContextTask[]>([])

  return (
    <CalendarContext.Provider value={{ view, setView, currentDate, setCurrentDate, tasks, setTasks }}>
      {children}
    </CalendarContext.Provider>
  )
}

export function useCalendar() {
  const ctx = useContext(CalendarContext)
  if (!ctx) throw new Error('useCalendar must be used within CalendarProvider')
  return ctx
}