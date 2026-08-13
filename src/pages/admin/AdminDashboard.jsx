import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminPageHeader from '../../components/AdminPageHeader.jsx'
import { apiGet } from '../../api/client.js'

export default function AdminDashboard() {
  const [services, setServices] = useState([])
  const [summaryReport, setSummaryReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    let active = true

    Promise.all([
      apiGet('/services'),
      apiGet('/reports/summary')
    ])
      .then(([servicesData, summaryData]) => {
        if (active) {
          setServices(servicesData)
          setSummaryReport(summaryData)
        }
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

  const getStat = (label) => {
    if (!summaryReport || !summaryReport.summary) return 0;
    const stat = summaryReport.summary.find(s => s.label === label);
    return stat ? stat.value : 0;
  }

  const totalServed = getStat('Total served');
  const averageWait = getStat('Average wait (min)');
  
  let busiestService = 'N/A';
  if (summaryReport && summaryReport.rows && summaryReport.rows.length > 0) {
    const busiest = summaryReport.rows.reduce((prev, current) => 
      (current.totalServed > prev.totalServed) ? current : prev
    );
    if (busiest.totalServed > 0) {
      busiestService = busiest.serviceName;
    }
  }

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Operations at a glance"
        description="Review configured services, expected visit times, and queue priorities."
        action={{ to: '/admin/reports', label: 'View Reports' }}
      />

      {apiError && <p className="error-text" role="alert">{apiError}</p>}

      <section className="stat-grid" aria-label="Service summary">
        <article className="card stat-card"><span>Total served</span><strong>{totalServed}</strong><p>Across all services</p></article>
        <article className="card stat-card"><span>Average wait</span><strong>{averageWait}<small> min</small></strong><p>Actual historical wait</p></article>
        <article className="card stat-card"><span>Busiest service</span><strong>{busiestService}</strong><p>Highest throughput</p></article>
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
