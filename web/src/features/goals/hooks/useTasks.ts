import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import type { Task, CreateTaskRequest } from '../../../types'

export function useTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.get<Task[]>(`/projects/${projectId}/tasks`),
    enabled: !!projectId,
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, ...data }: CreateTaskRequest & { projectId: string }) =>
      api.post<Task>(`/projects/${projectId}/tasks`, data),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, taskId, ...data }: CreateTaskRequest & { projectId: string; taskId: string }) =>
      api.patch<Task>(`/projects/${projectId}/tasks/${taskId}`, data),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, taskId }: { projectId: string; taskId: string }) =>
      api.delete(`/projects/${projectId}/tasks/${taskId}`),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
  })
}

export function useToggleTaskStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, task }: { projectId: string; task: Task }) => {
      const newStatus = task.status === 'done' ? 'todo' : 'done'
      return api.patch<Task>(`/projects/${projectId}/tasks/${task.id}`, { status: newStatus })
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
  })
}
