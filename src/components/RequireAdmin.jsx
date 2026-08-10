import { Navigate } from 'react-router-dom'

// Route guard for the /admin screens.
//
// This is a usability guard, not the security boundary — the backend is what
// actually enforces the admin role (see server/middleware/auth.js). Without
// it a signed-in student could open /admin/queues and get a screen full of
// "Administrator access required" errors instead of being sent somewhere useful.
export default function RequireAdmin({ children }) {
  let user = null
  try {
    user = JSON.parse(localStorage.getItem('qs_user'))
  } catch {
    user = null
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
