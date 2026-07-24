import { useEffect, useState } from 'react'
import AdminPageHeader from '../../components/AdminPageHeader.jsx'
import { apiGet, apiPost, apiPut } from '../../api/client.js'

const PRIORITY_LEVELS = ['low', 'medium', 'high']
const emptyForm = { name: '', description: '', expectedDuration: '', priority: 'medium' }

export default function ServiceManagement() {
  const [services, setServices] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

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

  function validate() {
    const next = {}
    if (!form.name.trim()) next.name = 'Service name is required.'
    else if (form.name.trim().length > 100) next.name = 'Service name must be 100 characters or fewer.'
    if (!form.description.trim()) next.description = 'Description is required.'
    else if (form.description.trim().length > 500) next.description = 'Description must be 500 characters or fewer.'
    const duration = Number(form.expectedDuration)
    if (!form.expectedDuration) next.expectedDuration = 'Expected duration is required.'
    else if (!Number.isInteger(duration) || duration < 1 || duration > 480) next.expectedDuration = 'Enter a whole number from 1 to 480.'
    if (!PRIORITY_LEVELS.includes(form.priority)) next.priority = 'Select a valid priority.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit(event) {
    event.preventDefault()
    if (!validate()) return

    const serviceInput = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      expectedDuration: Number(form.expectedDuration),
    }

    setApiError('')
    setNotice('')
    setSubmitting(true)

    try {
      if (editingId) {
        const updated = await apiPut(`/services/${editingId}`, serviceInput)
        setServices((current) => current.map((service) => service.id === editingId ? updated : service))
        setNotice(`${updated.name} updated.`)
      } else {
        const created = await apiPost('/services', serviceInput)
        setServices((current) => [...current, created])
        setNotice(`${created.name} created.`)
      }
      cancelEdit()
    } catch (error) {
      setApiError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(service) {
    setEditingId(service.id)
    setForm({ name: service.name, description: service.description, expectedDuration: String(service.expectedDuration), priority: service.priority })
    setErrors({})
    setApiError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
    setErrors({})
  }

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setApiError('')
  }

  return (
    <div className="admin-page">
      <AdminPageHeader title="Service management" description="Create services and define the duration and priority used by QueueSmart's wait estimates." />
      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div>}
      {apiError && <p className="error-text" role="alert">{apiError}</p>}

      <div className="management-layout">
        <form className="card service-form" onSubmit={submit} noValidate>
          <div className="card-heading"><div><h2>{editingId ? 'Edit service' : 'New service'}</h2><p>All fields are required.</p></div></div>
          <div className="field">
            <label className="label" htmlFor="service-name">Service name <span aria-hidden="true">*</span></label>
            <input id="service-name" className={`input ${errors.name ? 'input-error' : ''}`} name="name" value={form.name} onChange={updateField} maxLength="100" required aria-describedby="name-help name-error" />
            <div className="field-meta"><span id="name-help" className="hint">Shown to users joining the queue</span><span className="hint">{form.name.length}/100</span></div>
            {errors.name && <span id="name-error" className="error-text">{errors.name}</span>}
          </div>
          <div className="field">
            <label className="label" htmlFor="service-description">Description <span aria-hidden="true">*</span></label>
            <textarea id="service-description" className={`textarea ${errors.description ? 'input-error' : ''}`} name="description" value={form.description} onChange={updateField} rows="4" maxLength="500" required />
            {errors.description && <span className="error-text">{errors.description}</span>}
          </div>
          <div className="form-row">
            <div className="field">
              <label className="label" htmlFor="duration">Expected duration (minutes) <span aria-hidden="true">*</span></label>
              <input id="duration" className={`input ${errors.expectedDuration ? 'input-error' : ''}`} type="number" name="expectedDuration" value={form.expectedDuration} onChange={updateField} min="1" max="480" step="1" required />
              {errors.expectedDuration && <span className="error-text">{errors.expectedDuration}</span>}
            </div>
            <div className="field">
              <label className="label" htmlFor="priority">Priority level <span aria-hidden="true">*</span></label>
              <select id="priority" className="select" name="priority" value={form.priority} onChange={updateField} required>
                {PRIORITY_LEVELS.map((level) => <option key={level} value={level}>{level[0].toUpperCase() + level.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-actions"><button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : editingId ? 'Save changes' : 'Create service'}</button>{editingId && <button className="btn btn-ghost" type="button" onClick={cancelEdit} disabled={submitting}>Cancel</button>}</div>
        </form>

        <section className="service-list" aria-labelledby="existing-services">
          <div className="card-heading"><div><h2 id="existing-services">Existing services</h2><p>{services.length} services configured</p></div></div>
          {loading && <article className="card"><p>Loading services…</p></article>}
          {!loading && services.length === 0 && <article className="card empty-state"><h3>No services configured</h3><p>Create the first service using this form.</p></article>}
          {!loading && services.map((service) => (
            <article className="card service-list-item" key={service.id}>
              <div><div className="service-title-row"><h3>{service.name}</h3><span className={`badge badge-${service.priority === 'medium' ? 'med' : service.priority}`}>{service.priority}</span></div><p>{service.description}</p><span className="service-duration">Average visit: {service.expectedDuration} minutes</span></div>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => startEdit(service)}>Edit</button>
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}
