import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { api } from '../../../lib/api'

export function SettingsPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<{ id: string; email: string; created_at: string } | null>(null)

  useEffect(() => {
    api.getMe().then(setUser).catch(console.error)
  }, [])

  const initials = user?.email
    ? user.email.split('@')[0].slice(0, 2).toUpperCase()
    : '??'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #2b2b2f', display: 'flex', alignItems: 'center', gap: '16px', background: '#141416' }}>
        <button
          onClick={() => navigate('/goals')}
          style={{ background: 'none', border: 'none', color: '#6a6660', cursor: 'pointer', fontSize: '18px', padding: '4px 8px', borderRadius: '6px' }}
        >
          ←
        </button>
        <span style={{ fontSize: '18px', fontWeight: 600 }}>Settings</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }}>
          <div style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#6a6660', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Profile</div>
            <div style={{ background: '#141416', border: '1px solid #2b2b2f', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(196,145,58,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 700,
                color: '#c4913a',
              }}>
                {initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
                  {user?.email || 'Loading...'}
                </div>
                <div style={{ fontSize: '13px', color: '#6a6660' }}>
                  {user ? `Joined ${new Date(user.created_at).toLocaleDateString()}` : 'Loading...'}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#6a6660', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Account</div>
            <div style={{ background: '#141416', border: '1px solid #2b2b2f', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(196,145,58,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c4913a' }}>
                    <LogOut size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '2px' }}>Sign Out</div>
                    <div style={{ fontSize: '12px', color: '#6a6660' }}>Log out of your account</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem('auth')
                    localStorage.removeItem('refresh_token')
                    window.location.href = '/login'
                  }}
                  style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid #f87171', color: '#f87171', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: '#6a6660', textAlign: 'center', padding: '20px' }}>
            Echo v1.0.0
          </div>
        </div>
      </div>
    </div>
  )
}