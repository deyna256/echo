import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import type { Project, CreateProjectRequest } from '../../../types'

export function useProjects(goalId: string | undefined) {
  return useQuery({
    queryKey: ['projects', goalId],
    queryFn: () => api.get<Project[]>(`/goals/${goalId}/projects`),
    enabled: !!goalId,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ goalId, ...data }: CreateProjectRequest & { goalId: string }) =>
      api.post<Project>(`/goals/${goalId}/projects`, data),
    onSuccess: (_, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: ['projects', goalId] })
    },
  })
}

export function useCreateStandaloneProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateProjectRequest) =>
      api.post<Project>('/projects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_projects'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ goalId, projectId, ...data }: CreateProjectRequest & { goalId: string; projectId: string }) =>
      api.patch<Project>(`/goals/${goalId}/projects/${projectId}`, data),
    onSuccess: (_, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: ['projects', goalId] })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ goalId, projectId }: { goalId: string; projectId: string }) =>
      api.delete(`/goals/${goalId}/projects/${projectId}`),
    onSuccess: (_, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: ['projects', goalId] })
    },
  })
}
