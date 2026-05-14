import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import { useGoals } from '../hooks/useGoals'
import { useCreateStandaloneProject } from '../hooks/useProjects'
import type { Goal, Project, Task } from '../../../types'
import { Target, FolderOpen, Calendar, Plus } from 'lucide-react'
import { Modal } from '../../../components/Modal'

export function GoalsListPage() {
  const navigate = useNavigate()
  const { data: goals, isLoading } = useGoals()
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false)
  const createStandaloneProject = useCreateStandaloneProject()

  const handleGoalClick = (goalId: string) => {
    navigate(`/goals/${goalId}`)
  }

  const handleNewGoal = () => {
    navigate('/goals/new')
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#edeae2', margin: 0 }}>Goals</h1>
          <p style={{ fontSize: '13px', color: '#6a6660', margin: '4px 0 0' }}>Plan and track your objectives</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsCreateProjectOpen(true)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              background: '#1a1a1d',
              color: '#8a8680',
              border: '1px solid #2b2b2f',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Plus size={14} /> New Project
          </button>
          <button
            onClick={handleNewGoal}
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
            <Plus size={14} /> New Goal
          </button>
        </div>
      </div>
      <div className="goals-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {isLoading ? (
          <>
            <GoalCardSkeleton />
            <GoalCardSkeleton />
            <GoalCardSkeleton />
          </>
        ) : goals?.length === 0 ? (
          <EmptyState onCreateGoal={handleNewGoal} />
        ) : (
          goals?.map((goal, index) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              index={index + 1}
              onClick={() => handleGoalClick(goal.id)}
            />
          ))
        )}
      </div>

      <Modal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        title="Create Project"
        size="sm"
      >
        <CreateProjectModal
          onSubmit={(data) => {
            createStandaloneProject.mutate(data, {
              onSuccess: () => setIsCreateProjectOpen(false),
            })
          }}
          onCancel={() => setIsCreateProjectOpen(false)}
          isLoading={createStandaloneProject.isPending}
        />
      </Modal>
    </div>
  )
}

function CreateProjectModal({
  onSubmit,
  onCancel,
  isLoading,
}: {
  onSubmit: (data: { title: string; description?: string; target_date?: string }) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      target_date: targetDate || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8a8680', marginBottom: '6px' }}>
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter project title"
          autoFocus
          style={{
            width: '100%',
            padding: '10px 12px',
            background: '#1a1a1d',
            border: '1px solid #2b2b2f',
            borderRadius: '8px',
            color: '#edeae2',
            fontSize: '13px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8a8680', marginBottom: '6px' }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter project description (optional)"
          rows={3}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: '#1a1a1d',
            border: '1px solid #2b2b2f',
            borderRadius: '8px',
            color: '#edeae2',
            fontSize: '13px',
            outline: 'none',
            boxSizing: 'border-box',
            resize: 'vertical',
          }}
        />
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8a8680', marginBottom: '6px' }}>
          Target Date
        </label>
        <input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: '#1a1a1d',
            border: '1px solid #2b2b2f',
            borderRadius: '8px',
            color: '#edeae2',
            fontSize: '13px',
            outline: 'none',
            boxSizing: 'border-box',
            colorScheme: 'dark',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            background: '#1a1a1d',
            color: '#8a8680',
            border: '1px solid #2b2b2f',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim() || isLoading}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: title.trim() && !isLoading ? 'pointer' : 'not-allowed',
            background: title.trim() && !isLoading ? '#c4913a' : 'rgba(196,145,58,0.3)',
            color: '#0c0c0d',
            border: 'none',
          }}
        >
          {isLoading ? 'Creating…' : 'Create Project'}
        </button>
      </div>
    </form>
  )
}

function GoalCardSkeleton() {
  return (
    <div style={{ background: '#141416', border: '1px solid #2b2b2f', borderRadius: '12px', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#1a1a1d', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: '20px', background: '#1a1a1d', borderRadius: '4px', width: '75%', marginBottom: '8px', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: '16px', background: '#1a1a1d', borderRadius: '4px', width: '100%', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
      <div style={{ height: '4px', background: '#1a1a1d', borderRadius: '2px', marginTop: '16px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

function GoalCard({
  goal,
  index,
  onClick,
}: {
  goal: Goal
  index: number
  onClick: () => void
}) {
  const { data: projects } = useQuery({
    queryKey: ['projects', goal.id],
    queryFn: () => api.get<Project[]>(`/goals/${goal.id}/projects`),
  })

  const { data: tasks } = useQuery({
    queryKey: ['goal-tasks', goal.id],
    queryFn: () => api.get<Task[]>(`/goals/${goal.id}/tasks`),
  })

  const projectCount = projects?.length || 0
  const totalTasks = tasks?.length || 0
  const doneTasks = tasks?.filter(t => t.status === 'done').length || 0
  const completionPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const getDueText = () => {
    if (!goal.target_date) return 'No deadline'
    const days = Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (days < 0) return `${Math.abs(days)} days overdue`
    if (days === 0) return 'Due today'
    if (days === 1) return 'Due tomorrow'
    if (days < 7) return `Due in ${days} days`
    if (days < 30) return `Due in ${Math.ceil(days / 7)} weeks`
    return `Due in ${Math.ceil(days / 30)} months`
  }

  return (
    <div
      onClick={onClick}
      style={{ background: '#141416', border: '1px solid #2b2b2f', borderRadius: '12px', padding: '20px', cursor: 'pointer' }}
      className="goal-card"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
        <div style={{ width: '32px', height: '32px', background: 'rgba(196,145,58,0.15)', color: '#c4913a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
          {index}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#edeae2', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {goal.title}
          </div>
          <div style={{ fontSize: '12px', color: '#6a6660', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {goal.description || 'No description'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px' }}>
          <span style={{ color: '#6a6660' }}>Progress</span>
          <span style={{ color: '#8a8680', fontWeight: 600 }}>{doneTasks}/{totalTasks} tasks</span>
        </div>
        <div style={{ height: '4px', background: '#1a1a1d', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${completionPercent}%`, background: completionPercent === 100 ? '#4ade80' : '#c4913a', borderRadius: '2px', transition: 'width 0.3s ease' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '12px', fontSize: '11px', color: '#6a6660' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FolderOpen size={12} /> {projectCount} {projectCount === 1 ? 'project' : 'projects'}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} /> {getDueText()}</span>
      </div>
    </div>
  )
}

function EmptyState({ onCreateGoal }: { onCreateGoal: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', gridColumn: '1 / -1' }}>
      <div style={{ marginBottom: '16px', opacity: 0.5, color: '#6a6660' }}><Target size={48} strokeWidth={1} /></div>
      <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No goals yet</div>
      <div style={{ fontSize: '13px', color: '#6a6660', marginBottom: '20px' }}>
        Create your first goal to start planning your future.
      </div>
      <button
        onClick={onCreateGoal}
        style={{ background: '#c4913a', color: '#0c0c0d', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto' }}
      >
        <Plus size={16} />
        New Goal
      </button>
    </div>
  )
}