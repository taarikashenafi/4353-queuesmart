// Auth API calls. Pages import these instead of talking to fetch directly,
// so the backend URL and error handling live in one place.

const API_BASE = 'http://localhost:3000/api'

async function post(path, body) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Cannot reach the server. Is the backend running?')
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Something went wrong.')

  return data
}

export function registerUser({ email, password, role = 'user' }) {
  return post('/auth/register', { email, password, role })
}

export function loginUser({ email, password }) {
  return post('/auth/login', { email, password })
}
