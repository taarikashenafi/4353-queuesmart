// Join Queue page.
import { useEffect, useMemo, useState } from 'react'
import { apiDelete, apiGet, apiPost } from '../api/client.js'

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('qs_user'))
  } catch {
    return null
  }
}

export default function JoinQueue() {
  const user = getCurrentUser()
  const [services, setServices] = useState([])
  const [queueStatuses, setQueueStatuses] = useState({})
  const [selectedService, setSelectedService] = useState('')
  const [activeQueue, setActiveQueue] = useState(null)
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const serviceList = await apiGet('/services')
        const statusEntries = await Promise.all(serviceList.map(async (service) => {
          const queueStatus = await apiGet(`/queues/${service.id}/status`)
          return [service.id, queueStatus.status]
        }))

        const activeChecks = await Promise.allSettled(serviceList.map(async (service) => {
          const queue = await apiGet(`/queues/${service.id}?userId=${user.id}`)
          return { service, queue }
        }))

        if (cancelled) return

        const openServices = serviceList.filter((service) => (
          statusEntries.find(([id]) => id === service.id)?.[1] === 'open'
        ))
        const currentActive = activeChecks
          .filter((result) => result.status === 'fulfilled')
          .map((result) => result.value)
          .find(({ queue }) => typeof queue.position === 'number')
        setServices(serviceList)
        setQueueStatuses(Object.fromEntries(statusEntries))
        setSelectedService((current) => current || openServices[0]?.id || serviceList[0]?.id || '')
        setActiveQueue(currentActive || null)
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

  const openServices = useMemo(
    () => services.filter((service) => queueStatuses[service.id] === 'open'),
    [services, queueStatuses],
  )
  const service = services.find((s) => s.id === selectedService)
  const selectedQueue = activeQueue?.service.id === selectedService ? activeQueue.queue : null
  const queueLength = selectedQueue?.queue?.length ?? 0
  const estimatedWait = selectedQueue
    ? selectedQueue.estimatedWait
    : service ? queueLength * service.expectedDuration : 0

  async function handleJoin() {
    if (!user || !service) return

    setJoining(true)
    setError('')
    setNotice('')

    try {
      const result = await apiPost(`/queues/${service.id}/join`, {
        userId: user.id,
        priority: service.priority,
      })
      const queue = await apiGet(`/queues/${service.id}?userId=${user.id}`)
      setActiveQueue({ service, queue })
      setNotice(`Joined ${service.name}. Position ${result.position}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setJoining(false)
    }
  }

  async function handleLeave() {
    if (!user || !activeQueue) return

    setLeaving(true)
    setError('')
    setNotice('')

    try {
      await apiDelete(`/queues/${activeQueue.service.id}/leave`, { userId: user.id })
      setActiveQueue(null)
      setNotice(`Left ${activeQueue.service.name}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLeaving(false)
    }
  }

  return (
    <section className="stack">
      <div className="section-head">
        <span className="eyebrow">Join queue</span>
        <h1>Choose a service and join the line</h1>
        <p className="muted">
          See a live estimate for each open service, then join or leave the queue using the backend API.
        </p>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}
      {notice && <p className="muted" role="status">{notice}</p>}

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
              disabled={loading || !openServices.length}
            >
              {openServices.map((service) => (
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
            <p className="muted">
              {loading ? 'Loading queue data…' : 'Queue length and wait time come from the live backend.'}
            </p>
          </div>

          {activeQueue ? (
            <button className="btn btn-primary" type="button" onClick={handleLeave} disabled={leaving}>
              {leaving ? 'Leaving…' : 'Leave queue'}
            </button>
          ) : (
            <button className="btn btn-primary" type="button" onClick={handleJoin} disabled={joining || !service || !user}>
              {joining ? 'Joining…' : 'Join queue'}
            </button>
          )}
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
                  <strong>{service.expectedDuration} min</strong>
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

      {activeQueue && (
        <article className="card">
          <h2>Joined successfully</h2>
          <p>You are now queued for {activeQueue.service.name}. Your live position is {activeQueue.queue.position}.</p>
        </article>
      )}
    </section>
  )
}
