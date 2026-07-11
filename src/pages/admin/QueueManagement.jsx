import { useMemo, useState } from 'react'
import AdminPageHeader from '../../components/AdminPageHeader.jsx'
import { QUEUE_STATUS, queueEntries, services } from '../../data/mockData.js'

// Recalculate positions and status whenever the admin changes the order
function normalize(entries) {
  return entries.map((entry, index) => ({ ...entry, position: index + 1, status: index === 0 ? QUEUE_STATUS.ALMOST_READY : QUEUE_STATUS.WAITING }))
}

export default function QueueManagement() {
  const firstActive = services.find((service) => queueEntries.some((entry) => entry.serviceId === service.id))?.id || services[0].id
  const [serviceId, setServiceId] = useState(firstActive)
  const [queues, setQueues] = useState(() => Object.fromEntries(services.map((service) => [service.id, normalize(queueEntries.filter((entry) => entry.serviceId === service.id).sort((a, b) => a.position - b.position))])))
  const [notice, setNotice] = useState('')
  const service = services.find((item) => item.id === serviceId)
  const queue = queues[serviceId] || []
  const clearTime = queue.length * service.expectedDurationMin
  const serviceOptions = useMemo(() => services.map((item) => ({ ...item, count: queues[item.id]?.length || 0 })), [queues])

  function changeQueue(updater, message) {
    // Centralize mock queue updates so every action also produces feedback
    setQueues((current) => ({ ...current, [serviceId]: normalize(updater(current[serviceId] || [])) }))
    setNotice(message)
  }

  function move(index, direction) {
    const target = index + direction
    if (target < 0 || target >= queue.length) return
    changeQueue((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    }, `${queue[index].name} moved ${direction < 0 ? 'up' : 'down'} in the queue.`)
  }

  function remove(entry) {
    changeQueue((current) => current.filter((item) => item.id !== entry.id), `${entry.name} removed from the queue.`)
  }

  function serveNext() {
    // Serving removes the first user and promotes the next person automatically
    if (!queue.length) return
    changeQueue((current) => current.slice(1), `${queue[0].name} marked as served. The next person was notified.`)
  }

  return (
    <div className="admin-page">
      <AdminPageHeader title="Queue management" description="Reorder or remove waiting users and simulate serving the next person." />
      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div>}

      <section className="queue-toolbar card">
        <div className="field queue-select-field"><label className="label" htmlFor="queue-service">Selected service</label><select id="queue-service" className="select" value={serviceId} onChange={(event) => { setServiceId(event.target.value); setNotice('') }}>{serviceOptions.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.count})</option>)}</select></div>
        <div className="queue-summary"><span><strong>{queue.length}</strong> waiting</span><span><strong>~{clearTime}</strong> min to clear</span><span className={`badge ${service.isOpen ? 'badge-served' : 'badge-left'}`}>{service.isOpen ? 'Open' : 'Closed'}</span></div>
        <button className="btn btn-primary" type="button" onClick={serveNext} disabled={!queue.length}>Serve next</button>
      </section>

      <section className="card queue-card">
        <div className="card-heading"><div><h2>{service.name}</h2><p>Drag-free keyboard-accessible controls keep the simulated queue in order.</p></div></div>
        {queue.length ? <ol className="queue-list">{queue.map((entry, index) => (
          <li className={`queue-person ${index === 0 ? 'queue-person-next' : ''}`} key={entry.id}>
            <div className="position-number">{index + 1}</div>
            <div className="avatar" aria-hidden="true">{entry.name.split(' ').map((part) => part[0]).join('')}</div>
            <div className="queue-person-info"><strong>{entry.name}</strong><span>Joined {new Date(entry.joinedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · Est. wait {index * service.expectedDurationMin} min</span></div>
            <span className={`badge ${index === 0 ? 'badge-almost' : 'badge-waiting'}`}>{index === 0 ? 'Next' : 'Waiting'}</span>
            <div className="queue-actions">
              <button className="icon-btn" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${entry.name} up`}>↑</button>
              <button className="icon-btn" onClick={() => move(index, 1)} disabled={index === queue.length - 1} aria-label={`Move ${entry.name} down`}>↓</button>
              <button className="icon-btn icon-btn-danger" onClick={() => remove(entry)} aria-label={`Remove ${entry.name}`}>×</button>
            </div>
          </li>
        ))}</ol> : <div className="empty-state"><div className="empty-mark">✓</div><h3>Queue cleared</h3><p>No one is waiting for {service.name}.</p></div>}
      </section>
    </div>
  )
}
