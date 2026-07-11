import { Link, useLocation } from 'react-router-dom'

// Catch-all 404. Also what you'll see when you open a teammate's screen before
// its route exists — that's expected during A2 while screens are being built.
export default function NotFound() {
  const { pathname } = useLocation()
  return (
    <section className="notfound">
      <span className="notfound-code">404</span>
      <h2>Nothing here yet</h2>
      <p className="muted" style={{ maxWidth: '46ch' }}>
        <code>{pathname}</code> doesn't have a route yet. If it's a QueueSmart screen,
        it's still on the way.
      </p>
      <Link to="/" className="btn btn-primary">Back to home</Link>
    </section>
  )
}
