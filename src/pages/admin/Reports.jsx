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

// Default range: the last two weeks, ending today. Two reasons it is not "all
// time". A range that spans a couple of weeks is what an admin actually wants
// to look at, and — since the filter compares date(joined_at) in UTC — a
// multi-day range is immune to the boundary case where an evening's entries
// have already rolled to the next UTC day. Both fields stay editable.
function utcDay(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10)
}

export default function Reports() {
  const [reportType, setReportType] = useState('participation')
  const [fromDate, setFromDate] = useState(() => utcDay(-13))
  const [toDate, setToDate] = useState(() => utcDay(0))
  const [serviceId, setServiceId] = useState('')
  const [services, setServices] = useState([])
  
  const [reportData, setReportData] = useState(null)
  // The report type and query string that actually produced `reportData`.
  // Exports replay this, never live form state — see handleDownload.
  const [generated, setGenerated] = useState(null)
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
    setGenerated(null)

    try {
      const q = buildQuery()
      const data = await apiGet(`/reports/${reportType}${q ? `?${q}` : ''}`)
      setReportData(data)
      setGenerated({ reportType, query: q })
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Replays the request behind the table on screen. Reading live form state
  // here would hand you a Service Activity file while a Participation table is
  // still displayed, any time a filter changed without pressing Generate.
  const handleDownload = async (format) => {
    if (!generated) return
    if (format === 'csv') setDownloadingCsv(true)
    if (format === 'pdf') setDownloadingPdf(true)

    try {
      const params = new URLSearchParams(generated.query)
      params.append('format', format)
      await apiDownload(`/reports/${generated.reportType}?${params.toString()}`)
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
          {/* Entries are filtered on their UTC date, because that is how
              joined_at is stored. Saying so is the difference between an admin
              reading an evening's activity as missing and understanding that
              it landed on the next UTC day. */}
          <p className="muted">Dates are matched in UTC.</p>
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

          {/* Exports replay the snapshot taken when Generate ran, so the file
              always matches the preview above it even if the form has been
              changed since. Disabled until a report exists so nobody downloads
              an empty range by accident. */}
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
