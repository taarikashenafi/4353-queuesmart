import { useEffect, useState } from 'react'
import { apiGet } from '../api/client.js'

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('qs_user'))
  } catch {
    return null
  }
}

export default function QueueStatus() {
  const user = getCurrentUser()
  const [activeQueue, setActiveQueue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      try {
        const services = await apiGet('/services')
        const checks = await Promise.allSettled(services.map(async (service) => {
          const queue = await apiGet(`/queues/${service.id}?userId=${user.id}`)
          return { service, queue }
        }))

        if (cancelled) return

        const found = checks
          .filter((result) => result.status === 'fulfilled')
          .map((result) => result.value)
          .find(({ queue }) => typeof queue.position === 'number')

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

  return (
    <section className="stack">
      <div className="section-head">
        <span className="eyebrow">Queue status</span>
        <h1>Track your place in line</h1>
        <p className="muted">
          Check your current queue position, status updates, and the latest estimated wait time.
        </p>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      {loading ? (
        <article className="card">
          <p className="muted">Loading…</p>
        </article>
      ) : activeQueue ? (
        <article className="card">
          <div className="stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <p className="label">Service</p>
                <strong>{activeQueue.service.name}</strong>
              </div>
              <div>
                <p className="label">Joined</p>
                <strong>{new Date(activeQueue.queue.queue[activeQueue.queue.position - 1]?.joinedAt || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</strong>
              </div>
            </div>

            <div className="stack" style={{ gap: '18px' }}>
              <div className="card" style={{ padding: '18px' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <p className="label">Your position</p>
                    <strong>{activeQueue.queue.position}</strong>
                  </div>
                  <div>
                    <p className="label">Est. wait</p>
                    <strong>{activeQueue.queue.estimatedWait ?? 0} min</strong>
                  </div>
                </div>
              </div>
              <div className="card" style={{ padding: '18px' }}>
                <p className="label">Status update</p>
                <p>{activeQueue.queue.position === 1 ? 'Almost ready' : 'Waiting'}</p>
              </div>
              <div className="card" style={{ padding: '18px' }}>
                <p className="label">What happens next</p>
                <p className="muted">
                  {activeQueue.queue.position > 1
                    ? 'Keep an eye on the queue; you will be notified when your turn is near.'
                    : 'Head to the service desk now so you can be served promptly.'}
                </p>
              </div>
            </div>
          </div>
        </article>
      ) : (
        <article className="card">
          <h2>No active queue yet</h2>
          <p className="muted">
            You do not currently have an active queue entry. Go to Join Queue to pick a service.
          </p>
        </article>
      )}
    </section>
  )
}
