// History page for Assignment 2 front-end work.
// Owner: Surafel Kafel — implements the user's past queue history screen.
import { currentUser, getHistoryForUser } from '../data/mockData.js'

export default function History() {
  const history = getHistoryForUser(currentUser.id)

  return (
    <section className="stack">
      <div className="section-head">
        <span className="eyebrow">History</span>
        <h1>Your past queue visits</h1>
        <p className="muted">
          Review the services you joined before, the outcome, and how long you waited.
        </p>
      </div>

      <article className="card">
        <div className="stack">
          {history.length > 0 ? (
            history.map((entry) => (
              <div key={entry.id} className="card" style={{ padding: '16px', borderColor: 'transparent' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <strong>{entry.serviceName}</strong>
                    <p className="muted" style={{ marginTop: '4px' }}>{entry.date}</p>
                  </div>
                  <span className={`badge badge-${entry.outcome === 'served' ? 'served' : entry.outcome === 'left' ? 'left' : 'waiting'}`}>
                    {entry.outcome === 'served' ? 'Served' : entry.outcome === 'left' ? 'Left' : 'No show'}
                  </span>
                </div>
                <div className="row" style={{ justifyContent: 'space-between', marginTop: '10px' }}>
                  <span className="muted">Waited {entry.waitedMin} min</span>
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
