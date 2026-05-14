import { Routes, Route, Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { AuthLayout } from './features/auth/pages/AuthLayout'
import { LoginPage } from './features/auth/pages/LoginPage'
import { RegisterPage } from './features/auth/pages/RegisterPage'
import { GoalsListPage } from './features/goals/pages/GoalsListPage'
import { ProjectsListPage } from './features/goals/pages/ProjectsListPage'
import { GoalDetailPage } from './features/goals/pages/GoalDetailPage'
import { WizardPage } from './features/wizard/pages/WizardPage'
import { CalendarPage } from './features/calendar/pages/CalendarPage'
import { SettingsPage } from './features/goals/pages/SettingsPage'
import { Target, Calendar, Folder, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { getAccessToken, setAccessToken } from './lib/api'
import { CalendarProvider, useCalendar } from './contexts/CalendarContext'
import { OverdueDropdown } from './features/calendar/components/OverdueDropdown'
import { UnassignedDropdown } from './features/calendar/components/UnassignedDropdown'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = getAccessToken()
  const refreshToken = localStorage.getItem('refresh_token')
  if (!token && !refreshToken) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function formatPeriod(date: Date, view: string): string {
  if (view === 'month') {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(date)
  mon.setDate(diff)
  const sun = new Date(date)
  sun.setDate(diff + 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(mon)} – ${fmt(sun)}, ${sun.getFullYear()}`
}

function TopBarInner() {
  const navigate = useNavigate()
  const location = useLocation()
  const { view, setView, currentDate, setCurrentDate, tasks } = useCalendar()

  const { overdueTasks, unassignedTasks } = useMemo(() => {
    const now = new Date()
    return {
      overdueTasks: tasks.filter(t =>
        t.status === 'todo' && t.scheduled_date && new Date(t.scheduled_date) < now
      ),
      unassignedTasks: tasks.filter(t => !t.scheduled_date),
    }
  }, [tasks])

  const [overdueOpen, setOverdueOpen] = useState(false)
  const [unassignedOpen, setUnassignedOpen] = useState(false)

  const isCalendar = location.pathname.startsWith('/calendar')

  const navItems = [
    { label: 'Goals', to: '/goals', icon: Target },
    { label: 'Calendar', to: '/calendar', icon: Calendar },
    { label: 'Projects', to: '/projects', icon: Folder },
  ]

  function navigateCalendar(dir: -1 | 1) {
    if (view === 'week') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + dir * 7))
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1))
    }
  }

  return (
    <header style={{ height: 52, background: '#141416', borderBottom: '1px solid #2b2b2f', display: 'flex', alignItems: 'center', padding: '0 16px', flexShrink: 0, gap: 16 }}>
      <button onClick={() => navigate('/calendar')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: 0 }}>
        <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #c4913a, #d4a44e)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#0c0c0d', fontSize: 11, fontWeight: 'bold' }}>E</span>
        </div>
        <span style={{ fontSize: 16, fontWeight: 'bold', color: '#c4913a' }}>Echo</span>
      </button>

      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 50, padding: 4, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to)
          return (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                background: isActive ? 'linear-gradient(135deg, #c4913a, #d4a44e)' : 'transparent',
                border: 'none',
                borderRadius: 50,
                fontSize: 12,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#0c0c0d' : '#6a6660',
                cursor: 'pointer',
                transition: 'all 0.3s',
              }}
            >
              <item.icon size={14} strokeWidth={isActive ? 2.5 : 2} />
              {item.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        {isCalendar && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                onClick={() => navigateCalendar(-1)}
                style={{ width: 28, height: 28, background: '#1a1a2e', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <ChevronLeft size={14} style={{ color: '#9a9299' }} />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                style={{ padding: '6px 12px', fontSize: 11, color: '#9a9299', background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                Today
              </button>
              <button
                onClick={() => navigateCalendar(1)}
                style={{ width: 28, height: 28, background: '#1a1a2e', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <ChevronRight size={14} style={{ color: '#9a9299' }} />
              </button>
            </div>
            <span style={{ fontSize: 12, color: '#9a9299' }}>{formatPeriod(currentDate, view)}</span>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 50, padding: 4 }}>
              {(['week', 'month', 'agenda'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: '8px 14px',
                    background: view === v ? 'white' : 'transparent',
                    border: 'none',
                    borderRadius: 50,
                    fontSize: 11,
                    fontWeight: view === v ? 700 : 600,
                    textTransform: 'capitalize' as const,
                    color: view === v ? '#0c0c0d' : '#6a6660',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>

            {overdueTasks.length > 0 && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => { setOverdueOpen(o => !o); setUnassignedOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 20, border: '1px solid rgba(224,80,64,0.25)',
                    background: 'rgba(224,80,64,0.12)', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    color: '#e06050',
                  }}
                >
                  ⚠ Overdue
                  <span style={{
                    background: '#e06050', color: '#fff', borderRadius: '50%',
                    width: 16, height: 16, fontSize: 9, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {overdueTasks.length}
                  </span>
                </button>
                {overdueOpen && (
                  <OverdueDropdown
                    tasks={overdueTasks}
                    onClose={() => setOverdueOpen(false)}
                  />
                )}
              </div>
            )}

            {unassignedTasks.length > 0 && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => { setUnassignedOpen(o => !o); setOverdueOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 20, border: '1px solid rgba(80,80,100,0.3)',
                    background: 'rgba(80,80,100,0.18)', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    color: '#8080a0',
                  }}
                >
                  ◈ Unassigned
                  <span style={{
                    background: '#50507a', color: '#c0c0d8', borderRadius: '50%',
                    width: 16, height: 16, fontSize: 9, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {unassignedTasks.length}
                  </span>
                </button>
                {unassignedOpen && (
                  <UnassignedDropdown
                    tasks={unassignedTasks}
                    onClose={() => setUnassignedOpen(false)}
                  />
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ width: 1, height: 18, background: '#2b2b2f', margin: '0 4px' }} />
        <button
          onClick={() => navigate('/settings')}
          style={{ width: 28, height: 28, background: 'transparent', border: 'none', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <Settings size={14} style={{ color: '#6a6660' }} />
        </button>
        <button
          onClick={() => { setAccessToken(null); localStorage.removeItem('auth'); localStorage.removeItem('refresh_token'); window.location.href = '/login' }}
          style={{ width: 28, height: 28, background: 'transparent', border: 'none', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <LogOut size={14} style={{ color: '#6a6660' }} />
        </button>
      </div>
    </header>
  )
}

function DashboardLayout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopBarInner />
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <CalendarProvider>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/calendar" replace />} />
          <Route path="goals" element={<GoalsListPage />} />
          <Route path="projects" element={<ProjectsListPage />} />
          <Route path="goals/new" element={<WizardPage />} />
          <Route path="goals/:id" element={<GoalDetailPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/goals" replace />} />
      </Routes>
    </CalendarProvider>
  )
}