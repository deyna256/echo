import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import type { Task } from '../../../types'
import { WeekView, MonthView, AgendaView, TaskForm } from '../components'
import { useCalendar } from '../../../contexts/CalendarContext'

interface CalendarTask extends Task {
  project_name?: string
}

export function CalendarPage() {
  const { view, currentDate, setCurrentDate, setTasks } = useCalendar()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formTask, setFormTask] = useState<Task | undefined>(undefined)
  const [formInitialDate, setFormInitialDate] = useState<Date | undefined>(undefined)
  const [draggedTaskId] = useState<string | null>(null)
  const lastDropRef = useRef<{ taskId: string; time: number } | null>(null)
  const queryClient = useQueryClient()

  const { data: taskData } = useQuery({
    queryKey: ['calendar_tasks'],
    queryFn: () => api.get<CalendarTask[]>('/tasks'),
  })

  useEffect(() => {
    setTasks(taskData || [])
  }, [taskData, setTasks])

  const tasksByDate = useMemo(() => {
    const map: Record<string, CalendarTask[]> = {}
    taskData?.forEach((task) => {
      if (task.scheduled_date) {
        const dateKey = task.scheduled_date.split('T')[0]
        if (!map[dateKey]) map[dateKey] = []
        map[dateKey].push(task)
      }
    })
    return map
  }, [taskData])

  const updateTask = useMutation({
    mutationFn: ({ taskId, scheduledDate, durationMinutes, color }: { taskId: string; scheduledDate: string | null; durationMinutes?: number; color?: string }) =>
      api.patch(`/tasks/${taskId}`, { scheduled_date: scheduledDate, duration_minutes: durationMinutes, color }),
    onMutate: async ({ taskId, scheduledDate, durationMinutes, color }) => {
      await queryClient.cancelQueries({ queryKey: ['calendar_tasks'] })
      const previousTasks = queryClient.getQueryData<CalendarTask[]>(['calendar_tasks'])
      queryClient.setQueryData<CalendarTask[]>(['calendar_tasks'], (old) => {
        if (!old) return old
        return old.map((task) =>
          task.id === taskId
            ? { ...task, scheduled_date: scheduledDate, duration_minutes: durationMinutes ?? task.duration_minutes, color: color ?? task.color }
            : task
        )
      })
      return { previousTasks }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['calendar_tasks'], context.previousTasks)
      }
    },
  })

  const updateTaskStatus = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: 'todo' | 'done' | 'postponed' }) =>
      api.patch(`/tasks/${taskId}`, { status }),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['calendar_tasks'] })
      const previousTasks = queryClient.getQueryData<CalendarTask[]>(['calendar_tasks'])
      queryClient.setQueryData<CalendarTask[]>(['calendar_tasks'], (old) => {
        if (!old) return old
        return old.map((task) => task.id === taskId ? { ...task, status } : task)
      })
      return { previousTasks }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['calendar_tasks'], context.previousTasks)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['calendar_tasks'] }),
  })

  const deleteTask = useMutation({
    mutationFn: (taskId: string) => api.delete(`/tasks/${taskId}`),
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ['calendar_tasks'] })
      const prev = queryClient.getQueryData<CalendarTask[]>(['calendar_tasks'])
      queryClient.setQueryData<CalendarTask[]>(['calendar_tasks'], old =>
        old ? old.filter(t => t.id !== taskId) : old
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['calendar_tasks'], ctx.prev)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['calendar_tasks'] }),
  })

  const handleTaskStatusChange = (taskId: string, status: 'todo' | 'done' | 'postponed') => {
    updateTaskStatus.mutate({ taskId, status })
  }

  const handleTaskMove = (taskId: string, newStart: Date, durationMinutes?: number) => {
    updateTask.mutate({ taskId, scheduledDate: newStart.toISOString(), durationMinutes })
  }

  const handleTaskResize = (taskId: string, newStart: Date, newDuration: number) => {
    updateTask.mutate({ taskId, scheduledDate: newStart.toISOString(), durationMinutes: newDuration })
  }

  const handleTaskClick = (taskId: string) => {
    const task = taskData?.find(t => t.id === taskId)
    if (task) {
      setFormTask(task)
      setFormInitialDate(undefined)
      setIsFormOpen(true)
    }
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setFormTask(undefined)
    setFormInitialDate(undefined)
  }

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
        {/* Calendar Content */}
        <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          {view === 'month' && (
            <MonthView
              currentDate={currentDate}
              tasks={taskData || []}
              onTaskClick={handleTaskClick}
              onAddTask={(date) => { setFormInitialDate(date); setFormTask(undefined); setIsFormOpen(true) }}
            />
          )}
          {view === 'week' && (
            <WeekView
              currentDate={currentDate}
              tasks={taskData || []}
              onTaskMove={handleTaskMove}
              onTaskResize={handleTaskResize}
              onTaskClick={handleTaskClick}
              onEmptySlotClick={(date) => { setFormInitialDate(date); setFormTask(undefined); setIsFormOpen(true) }}
              draggedTaskId={draggedTaskId}
              onTaskStatusChange={handleTaskStatusChange}
              onDeleteTask={(taskId) => deleteTask.mutate(taskId)}
              onDropTask={(taskId, date) => {
                const now = Date.now()
                if (lastDropRef.current && lastDropRef.current.taskId === taskId && now - lastDropRef.current.time < 2000) return
                lastDropRef.current = { taskId, time: now }
                const scheduledDate = new Date(date)
                scheduledDate.setHours(9, 0, 0, 0)
                updateTask.mutate({
                  taskId,
                  scheduledDate: scheduledDate.toISOString(),
                  durationMinutes: taskData?.find(t => t.id === taskId)?.duration_minutes,
                })
              }}
            />
          )}
          {view === 'agenda' && <AgendaView tasksByDate={tasksByDate} onTaskClick={handleTaskClick} />}
        </div>
      </div>

      {isFormOpen && (
        <TaskForm
          task={formTask}
          initialDate={formInitialDate}
          onClose={closeForm}
          onSaved={closeForm}
        />
      )}
    </div>
  )
}