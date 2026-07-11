import { Link } from 'react-router-dom'
import { services } from '../data/mockData.js'

// Landing page — the app's front door and a map of where each area lives.
// The chip links point at teammate screens; they route once those are built.
const areas = [
  {
    title: 'For students',
    body: "Join a line from your phone, watch your position update live, and get a heads-up when you're almost up.",
    links: [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/join', label: 'Join Queue' },
      { to: '/queue-status', label: 'Queue Status' },
      { to: '/history', label: 'History' },
    ],
  },
  {
    title: 'For staff',
    body: 'Open and close services, set durations and priority, and move the line along — serve the next person in one tap.',
    links: [
      { to: '/admin', label: 'Admin Dashboard' },
      { to: '/admin/services', label: 'Service Management' },
      { to: '/admin/queues', label: 'Queue Management' },
    ],
  },
]

export default function Home() {
  const openCount = services.filter((s) => s.isOpen).length

  return (
    <>
      <section className="hero">
        <span className="eyebrow">Smart queue management</span>
        <h1 className="hero-title">Stop standing in line. Start knowing your place in it.</h1>
        <p className="hero-sub">
          QueueSmart lets you join campus service queues remotely, track your position in
          real time, and get notified the moment you're almost up — so waiting never eats
          your day.
        </p>
        <div className="hero-cta">
          <Link to="/register" className="btn btn-primary">Create an account</Link>
          <Link to="/login" className="btn btn-ghost">Log in</Link>
        </div>

        <div className="hero-track">
          <div
            className="qtrack"
            role="img"
            aria-label="Queue position: two people served, you are almost up, two waiting behind"
          >
            <span className="qdot done" /><span className="qbar done" />
            <span className="qdot done" /><span className="qbar" />
            <span className="qdot active" /><span className="qbar" />
            <span className="qdot" /><span className="qbar" />
            <span className="qdot" />
          </div>
          <div className="hero-track-caption">
            <span><strong>You're almost up.</strong> Position 3 of 5</span>
            <span>Est. wait ~6 min</span>
          </div>
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>One app, two sides of the counter</h2>
          <p className="muted">{openCount} of {services.length} campus services are open right now.</p>
        </div>
        <div className="grid">
          {areas.map((a) => (
            <article key={a.title} className="card feature">
              <h3>{a.title}</h3>
              <p>{a.body}</p>
              <div className="feature-links">
                {a.links.map((l) => (
                  <Link key={l.to} to={l.to} className="chip-link">{l.label}</Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
