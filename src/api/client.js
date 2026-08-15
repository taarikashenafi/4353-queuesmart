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
// The token is the session, so dropping it is the whole of signing out.
// Exported because the navbar's Log out button and the expired-session handler
// below have to leave the client in exactly the same state.
export function clearSession() {
  try {
    localStorage.removeItem('qs_user')
    localStorage.removeItem('qs_token')
  } catch {
    // Storage unavailable — callers still redirect, which is the important part.
  }
}

function handleExpiredSession() {
  clearSession()

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

// Pulls the filename the backend chose out of the Content-Disposition header
// it sets on report downloads, so the saved file is named the same way whether
// the caller passed a name or not.
function filenameFromResponse(response) {
  const disposition = response.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/i)
  return match ? match[1] : null
}

// Downloads a file from an authenticated endpoint.
//
// A plain <a href> cannot work here: our session token lives in localStorage,
// not a cookie, so the browser would send the request with no Authorization
// header and an admin-only report route would answer 401. Instead we fetch it
// with the header, then hand the response body to a temporary anchor.
export async function apiDownload(path, filename) {
  let response

  try {
    response = await fetch(`${API_BASE}${path}`, { headers: authHeaders() })
  } catch {
    throw new Error('Cannot reach the server. Is the backend running?')
  }

  // A failed download still answers with the API's JSON error shape, even
  // though the success path is a file.
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    if (response.status === 401) {
      handleExpiredSession()
      throw new Error(data?.error || 'Your session expired. Please sign in again.')
    }
    throw new Error(data?.error || `Download failed with status ${response.status}.`)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename || filenameFromResponse(response) || 'download'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  // Released on the next tick — revoking synchronously after click() can race
  // the browser starting the download in some versions of Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function apiDelete(path, body) {
  return request(path, {
    method: 'DELETE',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}
