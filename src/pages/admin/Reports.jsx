import { useEffect, useState } from 'react'
import AdminPageHeader from '../../components/AdminPageHeader.jsx'
import { apiGet, apiDownload } from '../../api/client.js'

// The backend echoes the filters it actually applied, which is what should be
// shown rather than the form state — a filter the API ignored would otherwise
// be described as active. Mirrors describeFilters in server/services/reportExport.js
// so the on-screen line and the exported file's header read identically.
function describeFilters(filters) {
  const parts = []

  if (filters?.from && filters?.to) parts.push(`${filters.from} to ${filters.to}`)
  else if (filters?.from) parts.push(`From ${filters.from}`)
  else if (filters?.to) parts.push(`Up to ${filters.to}`)
  else parts.push('All time')

  parts.push(filters?.serviceName ? `Service: ${filters.serviceName}` : 'All services')

  return parts.join(' · ')
}

export default function Reports() {
  const [reportType, setReportType] = useState('participation')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [services, setServices] = useState([])
  
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [downloadingCsv, setDownloadingCsv] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    let active = true
    apiGet('/services')
      .then((data) => {
        if (active) setServices(data)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  const buildQuery = () => {
    const params = new URLSearchParams()
    if (fromDate) params.append('from', fromDate)
    if (toDate) params.append('to', toDate)
    if (serviceId) params.append('serviceId', serviceId)
    return params.toString()
  }

  const handleGenerate = async () => {
    setLoading(true)
    setApiError('')
    setReportData(null)
    
    try {
      const q = buildQuery()
      const data = await apiGet(`/reports/${reportType}${q ? `?${q}` : ''}`)
      setReportData(data)
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (format) => {
    if (format === 'csv') setDownloadingCsv(true)
    if (format === 'pdf') setDownloadingPdf(true)
    
    try {
      const q = buildQuery()
      const params = new URLSearchParams(q)
      params.append('format', format)
      await apiDownload(`/reports/${reportType}?${params.toString()}`)
    } catch (err) {
      setApiError(err.message)
    } finally {
      if (format === 'csv') setDownloadingCsv(false)
      if (format === 'pdf') setDownloadingPdf(false)
    }
  }

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Reports"
        description="Generate and export system activity reports."
      />
      
      <div className="card report-toolbar">
        <div className="field">
          <label className="label" htmlFor="reportType">Report type</label>
          <select
            id="reportType"
            className="select"
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
          >
            <option value="participation">Queue Participation History</option>
            <option value="services">Service Activity</option>
            <option value="summary">Usage Statistics</option>
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor="fromDate">From date</label>
          <input
            type="date"
            id="fromDate"
            className="input"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="toDate">To date</label>
          <input
            type="date"
            id="toDate"
            className="input"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="serviceId">Service</label>
          <select
            id="serviceId"
            className="select"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">All services</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="report-actions">
          <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating…' : 'Generate report'}
          </button>

          {/* Exports re-send the same filters rather than serialising what is on
              screen, so the file always matches the preview above it. Disabled
              until a report exists so nobody downloads an empty range by accident. */}
          <button
            className="btn btn-ghost"
            onClick={() => handleDownload('csv')}
            disabled={!reportData || downloadingCsv || downloadingPdf}
          >
            {downloadingCsv ? 'Preparing…' : 'Download CSV'}
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => handleDownload('pdf')}
            disabled={!reportData || downloadingPdf || downloadingCsv}
          >
            {downloadingPdf ? 'Preparing…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {apiError && <p className="error-text" role="alert">{apiError}</p>}

      {reportData && (
        <section className="card admin-table-card">
          <div className="card-heading">
            <div className="report-meta">
              <h2>{reportData.title}</h2>
              <p>Generated {new Date(reportData.generatedAt).toLocaleString()}</p>
              <p className="report-filters">{describeFilters(reportData.filters)}</p>
            </div>
          </div>

          <div className="table-wrap">
            {reportData.rows && reportData.rows.length > 0 ? (
              <table className="admin-table">
                <thead>
                  <tr>
                    {reportData.columns.map(col => (
                      <th key={col.key}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.rows.map((row, i) => (
                    <tr key={i}>
                      {reportData.columns.map(col => (
                        <td key={col.key}>{row[col.key]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p>No activity in this range</p>
              </div>
            )}
          </div>
          
          {reportData.summary && reportData.summary.length > 0 && (
            <dl className="report-summary">
              {reportData.summary.map((stat) => (
                <div key={stat.label}>
                  <dt>{stat.label}</dt>
                  <dd>{stat.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}
    </div>
  )
}
