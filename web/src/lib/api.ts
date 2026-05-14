export const API_BASE = '/api'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

let accessToken: string | null = null

function log(level: string, msg: string, data?: Record<string, unknown>) {
  const entry = {
    level,
    service: 'echo',
    msg,
    ...data,
  }
  console.log(JSON.stringify(entry))
}

export function setAccessToken(token: string | null) {
  accessToken = token
  log('DEBUG', 'access token changed', { has_token: !!token })
}

export function getAccessToken(): string | null {
  return accessToken
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) {
    log('DEBUG', 'no refresh token in storage')
    return false
  }

  try {
    log('DEBUG', 'refreshing access token')
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!response.ok) {
      log('WARN', 'refresh rejected', { status: response.status })
      localStorage.removeItem('refresh_token')
      setAccessToken(null)
      return false
    }

    const data = await response.json()
    setAccessToken(data.token)
    localStorage.setItem('refresh_token', data.refresh_token)
    log('DEBUG', 'tokens refreshed')
    return true
  } catch (e) {
    log('ERROR', 'refresh failed', { error: String(e) })
    return false
  }
}

export async function initAuth(): Promise<boolean> {
  const stored = localStorage.getItem('refresh_token')
  if (stored) {
    log('DEBUG', 'found refresh token, attempting to restore session')
    try {
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        log('DEBUG', 'session restored successfully')
        return true
      }
    } catch (e) {
      log('ERROR', 'failed to restore session', { error: String(e) })
    }
  }
  setAccessToken(null)
  return false
}

async function doFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: HeadersInit = {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...options.headers,
  }

  if (!(options.headers instanceof Headers)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  log('DEBUG', 'api request', { method: options.method ?? 'GET', path })
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  return response
}

async function fetchJson<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let response = await doFetch(path, options)

  if (response.status === 401 && !path.includes('/auth/')) {
    log('INFO', 'token expired, attempting refresh')
    const refreshed = await refreshAccessToken()
    if (!refreshed) {
      log('ERROR', 'refresh failed')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('auth')
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }
    log('DEBUG', 'token refreshed, retrying request')
    response = await doFetch(path, options)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new ApiError(response.status, body || response.statusText)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

export const api = {
  get<T>(path: string): Promise<T> {
    return fetchJson<T>(path)
  },

  post<T>(path: string, body: unknown): Promise<T> {
    return fetchJson<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  patch<T>(path: string, body: unknown): Promise<T> {
    return fetchJson<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  },

  delete<T>(path: string): Promise<T> {
    return fetchJson<T>(path, {
      method: 'DELETE',
    })
  },

  getMe(): Promise<{ id: string; email: string; created_at: string }> {
    return fetchJson<{ id: string; email: string; created_at: string }>('/auth/me')
  },
}