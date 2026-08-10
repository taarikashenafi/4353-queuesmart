const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

// Login stores the bearer token issued by the backend. Every request carries
// it so the server can verify who is calling and whether they are an admin.
function authHeaders() {
  let token
  try {
    token = localStorage.getItem('qs_token')
  } catch {
    return {}
  }

  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Session tokens live in server memory, so a backend restart invalidates the
// token still sitting in localStorage. Clearing it and bouncing to the login
// page turns that into a recoverable state instead of endless 401s.
function handleExpiredSession() {
  try {
    localStorage.removeItem('qs_user')
    localStorage.removeItem('qs_token')
  } catch {
    // Storage unavailable — the redirect below is still the right move.
  }

  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
}

async function request(path, options = {}) {
  let response

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...options.headers,
      },
    })
  } catch {
    throw new Error('Cannot reach the server. Is the backend running?')
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) {
      handleExpiredSession()
      throw new Error(data?.error || 'Your session expired. Please sign in again.')
    }
    throw new Error(data?.error || `Request failed with status ${response.status}.`)
  }

  return data
}

export function apiGet(path) {
  return request(path)
}

export function apiPost(path, body) {
  return request(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function apiPut(path, body) {
  return request(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function apiPatch(path, body) {
  return request(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function apiDelete(path, body) {
  return request(path, {
    method: 'DELETE',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}
