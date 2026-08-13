import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminPageHeader from '../../components/AdminPageHeader.jsx'
import { apiGet } from '../../api/client.js'

export default function AdminDashboard() {
  const [services, setServices] = useState([])
  const [summaryReport, setSummaryReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [statsError, setStatsError] = useState(false)

  useEffect(() => {
    let active = true

    // Settled rather than all: the stat tiles are a nice-to-have layered on top
    // of the reporting module, and the service table is what this page is for.
    // A reporting outage should cost the three tiles, not the whole screen.
    Promise.allSettled([apiGet('/services'), apiGet('/reports/summary')])
      .then(([servicesResult, summaryResult]) => {
        if (!active) return

        if (servicesResult.status === 'fulfilled') setServices(servicesResult.value)
        else setApiError(servicesResult.reason.message)

        if (summaryResult.status === 'fulfilled') setSummaryReport(summaryResult.value)
        else setStatsError(true)

        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  // An em dash rather than 0 when the figure is unknown: "0 served" is a claim
  // about the data, and it is the wrong one if the report simply failed to load.
  const getStat = (label) => {
    const stat = summaryReport?.summary?.find((s) => s.label === label)
    return stat ? stat.value : '—'
  }

  const totalServed = getStat('Total served')
  const averageWait = getStat('Average wait (min)')

  // Busiest service is derived rather than read from summary, because the
  // summary block reports the busiest *hour*. The rows carry per-service
  // throughput, so the winner is the max of those.
  let busiestService = summaryReport ? 'None yet' : '—'
  const busiest = summaryReport?.rows?.reduce(
    (prev, current) => (current.totalServed > prev.totalServed ? current : prev),
    { totalServed: 0 },
  )
  if (busiest?.totalServed > 0) busiestService = busiest.serviceName

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Operations at a glance"
        description="Review configured services, expected visit times, and queue priorities."
        action={{ to: '/admin/reports', label: 'View Reports' }}
      />

      {apiError && <p className="error-text" role="alert">{apiError}</p>}

      <section className="stat-grid" aria-label="Service summary">
        <article className="card stat-card"><span>Total served</span><strong>{totalServed}</strong><p>{statsError ? 'Statistics unavailable' : 'Across all services'}</p></article>
        <article className="card stat-card"><span>Average wait</span><strong>{averageWait}<small> min</small></strong><p>{statsError ? 'Statistics unavailable' : 'Actual historical wait'}</p></article>
        <article className="card stat-card"><span>Busiest service</span><strong className="stat-name">{busiestService}</strong><p>{statsError ? 'Statistics unavailable' : 'Highest throughput'}</p></article>
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
