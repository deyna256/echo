import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import type { Goal, CreateGoalRequest } from '../../../types'

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: () => api.get<Goal[]>('/goals'),
  })
}

export function useGoal(id: string | undefined) {
  return useQuery({
    queryKey: ['goals', id],
    queryFn: () => api.get<Goal>(`/goals/${id}`),
    enabled: !!id,
  })
}

export function useCreateGoal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateGoalRequest) =>
      api.post<Goal>('/goals', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}

export function useUpdateGoal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...data }: CreateGoalRequest & { id: string }) =>
      api.patch<Goal>(`/goals/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      queryClient.invalidateQueries({ queryKey: ['goals', id] })
    },
  })
}

export function useDeleteGoal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/goals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}
