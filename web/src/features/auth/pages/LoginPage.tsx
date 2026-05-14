import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogin } from '../../../hooks/useAuth'

export function LoginPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [showError, setShowError] = useState(false)

  const login = useLogin()

  useEffect(() => {
    if (error) {
      setShowError(true)
      const timer = setTimeout(() => setShowError(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setShowError(false)

    try {
      await login.mutateAsync({ email, password })
    } catch (err: any) {
      setError(err.message || 'Invalid email or password')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg" style={{ padding: '20px' }}>
      <div className="w-full" style={{ maxWidth: '400px' }}>
        <div className="text-center" style={{ marginBottom: '32px' }}>
          <h1 className="text-[32px] font-bold text-gold tracking-tight" style={{ letterSpacing: '-0.5px' }}>Echo</h1>
          <p className="text-[13px] text-text-muted" style={{ marginTop: '8px' }}>AI-powered planning for ambitious goals</p>
        </div>

        <div className="bg-surface border border-border" style={{ borderRadius: '16px', padding: '32px' }}>
          <div className="text-center" style={{ marginBottom: '28px' }}>
            <h2 className="text-[20px] font-bold" style={{ marginBottom: '8px' }}>Welcome back</h2>
            <p className="text-[13px] text-text-muted">Sign in to continue your planning</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div style={{ marginBottom: '16px' }}>
              <label className="block text-[12px] font-semibold text-text-secondary" style={{ marginBottom: '8px' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-bg border border-border rounded-lg text-[14px] text-text-primary placeholder:text-text-muted transition-colors cursor-pointer"
                style={{ padding: '12px 14px', outline: 'none', borderColor: '#2b2b2f', borderWidth: '1px' }}
                onFocus={(e) => e.target.style.borderColor = '#c4913a'}
                onBlur={(e) => e.target.style.borderColor = '#2b2b2f'}
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="block text-[12px] font-semibold text-text-secondary" style={{ marginBottom: '8px' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-bg border border-border rounded-lg text-[14px] text-text-primary placeholder:text-text-muted transition-colors cursor-pointer"
                style={{ padding: '12px 14px', outline: 'none', borderColor: '#2b2b2f', borderWidth: '1px' }}
                onFocus={(e) => e.target.style.borderColor = '#c4913a'}
                onBlur={(e) => e.target.style.borderColor = '#2b2b2f'}
                required
              />
            </div>

            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 accent-gold"
                />
                <span className="text-[12px] text-text-secondary">Remember me</span>
              </label>
              <button type="button" className="text-[12px] text-gold cursor-pointer hover:underline">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={login.isPending}
              className="w-full bg-gold text-bg font-semibold text-[14px] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer"
              style={{ padding: '14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {login.isPending ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <div className="text-center text-[13px] text-text-muted" style={{ marginTop: '24px' }}>
          Don't have an account?{' '}
          <button onClick={() => navigate('/register')} className="text-gold font-medium cursor-pointer hover:underline">
            Sign up
          </button>
        </div>

        {/* Error Toast */}
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'rgba(20, 20, 22, 0.98)',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            borderRadius: '12px',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            transform: showError ? 'translateY(0)' : 'translateY(100px)',
            opacity: showError ? 1 : 0,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 100,
            maxWidth: '320px',
          }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f87171', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: '#edeae2', fontWeight: 500 }}>
            {error}
          </span>
          <button
            onClick={() => setShowError(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#6a6660',
              cursor: 'pointer',
              padding: '4px',
              marginLeft: '4px',
              fontSize: '16px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}