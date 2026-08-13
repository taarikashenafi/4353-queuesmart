import { useEffect, useState } from 'react'
import AdminPageHeader from '../../components/AdminPageHeader.jsx'
import { apiGet, apiDownload } from '../../api/client.js'

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
      
      <div className="card report-controls" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', padding: '1.5rem' }}>
        <div>
          <label htmlFor="reportType" style={{display: 'block', marginBottom: '0.25rem'}}>Report Type</label>
          <select 
            id="reportType" 
            value={reportType} 
            onChange={e => setReportType(e.target.value)}
            className="input"
          >
            <option value="participation">Queue Participation History</option>
            <option value="services">Service Activity</option>
            <option value="summary">Usage Statistics</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="fromDate" style={{display: 'block', marginBottom: '0.25rem'}}>From Date</label>
          <input 
            type="date" 
            id="fromDate" 
            value={fromDate} 
            onChange={e => setFromDate(e.target.value)} 
            className="input"
          />
        </div>
        
        <div>
          <label htmlFor="toDate" style={{display: 'block', marginBottom: '0.25rem'}}>To Date</label>
          <input 
            type="date" 
            id="toDate" 
            value={toDate} 
            onChange={e => setToDate(e.target.value)} 
            className="input"
          />
        </div>
        
        <div>
          <label htmlFor="serviceId" style={{display: 'block', marginBottom: '0.25rem'}}>Service</label>
          <select 
            id="serviceId" 
            value={serviceId} 
            onChange={e => setServiceId(e.target.value)}
            className="input"
          >
            <option value="">All services</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
          <button 
            className="btn btn-primary" 
            onClick={handleGenerate} 
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate report'}
          </button>
          
          <button 
            className="btn btn-ghost" 
            onClick={() => handleDownload('csv')} 
            disabled={!reportData || downloadingCsv}
          >
            {downloadingCsv ? '...' : 'Download CSV'}
          </button>

          <button 
            className="btn btn-ghost" 
            onClick={() => handleDownload('pdf')} 
            disabled={!reportData || downloadingPdf}
          >
            {downloadingPdf ? '...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {apiError && <p className="error-text" role="alert">{apiError}</p>}

      {reportData && (
        <section className="card admin-table-card" style={{overflowX: 'auto'}}>
          <div className="card-heading">
            <div>
              <h2>{reportData.title}</h2>
              <p>Generated at: {new Date(reportData.generatedAt).toLocaleString()}</p>
              <p style={{fontSize: '0.85rem', color: 'var(--color-text-dim)'}}>
                Filters: {JSON.stringify(reportData.filters)}
              </p>
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
            <div style={{display: 'flex', gap: '1.5rem', padding: '1.5rem', borderTop: '1px solid var(--color-border)'}}>
              {reportData.summary.map(stat => (
                <div key={stat.label}>
                  <div style={{fontSize: '0.85rem', color: 'var(--color-text-dim)'}}>{stat.label}</div>
                  <div style={{fontSize: '1.25rem', fontWeight: 600}}>{stat.value}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
