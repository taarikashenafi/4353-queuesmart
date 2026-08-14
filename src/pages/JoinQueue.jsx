// Join Queue page.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiDelete, apiGet, apiPost } from '../api/client.js'

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('qs_user'))
  } catch {
    return null
  }
}

export default function JoinQueue() {
  const user = useMemo(() => getCurrentUser(), [])
  const [services, setServices] = useState([])
  const [queueStatuses, setQueueStatuses] = useState({})
  const [queueLengths, setQueueLengths] = useState({})
  const [waitModels, setWaitModels] = useState({})
  const [selectedService, setSelectedService] = useState('')
  const [activeQueue, setActiveQueue] = useState(null)
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // One roster fetch per service gives us everything the page shows: how many
  // people are waiting, whether the queue is open, and — if the current user
  // is in the list — their own position.
  //
  // We deliberately do not pass ?userId= here: GET /queues/:id 404s when the
  // user isn't in that particular queue, and this page asks about every
  // service. So the roster comes back without `estimatedWait` and we derive it
  // from `waitModel`, which the endpoint always returns. Same formula the
  // server uses — (people ahead) × minutesPerPerson — so this page and Queue
  // Status quote the same number.
  const loadQueues = useCallback(async () => {
    const serviceList = await apiGet('/services')
    const rows = await Promise.all(serviceList.map(async (service) => {
      const [queue, status] = await Promise.all([
        apiGet(`/queues/${service.id}`),
        apiGet(`/queues/${service.id}/status`),
      ])
      return { service, entries: queue.queue, queue, status: status.status }
    }))

    const mine = rows
      .map((row) => {
        const index = row.entries.findIndex((entry) => entry.userId === String(user.id))
        if (index < 0) return null
        const perPerson = row.queue.waitModel?.minutesPerPerson ?? row.service.expectedDuration
        return {
          service: row.service,
          position: index + 1,
          estimatedWait: row.queue.estimatedWait ?? Math.round(index * perPerson),
          waitModel: row.queue.waitModel,
        }
      })
      .find(Boolean)

    return {
      services: serviceList,
      statuses: Object.fromEntries(rows.map((row) => [row.service.id, row.status])),
      lengths: Object.fromEntries(rows.map((row) => [row.service.id, row.entries.length])),
      waitModels: Object.fromEntries(rows.map((row) => [row.service.id, row.queue.waitModel || null])),
      active: mine || null,
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return undefined
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const result = await loadQueues()
        if (cancelled) return

        setServices(result.services)
        setQueueStatuses(result.statuses)
        setQueueLengths(result.lengths)
        setWaitModels(result.waitModels)
        setActiveQueue(result.active)

        const firstOpen = result.services.find((item) => result.statuses[item.id] === 'open')
        setSelectedService((current) => (
          current || result.active?.service.id || firstOpen?.id || result.services[0]?.id || ''
        ))
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
  }, [user?.id, loadQueues])

  async function refresh() {
    const result = await loadQueues()
    setServices(result.services)
    setQueueStatuses(result.statuses)
    setQueueLengths(result.lengths)
    setWaitModels(result.waitModels)
    setActiveQueue(result.active)
  }

  const openServices = useMemo(
    () => services.filter((service) => queueStatuses[service.id] === 'open'),
    [services, queueStatuses],
  )
  const service = services.find((s) => s.id === selectedService)
  const queueLength = queueLengths[selectedService] ?? 0
  // Already in this line? Show your own wait. Otherwise show what a new
  // joiner would face — everyone currently ahead of them.
  const inSelectedQueue = activeQueue?.service.id === selectedService
  const selectedWaitModel = waitModels[selectedService] || null
  const estimatedWait = inSelectedQueue
    ? activeQueue.estimatedWait
    : Math.round((selectedWaitModel?.minutesPerPerson ?? service?.expectedDuration ?? 0) * Math.max(queueLength, 0))
  // No model yet — still loading, or a service whose roster we haven't got —
  // reads as the scheduled duration. "based on 0 recent visits" would claim
  // evidence we don't have.
  const waitProvenance = !selectedWaitModel || selectedWaitModel.source === 'default'
    ? 'using scheduled duration'
    : `based on ${selectedWaitModel.sampleSize} recent visits`
  // People ahead of whoever this number is for: your own position minus one if
  // you're already in the line, otherwise everyone currently waiting.
  const peopleAhead = inSelectedQueue
    ? Math.max(activeQueue.position - 1, 0)
    : Math.max(queueLength, 0)
  // What the pre-engine formula would have quoted. Shown only when the engine
  // has real evidence and the two actually differ, so the screen makes the case
  // for the measured estimate rather than the number just looking arbitrary.
  const scheduledWait = Math.round(peopleAhead * (service?.expectedDuration ?? 0))
  const showWaitContrast = Boolean(selectedWaitModel)
    && selectedWaitModel.source !== 'default'
    && scheduledWait !== estimatedWait

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
      await refresh()
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

    const leftServiceName = activeQueue.service.name

    try {
      await apiDelete(`/queues/${activeQueue.service.id}/leave`, { userId: user.id })
      await refresh()
      setNotice(`Left ${leftServiceName}.`)
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
                  {service.name} ({queueLengths[service.id] ?? 0} waiting)
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
                <p className="label">{inSelectedQueue ? 'Your estimated wait' : 'Estimated wait'}</p>
                <strong>{estimatedWait} min</strong>
              </div>
            </div>
            <p className="muted">
              {loading ? 'Loading queue data…' : waitProvenance}
              {!loading && showWaitContrast
                && ` · scheduled duration alone would say ${scheduledWait} min`}
            </p>
          </div>

          {activeQueue ? (
            <button className="btn btn-primary" type="button" onClick={handleLeave} disabled={leaving}>
              {leaving ? 'Leaving…' : `Leave ${activeQueue.service.name} queue`}
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
          <p>
            You are now queued for {activeQueue.service.name}. Your live position is {activeQueue.position}
            {' '}with an estimated {activeQueue.estimatedWait} min wait.
          </p>
        </article>
      )}
    </section>
  )
}
