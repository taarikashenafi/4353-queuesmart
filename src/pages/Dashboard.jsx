// User Dashboard page.
// Owner: Uchenna Okoronkwo — wires notifications + active queue summary to the backend.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../api/client.js'

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('qs_user'))
  } catch {
    return null
  }
}

export default function Dashboard() {
  const user = getCurrentUser()
  const [services, setServices] = useState([])
  const [notifications, setNotifications] = useState([])
  const [activeQueue, setActiveQueue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const [serviceList, userNotifications] = await Promise.all([
          apiGet('/services'),
          apiGet(`/notifications/${user.id}`),
        ])

        if (cancelled) return
        setServices(serviceList)
        setNotifications(userNotifications)

        // The queue module (GET /api/queues/:serviceId?userId=) is still a stub
        // on the backend, so each lookup is expected to fail until it ships.
        // Promise.allSettled means a missing/failed endpoint just reads as
        // "not queued" instead of breaking the whole dashboard.
        const queueChecks = await Promise.allSettled(
          serviceList.map((service) =>
            apiGet(`/queues/${service.id}?userId=${user.id}`).then((data) => ({ service, data }))
          )
        )

        if (cancelled) return

        const found = queueChecks
          .filter((result) => result.status === 'fulfilled')
          .map((result) => result.value)
          .find(({ data }) => typeof data?.position === 'number')

        setActiveQueue(found || null)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  if (!user) {
    return (
      <section className="stack">
        <p className="muted">Please log in to view your dashboard.</p>
        <Link to="/login" className="btn btn-primary">Log in</Link>
      </section>
    )
  }

  return (
    <section className="stack">
      <div className="section-head">
        <span className="eyebrow">User dashboard</span>
        <h1>Welcome back, {user.email}</h1>
        <p className="muted">
          Review your active queue, discover open services, and catch up on the latest notifications.
        </p>
        <Link to="/profile" className="btn btn-ghost">Edit profile</Link>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      <div className="grid">
        <article className="card">
          <h2>Quick summary</h2>
          <div className="stack">
            <div className="row">
              <strong>{services.length}</strong>
              <span className="muted">services available</span>
            </div>
            <div className="row">
              <strong>{activeQueue ? 1 : 0}</strong>
              <span className="muted">active queue entries</span>
            </div>
            <div className="row">
              <strong>{notifications.length}</strong>
              <span className="muted">new notifications</span>
            </div>
          </div>
        </article>

        <article className="card">
          <h2>My current queue</h2>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : activeQueue ? (
            <div className="stack">
              <div className="row">
                <div>
                  <p className="label">Service</p>
                  <strong>{activeQueue.service.name}</strong>
                </div>
                <div>
                  <p className="label">Position</p>
                  <strong>{activeQueue.data.position}</strong>
                </div>
              </div>
              <div className="row">
                <div>
                  <p className="label">Estimated wait</p>
                  <strong>{activeQueue.data.estimatedWait ?? 0} minutes</strong>
                </div>
              </div>
              <Link to="/queue-status" className="btn btn-ghost">View queue status</Link>
            </div>
          ) : (
            <div className="stack">
              <p className="muted">You don't have an active queue entry yet.</p>
              <Link to="/join" className="btn btn-primary">Join a queue</Link>
            </div>
          )}
        </article>
      </div>

      <div className="grid">
        <article className="card">
          <h2>Services</h2>
          <div className="stack">
            {services.map((service) => (
              <div key={service.id} className="card" style={{ padding: '16px' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <strong>{service.name}</strong>
                    <p className="muted" style={{ marginTop: '4px' }}>{service.description}</p>
                  </div>
                  <span className={`badge badge-${service.priority === 'high' ? 'high' : service.priority === 'medium' ? 'med' : 'low'}`}>
                    {service.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <h2>Notifications</h2>
          {notifications.length > 0 ? (
            <div className="stack">
              {notifications.slice(0, 4).map((notification) => (
                <div key={notification.id} className="card" style={{ padding: '14px', borderColor: 'transparent' }}>
                  <p>{notification.message}</p>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    {new Date(notification.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No new notifications.</p>
          )}
        </article>
      </div>
    </section>
  )
}
