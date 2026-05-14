import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setAccessToken, initAuth } from '../lib/api'

interface AuthState {
  userId: string | null
  isLoading: boolean
  setAuth: (userId: string) => void
  clearAuth: () => void
  initializeAuth: () => Promise<boolean>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      isLoading: true,

      setAuth: (userId) => set({ userId }),

      clearAuth: () => {
        set({ userId: null })
        setAccessToken(null)
      },

      initializeAuth: async () => {
        set({ isLoading: true })
        try {
          const success = await initAuth()
          set({ isLoading: false })
          return success
        } catch (e) {
          set({ isLoading: false })
          return false
        }
      },
    }),
    {
      name: 'auth',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.initializeAuth()
        }
      },
    }
  )
)