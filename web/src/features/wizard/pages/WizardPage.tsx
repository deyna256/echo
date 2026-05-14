import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import { SuggestionCard, Modal } from '../../../components'
import { Sparkles, Plus, X, FolderOpen } from 'lucide-react'

type WizardStep = 1 | 2

interface ProjectInput {
  id: string
  title: string
  description: string
  tasks: { id: string; title: string }[]
}

interface ImproveResponse {
  suggestion: string
  reasoning?: string
}

interface ProjectSuggestion {
  projectId: string
  original: { title: string; description: string }
  suggestion: { title: string; description: string }
  reasoning?: string
}

interface TitleSuggestion {
  original: string
  suggestion: string
  reasoning?: string
}

interface DescriptionSuggestion {
  original: string
  suggestion: string
  reasoning?: string
}

export function WizardPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<WizardStep>(1)

  const [goalTitle, setGoalTitle] = useState('')
  const [goalDescription, setGoalDescription] = useState('')
  const [goalTargetDate, setGoalTargetDate] = useState('')

  const [projects, setProjects] = useState<ProjectInput[]>([])

  const [titleSuggestion, setTitleSuggestion] = useState<TitleSuggestion | null>(null)
  const [descSuggestion, setDescSuggestion] = useState<DescriptionSuggestion | null>(null)
  const [projectSuggestions, setProjectSuggestions] = useState<Record<string, ProjectSuggestion>>({})

  const [isTitleLoading, setIsTitleLoading] = useState(false)
  const [isDescLoading, setIsDescLoading] = useState(false)
  const [isProjectLoading, setIsProjectLoading] = useState<string | null>(null)

  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')

  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [taskForProject, setTaskForProject] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [isAttachProjectOpen, setIsAttachProjectOpen] = useState(false)

  const { data: availableProjects } = useQuery({
    queryKey: ['available_projects'],
    queryFn: () => api.get<{ id: string; title: string; description: string }[]>('/projects?unattached=true'),
  })

  const improveTitle = async (comment?: string) => {
    setIsTitleLoading(true)
    try {
      const promptComment = comment ? `\nUser feedback: "${comment}"` : ''
      const res = await api.post<ImproveResponse>('/ai/improve/goal-title', {
        title: goalTitle,
        description: goalDescription + promptComment,
      })
      setTitleSuggestion({
        original: goalTitle,
        suggestion: res.suggestion,
        reasoning: res.reasoning,
      })
    } catch (e) {
      console.error('Failed to improve title:', e)
    }
    setIsTitleLoading(false)
  }

  const improveDescription = async (comment?: string) => {
    setIsDescLoading(true)
    try {
      const promptComment = comment ? `\nUser feedback: "${comment}"` : ''
      const res = await api.post<ImproveResponse>('/ai/improve/goal-description', {
        title: goalTitle + promptComment,
        description: goalDescription,
      })
      setDescSuggestion({
        original: goalDescription,
        suggestion: res.suggestion,
        reasoning: res.reasoning,
      })
    } catch (e) {
      console.error('Failed to improve description:', e)
    }
    setIsDescLoading(false)
  }

  const acceptTitle = () => {
    if (titleSuggestion) {
      setGoalTitle(titleSuggestion.suggestion)
      setTitleSuggestion(null)
    }
  }

  const rejectTitle = () => {
    setTitleSuggestion(null)
  }

  const acceptDescription = () => {
    if (descSuggestion) {
      setGoalDescription(descSuggestion.suggestion)
      setDescSuggestion(null)
    }
  }

  const rejectDescription = () => {
    setDescSuggestion(null)
  }

  const acceptProjectSuggestion = (projectId: string) => {
    const sugg = projectSuggestions[projectId]
    if (sugg) {
      setProjects(prev => prev.map(p => {
        if (p.id === projectId) {
          return { ...p, title: sugg.suggestion.title, description: sugg.suggestion.description }
        }
        return p
      }))
      setProjectSuggestions(prev => {
        const next = { ...prev }
        delete next[projectId]
        return next
      })
    }
  }

  const rejectProjectSuggestion = (projectId: string) => {
    setProjectSuggestions(prev => {
      const next = { ...prev }
      delete next[projectId]
      return next
    })
  }

  const openAddTaskModal = (projectId: string) => {
    setTaskForProject(projectId)
    setNewTaskTitle('')
    setIsAddTaskOpen(true)
  }

  const addTask = () => {
    if (!taskForProject || !newTaskTitle.trim()) return
    setProjects(prev => prev.map(p => {
      if (p.id === taskForProject) {
        return { ...p, tasks: [...p.tasks, { id: `task-${Date.now()}`, title: newTaskTitle.trim() }] }
      }
      return p
    }))
    setIsAddTaskOpen(false)
    setTaskForProject(null)
    setNewTaskTitle('')
  }

  const addProject = () => {
    if (!newProjectTitle.trim()) return
    setProjects(prev => [...prev, {
      id: `new-${Date.now()}`,
      title: newProjectTitle.trim(),
      description: newProjectDesc.trim(),
      tasks: [],
    }])
    setNewProjectTitle('')
    setNewProjectDesc('')
    setIsAddProjectOpen(false)
  }

  const attachExistingProject = (project: { id: string; title: string; description: string }) => {
    if (projects.some(p => p.id === project.id)) return
    setProjects(prev => [...prev, {
      id: project.id,
      title: project.title,
      description: project.description,
      tasks: [],
    }])
    setIsAttachProjectOpen(false)
  }

  const removeProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  const removeTask = (projectId: string, taskId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        return { ...p, tasks: p.tasks.filter(t => t.id !== taskId) }
      }
      return p
    }))
  }

  const improveProject = async (projectId: string, comment?: string) => {
    setIsProjectLoading(projectId)
    try {
      const project = projects.find(p => p.id === projectId)
      if (!project) return

      const otherProjects = projects.filter(p => p.id !== projectId).map(p => p.title)

      const res = await api.post<ImproveResponse>('/ai/improve/project', {
        goal_title: goalTitle,
        goal_description: goalDescription,
        project_title: project.title + (comment ? `\nUser feedback: "${comment}"` : ''),
        project_description: project.description,
        other_projects: otherProjects,
      })

      const [newTitle, newDesc] = res.suggestion.split('|')
      if (newTitle && newDesc) {
        setProjectSuggestions(prev => ({
          ...prev,
          [projectId]: {
            projectId,
            original: { title: project.title, description: project.description },
            suggestion: { title: newTitle.trim(), description: newDesc.trim() },
            reasoning: res.reasoning,
          },
        }))
      }
    } catch (e) {
      console.error('Failed to improve project:', e)
    }
    setIsProjectLoading(null)
  }

  const saveEverything = async () => {
    if (!goalTitle.trim()) return
    setIsSaving(true)

    try {
      const createdGoal = await api.post<{ id: string; ID: string }>('/goals', {
        title: goalTitle,
        description: goalDescription,
        target_date: goalTargetDate || undefined,
      })

      const goalId = createdGoal.ID || createdGoal.id
      if (!goalId) {
        throw new Error('Failed to create goal: no ID returned')
      }

      for (const project of projects) {
        const isNewProject = project.id.startsWith('new-')

        let projectId: string

        if (isNewProject) {
          const createdProject = await api.post<{ id: string; ID: string }>(`/goals/${goalId}/projects`, {
            title: project.title,
            description: project.description,
          })
          projectId = createdProject.ID || createdProject.id
        } else {
          await api.patch(`/projects/${project.id}/attach`, { goal_id: goalId })
          projectId = project.id
        }

        if (!projectId) {
          throw new Error('Failed to create or attach project: no ID returned')
        }

        for (const task of project.tasks) {
          await api.post(`/projects/${projectId}/tasks`, {
            title: task.title,
          })
        }
      }

      navigate(`/goals/${goalId}`)
    } catch (e) {
      console.error('Failed to save:', e)
    }

    setIsSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: '#0c0c0d' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #2b2b2f', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 600,
              background: step >= 1 ? '#c4913a' : '#141416',
              color: step >= 1 ? '#0c0c0d' : '#6a6660',
              border: step >= 1 ? 'none' : '1px solid #2b2b2f',
            }}>
              1. Goal
            </div>
            <span style={{ color: step > 1 ? '#4ade80' : '#6a6660', fontSize: '12px' }}>→</span>
            <div style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 600,
              background: step === 2 ? '#c4913a' : '#141416',
              color: step === 2 ? '#0c0c0d' : '#6a6660',
              border: step === 2 ? 'none' : '1px solid #2b2b2f',
            }}>
              2. Projects
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          {step === 1 && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8a8680', marginBottom: '8px' }}>Goal Title</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={goalTitle}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    placeholder="e.g., Launch my startup"
                    style={{
                      flex: 1,
                      background: '#141416',
                      border: '1px solid #2b2b2f',
                      borderRadius: '10px',
                      color: '#edeae2',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      padding: '12px 14px',
                    }}
                  />
                  <button
                    onClick={() => goalTitle.trim() && improveTitle()}
                    disabled={!goalTitle.trim() || isTitleLoading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      minWidth: '100px',
                      cursor: goalTitle.trim() && !isTitleLoading ? 'pointer' : 'not-allowed',
                      background: goalTitle.trim() && !isTitleLoading ? '#c4913a' : 'rgba(196,145,58,0.3)',
                      color: '#0c0c0d',
                      border: 'none',
                      transition: 'background 150ms ease, opacity 150ms ease',
                    }}
                  >
                    {isTitleLoading ? (
                      <>
                        <div style={{ width: '14px', height: '14px', border: '2px solid #0c0c0d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        AI...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Improve
                      </>
                    )}
                  </button>
                </div>
                {isTitleLoading && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ background: '#141416', border: '1px solid #2b2b2f', borderRadius: '12px', padding: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '20px', height: '20px', border: '2px solid #c4913a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <span style={{ color: '#8a8680', fontSize: '13px' }}>AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                {titleSuggestion && (
                  <div style={{ marginTop: '12px' }}>
                    <SuggestionCard
                      original={titleSuggestion.original}
                      suggestion={titleSuggestion.suggestion}
                      reasoning={titleSuggestion.reasoning}
                      isLoading={false}
                      onAccept={acceptTitle}
                      onReject={rejectTitle}
                      onRefine={(comment) => improveTitle(comment)}
                    />
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8a8680', marginBottom: '8px' }}>Description</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <textarea
                    value={goalDescription}
                    onChange={(e) => setGoalDescription(e.target.value)}
                    placeholder="Describe what success looks like..."
                    rows={3}
                    style={{
                      flex: 1,
                      background: '#141416',
                      border: '1px solid #2b2b2f',
                      borderRadius: '10px',
                      color: '#edeae2',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      padding: '12px 14px',
                      resize: 'vertical',
                    }}
                  />
                  <button
                    onClick={() => improveDescription()}
                    disabled={isDescLoading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      minWidth: '100px',
                      cursor: isDescLoading ? 'not-allowed' : 'pointer',
                      background: isDescLoading ? 'rgba(196,145,58,0.3)' : '#c4913a',
                      color: '#0c0c0d',
                      border: 'none',
                      alignSelf: 'flex-start',
                    }}
                  >
                    {isDescLoading ? (
                      <>
                        <div style={{ width: '14px', height: '14px', border: '2px solid #0c0c0d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        AI...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Improve
                      </>
                    )}
                  </button>
                </div>
                {isDescLoading && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ background: '#141416', border: '1px solid #2b2b2f', borderRadius: '12px', padding: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '20px', height: '20px', border: '2px solid #c4913a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <span style={{ color: '#8a8680', fontSize: '13px' }}>AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                {descSuggestion && (
                  <div style={{ marginTop: '12px' }}>
                    <SuggestionCard
                      original={descSuggestion.original}
                      suggestion={descSuggestion.suggestion}
                      reasoning={descSuggestion.reasoning}
                      isLoading={false}
                      onAccept={acceptDescription}
                      onReject={rejectDescription}
                      onRefine={(comment) => improveDescription(comment)}
                    />
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '32px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8a8680', marginBottom: '8px' }}>Target Date (optional)</label>
                <input
                  type="date"
                  value={goalTargetDate}
                  onChange={(e) => setGoalTargetDate(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#141416',
                    border: '1px solid #2b2b2f',
                    borderRadius: '10px',
                    color: '#edeae2',
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    padding: '12px 14px',
                  }}
                />
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!goalTitle.trim()}
                style={{
                  width: '100%',
                  background: goalTitle.trim() ? '#c4913a' : 'rgba(196,145,58,0.3)',
                  color: '#0c0c0d',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: goalTitle.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Next: Add Projects →
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 600 }}>{goalTitle}</span>
                  <button
                    onClick={() => setStep(1)}
                    style={{ background: 'none', border: 'none', color: '#6a6660', cursor: 'pointer', fontSize: '12px' }}>
                    Edit Goal
                  </button>
                </div>
                <button
                  onClick={() => setIsAddProjectOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    background: '#141416',
                    color: '#8a8680',
                    border: '1px dashed #2b2b2f',
                    width: '100%',
                  }}
                >
                  <Plus size={16} />
                  Add Project
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {projects.map((project) => (
                  <div key={project.id} style={{ background: '#141416', border: '1px solid #2b2b2f', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>{project.title}</div>
                        {project.description && (
                          <div style={{ fontSize: '12px', color: '#6a6660' }}>{project.description}</div>
                        )}
                      </div>
                      <button
                        onClick={() => removeProject(project.id)}
                        style={{ background: 'none', border: 'none', color: '#6a6660', cursor: 'pointer', padding: '4px' }}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      {project.tasks.map((task) => (
                        <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2b2b2f' }}>
                          <span style={{ fontSize: '13px' }}>{task.title}</span>
                          <button
                            onClick={() => removeTask(project.id, task.id)}
                            style={{ background: 'none', border: 'none', color: '#6a6660', cursor: 'pointer', padding: '4px' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => openAddTaskModal(project.id)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          background: '#1a1a1d',
                          color: '#8a8680',
                          border: '1px solid #2b2b2f',
                        }}
                      >
                        + Add Task
                      </button>
                      <button
                        onClick={() => improveProject(project.id)}
                        disabled={isProjectLoading === project.id || !!projectSuggestions[project.id]}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: isProjectLoading === project.id || !!projectSuggestions[project.id] ? 'not-allowed' : 'pointer',
                          background: isProjectLoading === project.id || !!projectSuggestions[project.id] ? 'rgba(196,145,58,0.4)' : '#c4913a',
                          color: '#0c0c0d',
                          border: 'none',
                          opacity: isProjectLoading === project.id || !!projectSuggestions[project.id] ? 0.6 : 1,
                          transition: 'opacity 150ms ease',
                        }}
                      >
                        <Sparkles size={14} />
                        AI Improve
                      </button>
                    </div>
                    {isProjectLoading === project.id && (
                      <div style={{ marginTop: '12px' }}>
                        <div style={{
                          background: '#141416',
                          border: '1px solid #2b2b2f',
                          borderRadius: '12px',
                          padding: '20px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '20px',
                              height: '20px',
                              border: '2px solid #c4913a',
                              borderTopColor: 'transparent',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite',
                            }} />
                            <span style={{ color: '#8a8680', fontSize: '13px' }}>AI is thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {projectSuggestions[project.id] && (
                      <div style={{ marginTop: '12px' }}>
                        <SuggestionCard
                          original={projectSuggestions[project.id].original.title + '\n---\n' + projectSuggestions[project.id].original.description}
                          suggestion={projectSuggestions[project.id].suggestion.title + '\n---\n' + projectSuggestions[project.id].suggestion.description}
                          reasoning={projectSuggestions[project.id].reasoning}
                          isLoading={false}
                          onAccept={() => acceptProjectSuggestion(project.id)}
                          onReject={() => rejectProjectSuggestion(project.id)}
                          onRefine={(comment) => improveProject(project.id, comment)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {projects.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6a6660' }}>
                  No projects yet. Add at least one project.
                </div>
              )}

              <button
                onClick={saveEverything}
                disabled={projects.length === 0 || isSaving}
                style={{
                  width: '100%',
                  marginTop: '24px',
                  background: projects.length > 0 && !isSaving ? '#c4913a' : 'rgba(196,145,58,0.3)',
                  color: '#0c0c0d',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: projects.length > 0 && !isSaving ? 'pointer' : 'not-allowed',
                }}
              >
                {isSaving ? 'Saving...' : 'Finish & Create Goal'}
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isAddProjectOpen}
        onClose={() => setIsAddProjectOpen(false)}
        title="Add Project"
      >
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8a8680', marginBottom: '8px' }}>Project Name</label>
          <input
            type="text"
            value={newProjectTitle}
            onChange={(e) => setNewProjectTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addProject()}
            placeholder="e.g., Backend API"
            autoFocus
            style={{
              width: '100%',
              background: '#0c0c0d',
              border: '1px solid #2b2b2f',
              borderRadius: '8px',
              color: '#edeae2',
              fontFamily: 'inherit',
              fontSize: '14px',
              padding: '10px 12px',
            }}
          />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8a8680', marginBottom: '8px' }}>Description (optional)</label>
          <textarea
            value={newProjectDesc}
            onChange={(e) => setNewProjectDesc(e.target.value)}
            placeholder="Describe this project..."
            rows={2}
            style={{
              width: '100%',
              background: '#0c0c0d',
              border: '1px solid #2b2b2f',
              borderRadius: '8px',
              color: '#edeae2',
              fontFamily: 'inherit',
              fontSize: '14px',
              padding: '10px 12px',
              resize: 'vertical',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setIsAddProjectOpen(false)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              background: '#1a1a1d',
              color: '#8a8680',
              border: '1px solid #2b2b2f',
            }}
          >
            Cancel
          </button>
          <button
            onClick={addProject}
            disabled={!newProjectTitle.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: newProjectTitle.trim() ? 'pointer' : 'not-allowed',
              background: newProjectTitle.trim() ? '#c4913a' : 'rgba(196,145,58,0.3)',
              color: '#0c0c0d',
              border: 'none',
            }}
          >
            Add Project
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        title="Add Task"
      >
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8a8680', marginBottom: '8px' }}>Task Name</label>
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            placeholder="e.g., Design database schema"
            autoFocus
            style={{
              width: '100%',
              background: '#0c0c0d',
              border: '1px solid #2b2b2f',
              borderRadius: '8px',
              color: '#edeae2',
              fontFamily: 'inherit',
              fontSize: '14px',
              padding: '10px 12px',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setIsAddTaskOpen(false)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              background: '#1a1a1d',
              color: '#8a8680',
              border: '1px solid #2b2b2f',
            }}
          >
            Cancel
          </button>
          <button
            onClick={addTask}
            disabled={!newTaskTitle.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: newTaskTitle.trim() ? 'pointer' : 'not-allowed',
              background: newTaskTitle.trim() ? '#c4913a' : 'rgba(196,145,58,0.3)',
              color: '#0c0c0d',
              border: 'none',
            }}
          >
            Add Task
          </button>
        </div>
      </Modal>
    </div>
  )
}