import { Folder, Plus, Check, Calendar, Sparkles } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import { Modal, SuggestionCard } from '../../../components'
import type { Project, Task, CreateProjectRequest } from '../../../types'

interface ImproveResponse {
  suggestion: string
  reasoning?: string
}

interface ProjectSuggestion {
  original: { title: string; description: string }
  suggestion: { title: string; description: string }
  reasoning?: string
}

export function ProjectsListPage() {
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projectSuggestion, setProjectSuggestion] = useState<ProjectSuggestion | null>(null)
  const [isImproveLoading, setIsImproveLoading] = useState(false)
  const { data: projects, isLoading } = useQuery({
    queryKey: ['all_projects'],
    queryFn: () => api.get<Project[]>('/projects'),
  })

  const { data: projectTasks } = useQuery({
    queryKey: ['project_tasks', selectedProject?.id],
    queryFn: () => api.get<Task[]>(`/projects/${selectedProject?.id}/tasks`),
    enabled: !!selectedProject?.id,
  })

  const { data: unassignedTasks } = useQuery({
    queryKey: ['unassigned_tasks'],
    queryFn: () => api.get<Task[]>('/tasks/unassigned'),
  })


  const createMutation = useMutation({
    mutationFn: (data: CreateProjectRequest) => api.post<Project>('/projects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_projects'] })
      setIsCreateOpen(false)
      setTitle('')
      setDescription('')
      setTargetDate('')
    },
  })

  const updateProjectMutation = useMutation({
    mutationFn: ({ projectId, ...data }: { projectId: string } & Partial<Project>) =>
      api.patch(`/projects/${projectId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_projects'] })
      setProjectSuggestion(null)
    },
  })

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: string) => api.delete(`/projects/${projectId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_projects'] })
      setSelectedProject(null)
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: ({ projectId, title }: { projectId: string; title: string }) =>
      api.post(`/projects/${projectId}/tasks`, { title }),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['project_tasks', projectId] })
      queryClient.invalidateQueries({ queryKey: ['all_projects'] })
    },
  })

  const toggleTaskMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      api.patch(`/tasks/${taskId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_tasks', selectedProject?.id] })
      queryClient.invalidateQueries({ queryKey: ['all_projects'] })
    },
  })

  const improveProject = async (comment?: string) => {
    if (!selectedProject) return
    setIsImproveLoading(true)
    try {
      const promptComment = comment ? `\nUser feedback: "${comment}"` : ''
      const res = await api.post<ImproveResponse>('/ai/improve/project', {
        project_title: selectedProject.title + promptComment,
        project_description: selectedProject.description,
      })
      const [newTitle, newDesc] = res.suggestion.split('|')
      if (newTitle && newDesc) {
        setProjectSuggestion({
          original: { title: selectedProject.title, description: selectedProject.description },
          suggestion: { title: newTitle.trim(), description: newDesc.trim() },
          reasoning: res.reasoning,
        })
      }
    } catch (e) {
      console.error('Failed to improve project:', e)
    }
    setIsImproveLoading(false)
  }

  const acceptSuggestion = () => {
    if (!projectSuggestion || !selectedProject) return
    const projectId = selectedProject.id
    const newTitle = projectSuggestion.suggestion.title
    const newDesc = projectSuggestion.suggestion.description
    setProjectSuggestion(null)
    updateProjectMutation.mutate({
      projectId,
      title: newTitle,
      description: newDesc,
    })
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      target_date: targetDate || undefined,
    })
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#edeae2', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Folder size={20} style={{ color: '#c4913a' }} />
            Projects
          </h1>
          <p style={{ fontSize: '13px', color: '#6a6660', margin: '4px 0 0' }}>Organize tasks into projects</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            background: '#c4913a',
            color: '#0c0c0d',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Plus size={14} /> New Project
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: '#141416', border: '1px solid #2b2b2f', borderRadius: '12px', padding: '20px', height: '120px', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : !projects?.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          <div style={{ textAlign: 'center', padding: '60px 20px', gridColumn: '1 / -1' }}>
            <div style={{ marginBottom: '16px', opacity: 0.5, color: '#6a6660' }}><Folder size={48} strokeWidth={1} /></div>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No projects yet</div>
            <div style={{ fontSize: '13px', color: '#6a6660', marginBottom: '20px' }}>
              Create projects to organize your tasks.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {projects.map(project => (
            <div
              key={project.id}
              style={{
                background: '#141416',
                border: '1px solid #2b2b2f',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => setSelectedProject(project)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3d3d42' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2b2b2f' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ width: 4, height: '100%', minHeight: 40, borderRadius: 2, background: '#c4913a', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#edeae2', marginBottom: 4 }}>{project.title}</div>
                  {project.description && (
                    <div style={{ fontSize: '12px', color: '#6a6660', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {project.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#57535e' }}>
                    {project.target_date && <span>Due: {new Date(project.target_date).toLocaleDateString()}</span>}
                    <span style={{ padding: '2px 6px', borderRadius: 4, background: project.status === 'done' ? 'rgba(75,211,100,0.15)' : 'rgba(196,145,58,0.15)', color: project.status === 'done' ? '#4bd364' : '#c4913a' }}>
                      {project.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Project">
        <form onSubmit={handleCreate}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8a8680', marginBottom: '6px' }}>Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Project title"
              autoFocus
              style={{ width: '100%', padding: '10px 12px', background: '#1a1a1d', border: '1px solid #2b2b2f', borderRadius: '8px', color: '#edeae2', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8a8680', marginBottom: '6px' }}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Enter project description (optional)"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', background: '#1a1a1d', border: '1px solid #2b2b2f', borderRadius: '8px', color: '#edeae2', fontSize: '13px', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8a8680', marginBottom: '6px' }}>Target Date</label>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', background: '#1a1a1d', border: '1px solid #2b2b2f', borderRadius: '8px', color: '#edeae2', fontSize: '13px', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setIsCreateOpen(false)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: '#1a1a1d', color: '#8a8680', border: '1px solid #2b2b2f' }}>Cancel</button>
            <button type="submit" disabled={!title.trim() || createMutation.isPending} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: title.trim() && !createMutation.isPending ? 'pointer' : 'not-allowed', background: title.trim() ? '#c4913a' : 'rgba(196,145,58,0.3)', color: '#0c0c0d', border: 'none' }}>
              {createMutation.isPending ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </Modal>

      <ProjectModal
        project={selectedProject}
        tasks={projectTasks || []}
        unassignedTasks={unassignedTasks || []}
        suggestion={projectSuggestion}
        isImproveLoading={isImproveLoading}
        onClose={() => {
          setSelectedProject(null)
          setProjectSuggestion(null)
        }}
        onUpdate={(data) => updateProjectMutation.mutate({ projectId: selectedProject!.id, ...data })}
        onDelete={() => selectedProject && deleteProjectMutation.mutate(selectedProject.id)}
        onAddTask={(title) => selectedProject && createTaskMutation.mutate({ projectId: selectedProject.id, title })}
        onToggleTask={(taskId, status) => toggleTaskMutation.mutate({ taskId, status })}
        onAttachTasks={(taskIds) => {
          if (!selectedProject) return
          Promise.all(taskIds.map(id => api.patch(`/tasks/${id}`, { project_id: selectedProject.id }))).then(() => {
            queryClient.invalidateQueries({ queryKey: ['project_tasks', selectedProject.id] })
            queryClient.invalidateQueries({ queryKey: ['unassigned_tasks'] })
            queryClient.invalidateQueries({ queryKey: ['all_projects'] })
          })
        }}
        onImprove={improveProject}
        onAcceptSuggestion={acceptSuggestion}
        onRejectSuggestion={() => setProjectSuggestion(null)}
        isUpdating={updateProjectMutation.isPending}
        isDeleting={deleteProjectMutation.isPending}
      />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

function ProjectModal({
  project,
  tasks,
  unassignedTasks,
  suggestion,
  isImproveLoading,
  onClose,
  onUpdate,
  onDelete,
  onAddTask,
  onToggleTask,
  onAttachTasks,
  onImprove,
  onAcceptSuggestion,
  onRejectSuggestion,
  isUpdating,
  isDeleting,
}: {
  project: Project | null
  tasks: Task[]
  unassignedTasks: Task[]
  suggestion: ProjectSuggestion | null
  isImproveLoading: boolean
  onClose: () => void
  onUpdate: (data: any) => void
  onDelete: () => void
  onAddTask: (title: string) => void
  onToggleTask: (taskId: string, status: string) => void
  onAttachTasks: (taskIds: string[]) => void
  onImprove: (comment?: string) => void
  onAcceptSuggestion: () => void
  onRejectSuggestion: () => void
  isUpdating: boolean
  isDeleting: boolean
}) {
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAttachTasks, setShowAttachTasks] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (project) {
      setEditTitle(project.title)
      setEditDescription(project.description || '')
    }
  }, [project])

  if (!project) return null

  const handleSave = () => {
    onUpdate({ title: editTitle, description: editDescription })
  }

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return
    onAddTask(newTaskTitle.trim())
    setNewTaskTitle('')
  }

  return (
    <Modal isOpen={!!project} onClose={onClose} title="Project" size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => onImprove()}
            disabled={isImproveLoading || !!suggestion}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: isImproveLoading || suggestion ? 'not-allowed' : 'pointer',
              background: isImproveLoading || suggestion ? 'rgba(196,145,58,0.4)' : '#c4913a',
              color: '#0c0c0d',
              border: 'none',
            }}
          >
            <Sparkles size={14} />
            {isImproveLoading ? 'Improving...' : 'Improve with AI'}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'rgba(217,91,91,0.15)', color: '#d95b5b', border: '1px solid rgba(217,91,91,0.3)' }}
          >
            Delete
          </button>
        </div>

        {suggestion && (
          <SuggestionCard
            original={suggestion.original.title + '\n---\n' + suggestion.original.description}
            suggestion={suggestion.suggestion.title + '\n---\n' + suggestion.suggestion.description}
            reasoning={suggestion.reasoning}
            onAccept={onAcceptSuggestion}
            onReject={onRejectSuggestion}
            onRefine={(comment) => onImprove(comment)}
          />
        )}

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8a8680', marginBottom: '6px' }}>Title</label>
          <input
            type="text"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', background: '#1a1a1d', border: '1px solid #2b2b2f', borderRadius: '8px', color: '#edeae2', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8a8680', marginBottom: '6px' }}>Description</label>
          <textarea
            value={editDescription}
            onChange={e => setEditDescription(e.target.value)}
            rows={2}
            style={{ width: '100%', padding: '10px 12px', background: '#1a1a1d', border: '1px solid #2b2b2f', borderRadius: '8px', color: '#edeae2', fontSize: '13px', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={isUpdating || !editTitle.trim() || (editTitle === project.title && editDescription === (project.description || ''))}
          style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: '#c4913a', color: '#0c0c0d', border: 'none', opacity: (!editTitle.trim() || (editTitle === project.title && editDescription === (project.description || ''))) ? 0.5 : 1 }}
        >
          {isUpdating ? 'Saving...' : 'Save Changes'}
        </button>

        <div style={{ borderTop: '1px solid #2b2b2f', paddingTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Calendar size={14} style={{ color: '#6a6660' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#edeae2' }}>Tasks</span>
            <span style={{ fontSize: '11px', color: '#6a6660', marginLeft: 'auto' }}>{tasks.filter(t => t.status === 'done').length}/{tasks.length} done</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', maxHeight: '300px', overflowY: 'auto' }}>
            {tasks.map(task => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#1a1a1d', borderRadius: '8px', border: '1px solid #2b2b2f' }}>
                <button
                  onClick={() => onToggleTask(task.id, task.status === 'done' ? 'todo' : 'done')}
                  style={{ width: 20, height: 20, borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: task.status === 'done' ? '#4bd364' : 'transparent', borderColor: task.status === 'done' ? '#4bd364' : '#3d3d42', borderWidth: 2, borderStyle: 'solid' }}
                >
                  {task.status === 'done' && <Check size={12} style={{ color: '#0c0c0d' }} />}
                </button>
                <span style={{ flex: 1, fontSize: '13px', color: task.status === 'done' ? '#6a6660' : '#edeae2', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</span>
              </div>
            ))}
            {tasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#57535e', fontSize: '13px' }}>
                No tasks yet
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              type="text"
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTask()}
              placeholder="Add a task..."
              style={{ flex: 1, padding: '8px 12px', background: '#1a1a1d', border: '1px solid #2b2b2f', borderRadius: '8px', color: '#edeae2', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />
            <button onClick={handleAddTask} disabled={!newTaskTitle.trim()} style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: '#c4913a', color: '#0c0c0d', border: 'none', opacity: newTaskTitle.trim() ? 1 : 0.5 }}>
              <Plus size={14} />
            </button>
          </div>

          {unassignedTasks && unassignedTasks.length > 0 && (
            <button
              onClick={() => setShowAttachTasks(true)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                background: '#1a1a1d',
                color: '#8a8680',
                border: '1px solid #2b2b2f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Plus size={14} />
              Attach existing tasks ({unassignedTasks.length})
            </button>
          )}
        </div>

        {showDeleteConfirm && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowDeleteConfirm(false)} />
            <div style={{ position: 'relative', background: '#141416', border: '1px solid #2b2b2f', borderRadius: '12px', padding: '20px', maxWidth: '400px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Delete Project?</h3>
              <p style={{ fontSize: '13px', color: '#6a6660', marginBottom: '20px' }}>This will delete "{project.title}" and all its tasks. This action cannot be undone.</p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: '#1a1a1d', color: '#8a8680', border: '1px solid #2b2b2f' }}>Cancel</button>
                <button onClick={onDelete} disabled={isDeleting} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: '#d95b5b', color: '#0c0c0d', border: 'none' }}>
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showAttachTasks && unassignedTasks && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => { setShowAttachTasks(false); setSelectedTaskIds(new Set()) }} />
            <div style={{ position: 'relative', background: '#141416', border: '1px solid #2b2b2f', borderRadius: '12px', padding: '20px', maxWidth: '500px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Attach Tasks</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
                {unassignedTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => {
                      const newSet = new Set(selectedTaskIds)
                      if (newSet.has(task.id)) newSet.delete(task.id)
                      else newSet.add(task.id)
                      setSelectedTaskIds(newSet)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      background: selectedTaskIds.has(task.id) ? 'rgba(196,145,58,0.15)' : '#1a1a1d',
                      borderRadius: '8px',
                      border: `1px solid ${selectedTaskIds.has(task.id) ? '#c4913a' : '#2b2b2f'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: `2px solid ${selectedTaskIds.has(task.id) ? '#c4913a' : '#3d3d42'}`,
                      background: selectedTaskIds.has(task.id) ? '#c4913a' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {selectedTaskIds.has(task.id) && <Check size={12} style={{ color: '#0c0c0d' }} />}
                    </div>
                    <span style={{ flex: 1, fontSize: '13px', color: '#edeae2' }}>{task.title}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowAttachTasks(false); setSelectedTaskIds(new Set()) }}
                  style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: '#1a1a1d', color: '#8a8680', border: '1px solid #2b2b2f' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onAttachTasks(Array.from(selectedTaskIds))
                    setShowAttachTasks(false)
                    setSelectedTaskIds(new Set())
                  }}
                  disabled={selectedTaskIds.size === 0}
                  style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: selectedTaskIds.size > 0 ? 'pointer' : 'not-allowed', background: selectedTaskIds.size > 0 ? '#c4913a' : 'rgba(196,145,58,0.3)', color: '#0c0c0d', border: 'none' }}
                >
                  {`Attach (${selectedTaskIds.size})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}