import { useEffect, useMemo, useState } from 'react'
import AdminPageHeader from '../../components/AdminPageHeader.jsx'
import { apiDelete, apiGet, apiPost } from '../../api/client.js'

export default function QueueManagement() {
  const [services, setServices] = useState([])
  const [serviceId, setServiceId] = useState('')
  const [queues, setQueues] = useState({})
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const serviceList = await apiGet('/services')
        const queueRows = await Promise.all(serviceList.map(async (service) => {
          const queue = await apiGet(`/queues/${service.id}`)
          const status = await apiGet(`/queues/${service.id}/status`)
          return [service.id, { ...queue, status: status.status }]
        }))

        if (cancelled) return

        setServices(serviceList)
        setQueues(Object.fromEntries(queueRows))
        setServiceId(serviceList[0]?.id || '')
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
  }, [])

  const service = services.find((item) => item.id === serviceId)
  const queue = queues[serviceId]?.queue || []
  const clearTime = queue.length * (service?.expectedDuration || 0)
  const serviceOptions = useMemo(() => services.map((item) => ({ ...item, count: queues[item.id]?.length || 0 })), [queues])

  async function refreshServiceQueue(currentServiceId) {
    const [queue, status] = await Promise.all([
      apiGet(`/queues/${currentServiceId}`),
      apiGet(`/queues/${currentServiceId}/status`),
    ])
    setQueues((current) => ({ ...current, [currentServiceId]: { ...queue, status: status.status } }))
  }

  async function remove(entry) {
    setError('')
    setNotice('')

    try {
      await apiDelete(`/queues/${serviceId}/leave`, { userId: entry.userId })
      await refreshServiceQueue(serviceId)
      setNotice(`Removed user ${entry.userId} from the queue.`)
    } catch (err) {
      setError(err.message)
    }
  }

  async function serveNext() {
    if (!queue.length) return

    setError('')
    setNotice('')

    try {
      const result = await apiPost(`/queues/${serviceId}/serve`)
      await refreshServiceQueue(serviceId)
      setNotice(`Served user ${result.userId}.`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="admin-page">
      <AdminPageHeader title="Queue management" description="Review live queue data, remove waiting users, and serve the next person." />
      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div>}
      {error && <p className="error-text" role="alert">{error}</p>}

      <section className="queue-toolbar card">
        <div className="field queue-select-field"><label className="label" htmlFor="queue-service">Selected service</label><select id="queue-service" className="select" value={serviceId} onChange={(event) => { setServiceId(event.target.value); setNotice('') }}>{serviceOptions.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.count})</option>)}</select></div>
        <div className="queue-summary"><span><strong>{queue.length}</strong> waiting</span><span><strong>~{clearTime}</strong> min to clear</span><span className={`badge ${queues[serviceId]?.status === 'open' ? 'badge-served' : 'badge-left'}`}>{queues[serviceId]?.status === 'open' ? 'Open' : 'Closed'}</span></div>
        <button className="btn btn-primary" type="button" onClick={serveNext} disabled={!queue.length || loading}>Serve next</button>
      </section>

      <section className="card queue-card">
        <div className="card-heading"><div><h2>{service?.name || 'Queue'}</h2><p>Live waiting entries are loaded from the backend.</p></div></div>
        {loading ? <div className="empty-state"><p>Loading queue…</p></div> : null}
        {queue.length ? <ol className="queue-list">{queue.map((entry, index) => (
          <li className={`queue-person ${index === 0 ? 'queue-person-next' : ''}`} key={entry.id}>
            <div className="position-number">{index + 1}</div>
            <div className="avatar" aria-hidden="true">{entry.userId}</div>
            <div className="queue-person-info"><strong>User {entry.userId}</strong><span>Joined {new Date(entry.joinedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · Est. wait {index * (service?.expectedDuration || 0)} min</span></div>
            <span className={`badge ${index === 0 ? 'badge-almost' : 'badge-waiting'}`}>{index === 0 ? 'Next' : 'Waiting'}</span>
            <div className="queue-actions">
              <button className="icon-btn icon-btn-danger" onClick={() => remove(entry)} aria-label={`Remove user ${entry.userId}`}>×</button>
            </div>
          </li>
        ))}</ol> : !loading ? <div className="empty-state"><div className="empty-mark">✓</div><h3>Queue cleared</h3><p>No one is waiting for {service?.name || 'this service'}.</p></div> : null}
      </section>
    </div>
  )
}
