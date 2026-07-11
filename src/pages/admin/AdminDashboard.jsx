import { useState } from 'react'
import { Link } from 'react-router-dom'
import AdminPageHeader from '../../components/AdminPageHeader.jsx'
import { queueEntries, services as initialServices } from '../../data/mockData.js'

export default function AdminDashboard() {
  // Keep service availability in local state so quick actions update immediately
  const [services, setServices] = useState(initialServices)
  const [notice, setNotice] = useState('')
  const openCount = services.filter((service) => service.isOpen).length
  const totalWaiting = queueEntries.length
  const busiest = services.reduce((best, service) => {
    const count = queueEntries.filter((entry) => entry.serviceId === service.id).length
    return count > best.count ? { name: service.name, count } : best
  }, { name: 'No active queues', count: 0 })

  function toggleQueue(id) {
    setServices((current) => current.map((service) => {
      if (service.id !== id) return service
      setNotice(`${service.name} queue ${service.isOpen ? 'closed' : 'opened'}.`)
      return { ...service, isOpen: !service.isOpen }
    }))
  }

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Operations at a glance"
        description="Monitor live demand, control service availability, and keep every line moving."
        action={{ to: '/admin/services', label: '+ Create service' }}
      />

      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div>}

      <section className="stat-grid" aria-label="Queue summary">
        <article className="card stat-card"><span>Open services</span><strong>{openCount}<small> / {services.length}</small></strong><p>Available to students now</p></article>
        <article className="card stat-card"><span>People waiting</span><strong>{totalWaiting}</strong><p>Across all active queues</p></article>
        <article className="card stat-card"><span>Busiest queue</span><strong className="stat-name">{busiest.name}</strong><p>{busiest.count} people waiting</p></article>
      </section>

      <section className="card admin-table-card">
        <div className="card-heading">
          <div><h2>Services</h2><p>Live queue health and quick controls</p></div>
          <Link to="/admin/queues" className="btn btn-ghost btn-sm">Manage queues</Link>
        </div>
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Service</th><th>Status</th><th>Queue</th><th>Est. clear time</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{services.map((service) => {
              const length = queueEntries.filter((entry) => entry.serviceId === service.id).length
              return (
                <tr key={service.id}>
                  <td><strong>{service.name}</strong><span>{service.expectedDurationMin} min per visit</span></td>
                  <td><span className={`badge ${service.isOpen ? 'badge-served' : 'badge-left'}`}>{service.isOpen ? 'Open' : 'Closed'}</span></td>
                  <td><strong>{length}</strong> waiting</td>
                  <td>{length ? `~${length * service.expectedDurationMin} min` : 'No wait'}</td>
                  <td><button className={`btn btn-sm ${service.isOpen ? 'btn-danger-ghost' : 'btn-ghost'}`} onClick={() => toggleQueue(service.id)}>{service.isOpen ? 'Close queue' : 'Open queue'}</button></td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
