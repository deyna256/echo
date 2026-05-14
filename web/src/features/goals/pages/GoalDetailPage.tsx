import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import { useGoal } from '../hooks/useGoals'
import type { Goal, Project, Task } from '../../../types'
import { ArrowLeft, Pencil, Trash2, Plus, X, FolderOpen, CheckCircle2 } from 'lucide-react'

export function GoalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: goal, isLoading } = useGoal(id)
  const { data: projects } = useProjects(id)

  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [taskForProject, setTaskForProject] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskScheduledDate, setNewTaskScheduledDate] = useState('')

  useEffect(() => {
    if (goal) {
      setEditTitle(goal.title)
      setEditDescription(goal.description || '')
    }
  }, [goal])

  const updateGoal = useMutation({
    mutationFn: (data: Partial<Goal>) => api.patch(`/goals/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goal', id] })
      setIsEditing(false)
    },
  })

  const deleteGoal = useMutation({
    mutationFn: () => api.delete(`/goals/${id}`),
    onSuccess: () => navigate('/goals'),
  })

  const handleSaveEdit = () => {
    updateGoal.mutate({
      title: editTitle,
      description: editDescription,
    })
  }

  const handleDelete = () => {
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    deleteGoal.mutate()
  }

  const openAddTaskModal = (projectId: string) => {
    setTaskForProject(projectId)
    setNewTaskTitle('')
    setNewTaskScheduledDate('')
    setIsAddTaskOpen(true)
  }

  const createTask = useMutation({
    mutationFn: ({ projectId, title, scheduledDate }: { projectId: string; title: string; scheduledDate?: string }) =>
      api.post(`/projects/${projectId}/tasks`, { title, scheduled_date: scheduledDate || null }),
    onSuccess: () => {
      if (taskForProject) {
        queryClient.invalidateQueries({ queryKey: ['tasks', taskForProject] })
        queryClient.invalidateQueries({ queryKey: ['projects', id] })
      }
      setIsAddTaskOpen(false)
      setTaskForProject(null)
      setNewTaskTitle('')
      setNewTaskScheduledDate('')
    },
  })

  const handleAddTask = () => {
    if (!taskForProject || !newTaskTitle.trim()) return
    createTask.mutate({ projectId: taskForProject, title: newTaskTitle.trim(), scheduledDate: newTaskScheduledDate || undefined })
  }

  const toggleTaskStatus = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      api.patch(`/tasks/${taskId}`, { status }),
    onSuccess: () => {
      if (taskForProject) {
        queryClient.invalidateQueries({ queryKey: ['tasks', taskForProject] })
        queryClient.invalidateQueries({ queryKey: ['projects', id] })
      }
    },
  })

  const totalTasks = projects?.reduce((sum, p) => sum + ((p as any).task_count || 0), 0) || 0
  const doneTasks = projects?.reduce((sum, p) => sum + ((p as any).done_count || 0), 0) || 0
  const completionPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-text-muted">Loading...</div>
      </div>
    )
  }

  if (!goal) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <p className="text-text-muted mb-4">Goal not found</p>
        <button onClick={() => navigate('/goals')} className="text-gold hover:underline cursor-pointer">
          Back to goals
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #2b2b2f', display: 'flex', alignItems: 'center', gap: '16px', background: '#141416' }}>
          <button onClick={() => navigate('/goals')} style={{ background: 'none', border: 'none', color: '#6a6660', fontSize: '18px', cursor: 'pointer', padding: '4px 8px' }}><ArrowLeft size={20} /></button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>{goal.title}</h1>
            <p style={{ fontSize: '12px', color: '#6a6660' }}>{goal.description || 'No description'}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setIsEditing(true)} style={{ background: '#1a1a1d', color: '#8a8680', border: '1px solid #2b2b2f', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Pencil size={14} /> Edit</button>
            <button onClick={handleDelete} style={{ background: '#1a1a1d', color: '#f87171', border: '1px solid #2b2b2f', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Trash2 size={14} /> Delete</button>
            <button style={{ background: '#c4913a', color: '#0c0c0d', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>+ Add Project</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: '#6a6660' }}>Overall Progress</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#edeae2' }}>{doneTasks}/{totalTasks} tasks ({completionPercent}%)</span>
            </div>
            <div style={{ height: '6px', background: '#141416', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${completionPercent}%`, background: '#c4913a', borderRadius: '3px', transition: 'width 0.3s ease' }} />
            </div>
          </div>

          <div style={{ background: '#141416', border: '1px solid #2b2b2f', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '24px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#8a8680' }}><FolderOpen size={14} /> {projects?.length || 0} projects</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#8a8680' }}><CheckCircle2 size={14} /> {doneTasks} tasks done</span>
            </div>
          </div>

          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: 600, color: '#8a8680', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Projects
                <span style={{ background: 'rgba(196,145,58,0.15)', color: '#c4913a', fontSize: '10px', padding: '3px 8px', borderRadius: '10px' }}>{projects?.length || 0}</span>
              </div>
              <button style={{ background: 'none', border: '1px dashed #2b2b2f', color: '#6a6660', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>+ Add Project</button>
            </div>

            {projects?.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={index + 1}
                onAddTask={openAddTaskModal}
                onToggleTask={(taskId, status) => toggleTaskStatus.mutate({ taskId, status })}
              />
            ))}
          </div>
        </div>
      </div>

      {isEditing && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#141416', border: '1px solid #2b2b2f', borderRadius: '12px', width: '560px', maxHeight: '80vh', overflow: 'hidden', animation: 'slideUp 0.2s ease' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #2b2b2f', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Edit Goal</div>
              <button onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', color: '#6a6660', cursor: 'pointer', fontSize: '18px' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8a8680', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Goal Name</label>
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ background: '#0c0c0d', border: '1px solid #2b2b2f', borderRadius: '8px', color: '#edeae2', fontFamily: 'inherit', fontSize: '16px', fontWeight: 600, padding: '12px 14px', width: '100%', marginBottom: '16px' }} />

              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8a8680', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Description</label>
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} style={{ background: '#0c0c0d', border: '1px solid #2b2b2f', borderRadius: '8px', color: '#edeae2', fontFamily: 'inherit', fontSize: '13px', padding: '12px 14px', width: '100%', minHeight: '120px', resize: 'vertical', lineHeight: 1.6, marginBottom: '16px' }} />
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid #2b2b2f', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setIsEditing(false)} style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: '#1a1a1d', color: '#8a8680', border: '1px solid #2b2b2f' }}>Cancel</button>
              <button onClick={handleSaveEdit} style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: '#c4913a', color: '#0c0c0d', border: 'none' }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#141416', border: '1px solid #2b2b2f', borderRadius: '12px', width: '400px', overflow: 'hidden' }}>
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(248,113,113,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Trash2 size={24} style={{ color: '#f87171' }} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Delete Goal</h3>
              <p style={{ fontSize: '14px', color: '#8a8680' }}>Are you sure you want to delete this goal? This action cannot be undone.</p>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid #2b2b2f', display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', background: '#1a1a1d', color: '#8a8680', border: '1px solid #2b2b2f' }}>Cancel</button>
              <button onClick={confirmDelete} style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', background: '#f87171', color: '#fff', border: 'none' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {isAddTaskOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#141416', border: '1px solid #2b2b2f', borderRadius: '12px', width: '400px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #2b2b2f', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Add Task</div>
              <button onClick={() => setIsAddTaskOpen(false)} style={{ background: 'none', border: 'none', color: '#6a6660', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8a8680', marginBottom: '8px' }}>Task Name</label>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                placeholder="e.g., Design database schema"
                autoFocus
                style={{ width: '100%', background: '#0c0c0d', border: '1px solid #2b2b2f', borderRadius: '8px', color: '#edeae2', fontFamily: 'inherit', fontSize: '14px', padding: '10px 12px', marginBottom: '16px' }}
              />
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8a8680', marginBottom: '8px' }}>Scheduled Date</label>
              <input
                type="date"
                value={newTaskScheduledDate}
                onChange={(e) => setNewTaskScheduledDate(e.target.value)}
                style={{ width: '100%', background: '#0c0c0d', border: '1px solid #2b2b2f', borderRadius: '8px', color: '#edeae2', fontFamily: 'inherit', fontSize: '14px', padding: '10px 12px' }}
              />
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid #2b2b2f', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsAddTaskOpen(false)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: '#1a1a1d', color: '#8a8680', border: '1px solid #2b2b2f' }}>Cancel</button>
              <button onClick={handleAddTask} disabled={!newTaskTitle.trim() || createTask.isPending} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: newTaskTitle.trim() ? 'pointer' : 'not-allowed', background: newTaskTitle.trim() ? '#c4913a' : 'rgba(196,145,58,0.3)', color: '#0c0c0d', border: 'none' }}>
                {createTask.isPending ? 'Adding...' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function useProjects(goalId?: string) {
  return useQuery({
    queryKey: ['projects', goalId],
    queryFn: () => api.get<Project[]>(`/goals/${goalId}/projects`),
    enabled: !!goalId,
  })
}

function ProjectCard({ project, index, onAddTask, onToggleTask }: { project: Project; index: number; onAddTask: (projectId: string) => void; onToggleTask: (taskId: string, status: string) => void }) {
  const { data: tasks } = useTasks(project.id)
  const doneTasks = tasks?.filter(t => t.status === 'done').length || 0
  const totalTasks = tasks?.length || 0
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  return (
    <div style={{ background: '#141416', border: '1px solid #2b2b2f', borderRadius: '12px', padding: '16px 20px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
        <div style={{ width: '28px', height: '28px', background: 'rgba(196,145,58,0.15)', color: '#c4913a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
          {index}
        </div>
        <span style={{ flex: 1, fontSize: '15px', fontWeight: 600 }}>{project.title}</span>
        <span style={{ fontSize: '11px', color: '#6a6660' }}>{doneTasks}/{totalTasks} tasks</span>
        <div style={{ display: 'flex', gap: '4px', opacity: 0, transition: 'opacity 0.15s ease' }} className="project-actions">
          <button style={{ background: 'none', border: 'none', color: '#6a6660', cursor: 'pointer', fontSize: '14px', padding: '4px' }}><Pencil size={14} /></button>
          <button style={{ background: 'none', border: 'none', color: '#6a6660', cursor: 'pointer', fontSize: '14px', padding: '4px' }}><Trash2 size={14} /></button>
        </div>
      </div>
      <div style={{ height: '3px', background: '#1a1a1d', borderRadius: '2px', overflow: 'hidden', marginBottom: '10px' }}>
        <div style={{ height: '100%', width: `${progressPercent}%`, background: '#c4913a', borderRadius: '2px' }} />
      </div>
      <div style={{ marginTop: '12px', paddingLeft: '40px' }}>
        {tasks?.slice(0, 3).map((task) => (
          <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', fontSize: '13px' }}>
            <div
              onClick={() => onToggleTask(task.id, task.status === 'done' ? 'todo' : 'done')}
              style={{ width: '16px', height: '16px', border: '1px solid #2b2b2f', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: task.status === 'done' ? '#c4913a' : 'transparent', borderColor: task.status === 'done' ? '#c4913a' : '#2b2b2f' }}
            >
              {task.status === 'done' && <CheckCircle2 size={12} style={{ color: '#0c0c0d' }} />}
            </div>
            <span style={{ flex: 1, textDecoration: task.status === 'done' ? 'line-through' : 'none', color: task.status === 'done' ? '#6a6660' : '#edeae2' }}>{task.title}</span>
            <div style={{ opacity: 0, transition: 'opacity 0.15s ease' }} className="task-actions">
              <button style={{ background: 'none', border: 'none', color: '#6a6660', cursor: 'pointer', fontSize: '14px', padding: '4px' }}><Pencil size={14} /></button>
              <button style={{ background: 'none', border: 'none', color: '#6a6660', cursor: 'pointer', fontSize: '14px', padding: '4px' }}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        <button
          onClick={() => onAddTask(project.id)}
          style={{ background: 'none', border: 'none', color: '#6a6660', cursor: 'pointer', fontSize: '12px', padding: '8px 0', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Plus size={12} /> Add task
        </button>
        {totalTasks > 3 && (
          <div style={{ fontSize: '11px', color: '#6a6660', padding: '4px 0 4px 26px' }}>+ {totalTasks - 3} more tasks</div>
        )}
      </div>
    </div>
  )
}

function useTasks(projectId: string) {
  return useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.get<Task[]>(`/projects/${projectId}/tasks`),
  })
}