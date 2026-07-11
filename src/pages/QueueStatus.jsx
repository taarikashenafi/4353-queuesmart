// Queue Status page for Assignment 2 front-end work.
// Owner: Surafel Kafel — displays the user's current queue position and status.
import { getUserQueueEntries, currentUser, getServiceById, getEstimatedWaitMin } from '../data/mockData.js'

export default function QueueStatus() {
  const userQueues = getUserQueueEntries(currentUser.id)
  const activeQueue = userQueues[0]
  const service = activeQueue ? getServiceById(activeQueue.serviceId) : null
  const estimatedWait = activeQueue
    ? getEstimatedWaitMin(activeQueue.serviceId, activeQueue.position)
    : 0

  // Render the current queue status for the mock logged-in user.
  return (
    <section className="stack">
      <div className="section-head">
        <span className="eyebrow">Queue status</span>
        <h1>Track your place in line</h1>
        <p className="muted">
          Check your current queue position, status updates, and the latest estimated wait time.
        </p>
      </div>

      {activeQueue ? (
        <article className="card">
          <div className="stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <p className="label">Service</p>
                <strong>{service?.name}</strong>
              </div>
              <div>
                <p className="label">Joined</p>
                <strong>{new Date(activeQueue.joinedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</strong>
              </div>
            </div>

            <div className="stack" style={{ gap: '18px' }}>
              <div className="card" style={{ padding: '18px' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <p className="label">Your position</p>
                    <strong>{activeQueue.position}</strong>
                  </div>
                  <div>
                    <p className="label">Est. wait</p>
                    <strong>{estimatedWait} min</strong>
                  </div>
                </div>
              </div>
              <div className="card" style={{ padding: '18px' }}>
                <p className="label">Status update</p>
                <p>{activeQueue.status === 'waiting' ? 'Waiting' : activeQueue.status === 'almost_ready' ? 'Almost ready' : 'Served'}</p>
              </div>
              <div className="card" style={{ padding: '18px' }}>
                <p className="label">What happens next</p>
                <p className="muted">
                  {activeQueue.status === 'waiting'
                    ? 'Keep an eye on the queue; you will be notified when your turn is near.'
                    : activeQueue.status === 'almost_ready'
                    ? 'Head to the service desk now so you can be served promptly.'
                    : 'Your visit is done — feel free to join another line.'}
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
