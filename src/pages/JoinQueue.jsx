// Join Queue page for Assignment 2 front-end work.
// Owner: Surafel Kafel — builds the service selection and join queue UI.
import { useState } from 'react'
import { services, getEstimatedWaitMin, currentUser, queueEntries } from '../data/mockData.js'

export default function JoinQueue() {
  const [selectedService, setSelectedService] = useState(services.find((s) => s.isOpen)?.id || '')
  const [joined, setJoined] = useState(false)
  const service = services.find((s) => s.id === selectedService)

  const queueLength = service
    ? queueEntries.filter((entry) => entry.serviceId === service.id).length
    : 0

  const estimatedWait = service ? getEstimatedWaitMin(service.id, queueLength + 1) : 0

  // Simple UI state for mock join/leave behavior in A2.
  return (
    <section className="stack">
      <div className="section-head">
        <span className="eyebrow">Join queue</span>
        <h1>Choose a service and join the line</h1>
        <p className="muted">
          See a real-time estimate for each open service, then join or leave the queue using mock interaction.
        </p>
      </div>

      <div className="grid">
        <article className="card">
          <h2>Service selection</h2>
          <div className="field">
            <label className="label" htmlFor="service">Open service</label>
            <select
              id="service"
              className="select"
              value={selectedService}
              onChange={(event) => setSelectedService(event.target.value)}
            >
              {services.filter((service) => service.isOpen).map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>

          <div className="stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <p className="label">Current queue length</p>
                <strong>{queueLength} people</strong>
              </div>
              <div>
                <p className="label">Estimated wait</p>
                <strong>{estimatedWait} min</strong>
              </div>
            </div>
            <p className="muted">This is a UI simulation; queue state is mocked for Assignment 2.</p>
          </div>

          <button className="btn btn-primary" type="button" onClick={() => setJoined(!joined)}>
            {joined ? 'Leave queue' : 'Join queue'}
          </button>
        </article>

        <article className="card">
          <h2>Service details</h2>
          {service ? (
            <div className="stack">
              <div>
                <p className="label">Description</p>
                <p>{service.description}</p>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <p className="label">Duration per visit</p>
                  <strong>{service.expectedDurationMin} min</strong>
                </div>
                <div>
                  <p className="label">Priority</p>
                  <span className={`badge badge-${service.priority === 'high' ? 'high' : service.priority === 'medium' ? 'med' : 'low'}`}>
                    {service.priority}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="muted">Select an open service to see its details.</p>
          )}
        </article>
      </div>

      {joined && (
        <article className="card">
          <h2>Joined successfully</h2>
          <p>You are now queued for {service?.name}. This screen simulates joining the line and shows how the flow would look.</p>
        </article>
      )}
    </section>
  )
}
