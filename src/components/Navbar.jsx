import { NavLink, Link } from 'react-router-dom'
import { clearSession } from '../api/client.js'

// Top navigation. The links describe QueueSmart's intended screen map; each one
// starts routing once its owner adds the matching <Route> in App.jsx.
const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/join', label: 'Join Queue' },
  { to: '/history', label: 'History' },
  { to: '/admin', label: 'Admin' },
]

function BrandMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <rect width="26" height="26" rx="8" fill="#4b45d1" />
      <circle cx="8" cy="13" r="2.3" fill="#ffffff" opacity="0.5" />
      <circle cx="13" cy="13" r="2.3" fill="#ffffff" opacity="0.8" />
      <circle cx="18.4" cy="13" r="2.7" fill="#f0a92b" />
    </svg>
  )
}

export default function Navbar() {
  let user = null
  try {
    user = JSON.parse(localStorage.getItem('qs_user'))
  } catch {}

  const navLinks = [...links]
  if (user && user.role === 'admin') {
    navLinks.push({ to: '/admin/reports', label: 'Reports' })
  }

  // A full navigation rather than the router's navigate(): this component reads
  // the signed-in user from localStorage while rendering, so reloading is what
  // guarantees the whole app comes back in the signed-out state.
  function handleLogout() {
    clearSession()
    window.location.assign('/login')
  }

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand">
          <BrandMark />
          Queue<span className="brand-smart">Smart</span>
        </Link>

        <nav className="nav-links" aria-label="Primary">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <span className="nav-spacer" />

        <div className="nav-actions">
          {user ? (
            <>
              <span className="nav-user">{user.email}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
