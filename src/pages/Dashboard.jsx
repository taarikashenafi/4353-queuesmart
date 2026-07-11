// User Dashboard page for Assignment 2 front-end work.
// Owner: Surafel Kafel — implements the main user overview screen.
import { Link } from 'react-router-dom'
import {
  currentUser,
  services,
  getNotificationsForUser,
  getUserQueueEntries,
  getEstimatedWaitMin,
  getServiceById,
} from '../data/mockData.js'

export default function Dashboard() {
  const userQueues = getUserQueueEntries(currentUser.id)
  const notifications = getNotificationsForUser(currentUser.id)
  const openServices = services.filter((service) => service.isOpen)

  const activeQueue = userQueues[0]
  const activeService = activeQueue ? getServiceById(activeQueue.serviceId) : null
  const estimatedWait = activeQueue
    ? getEstimatedWaitMin(activeQueue.serviceId, activeQueue.position)
    : 0

  // Render the user dashboard with active queue summary, open services, and notifications.
  return (
    <section className="stack">
      <div className="section-head">
        <span className="eyebrow">User dashboard</span>
        <h1>Welcome back, {currentUser.name.split(' ')[0]}</h1>
        <p className="muted">
          Review your active queue, discover open services, and catch up on the latest notifications.
        </p>
      </div>

      <div className="grid">
        <article className="card">
          <h2>Quick summary</h2>
          <div className="stack">
            <div className="row">
              <strong>{openServices.length}</strong>
              <span className="muted">services are open now</span>
            </div>
            <div className="row">
              <strong>{userQueues.length}</strong>
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
          {activeQueue ? (
            <div className="stack">
              <div className="row">
                <div>
                  <p className="label">Service</p>
                  <strong>{activeService?.name}</strong>
                </div>
                <div>
                  <p className="label">Position</p>
                  <strong>{activeQueue.position}</strong>
                </div>
              </div>
              <div className="row">
                <div>
                  <p className="label">Estimated wait</p>
                  <strong>{estimatedWait} minutes</strong>
                </div>
                <div>
                  <p className="label">Status</p>
                  <span className={`badge badge-${activeQueue.status === 'waiting' ? 'waiting' : activeQueue.status === 'almost_ready' ? 'almost' : 'served'}`}>
                    {activeQueue.status === 'waiting'
                      ? 'Waiting'
                      : activeQueue.status === 'almost_ready'
                      ? 'Almost ready'
                      : 'Served'}
                  </span>
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
          <h2>Open services</h2>
          <div className="stack">
            {openServices.map((service) => (
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
                  <span className="muted" style={{ fontSize: '0.85rem' }}>{new Date(notification.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
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
