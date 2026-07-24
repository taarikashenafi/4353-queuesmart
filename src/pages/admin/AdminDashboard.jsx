import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminPageHeader from '../../components/AdminPageHeader.jsx'
import { apiGet } from '../../api/client.js'

export default function AdminDashboard() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    let active = true

    apiGet('/services')
      .then((data) => {
        if (active) setServices(data)
      })
      .catch((error) => {
        if (active) setApiError(error.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const highPriorityCount = services.filter((service) => service.priority === 'high').length
  const averageDuration = services.length
    ? Math.round(services.reduce((total, service) => total + service.expectedDuration, 0) / services.length)
    : 0

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Operations at a glance"
        description="Review configured services, expected visit times, and queue priorities."
        action={{ to: '/admin/services', label: '+ Create service' }}
      />

      {apiError && <p className="error-text" role="alert">{apiError}</p>}

      <section className="stat-grid" aria-label="Service summary">
        <article className="card stat-card"><span>Configured services</span><strong>{services.length}</strong><p>Available through the service API</p></article>
        <article className="card stat-card"><span>High priority</span><strong>{highPriorityCount}</strong><p>Services prioritized by administrators</p></article>
        <article className="card stat-card"><span>Average duration</span><strong>{averageDuration}<small> min</small></strong><p>Expected time per visit</p></article>
      </section>

      <section className="card admin-table-card">
        <div className="card-heading">
          <div><h2>Services</h2><p>Current backend service configuration</p></div>
          <Link to="/admin/queues" className="btn btn-ghost btn-sm">Manage queues</Link>
        </div>
        {loading ? <div className="empty-state"><p>Loading services…</p></div> : <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Service</th><th>Priority</th><th>Expected duration</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{services.map((service) => (
                <tr key={service.id}>
                  <td><strong>{service.name}</strong><span>{service.description}</span></td>
                  <td><span className={`badge badge-${service.priority === 'medium' ? 'med' : service.priority}`}>{service.priority}</span></td>
                  <td>{service.expectedDuration} minutes</td>
                  <td><Link className="btn btn-ghost btn-sm" to="/admin/services">Edit</Link></td>
                </tr>
            ))}</tbody>
          </table>
          {!services.length && <div className="empty-state"><h3>No services configured</h3><p>Create a service to get started.</p></div>}
        </div>}
      </section>
    </div>
  )
}
