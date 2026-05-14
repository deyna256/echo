import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api, setAccessToken } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import type { AuthResponse } from '../types'

export function useLogin() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post<AuthResponse>('/auth/login', data),
    onSuccess: (data) => {
      setAccessToken(data.token)
      localStorage.setItem('refresh_token', data.refresh_token)
      setAuth('authenticated')
      navigate('/')
    },
  })
}

export function useRegister() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post<AuthResponse>('/auth/register', data),
    onSuccess: (data) => {
      setAccessToken(data.token)
      localStorage.setItem('refresh_token', data.refresh_token)
      setAuth('authenticated')
      navigate('/')
    },
  })
}