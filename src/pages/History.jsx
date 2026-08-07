// History page.
// Owner: Uchenna Okoronkwo — wires past queue participations to the backend.
import { useEffect, useState } from 'react'
import { apiGet } from '../api/client.js'

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('qs_user'))
  } catch {
    return null
  }
}

export default function History() {
  const user = getCurrentUser()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return

    apiGet(`/history/${user.id}`)
      .then(setHistory)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [user?.id])

  if (!user) {
    return <p className="muted">Please log in to view your history.</p>
  }

  return (
    <section className="stack">
      <div className="section-head">
        <span className="eyebrow">History</span>
        <h1>Your past queue visits</h1>
        <p className="muted">
          Review the services you joined before, the outcome, and how long you waited.
        </p>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      <article className="card">
        <div className="stack">
          {loading ? (
            <p className="muted">Loading…</p>
          ) : history.length > 0 ? (
            history.map((entry) => (
              <div key={entry.id} className="card" style={{ padding: '16px', borderColor: 'transparent' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <strong>{entry.serviceName}</strong>
                    <p className="muted" style={{ marginTop: '4px' }}>
                      {new Date(entry.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`badge badge-${entry.outcome === 'served' ? 'served' : 'left'}`}>
                    {entry.outcome === 'served' ? 'Served' : 'Canceled'}
                  </span>
                </div>
                <div className="row" style={{ justifyContent: 'space-between', marginTop: '10px' }}>
                  <span className="muted">Waited {entry.waitTime ?? 0} min</span>
                  <span className="muted">ID: {entry.id}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">No queue history is available yet.</p>
          )}
        </div>
      </article>
    </section>
  )
}
