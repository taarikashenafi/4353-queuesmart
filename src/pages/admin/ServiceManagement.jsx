import { useState } from 'react'
import AdminPageHeader from '../../components/AdminPageHeader.jsx'
import { PRIORITY_LEVELS, services as initialServices } from '../../data/mockData.js'

const emptyForm = { name: '', description: '', expectedDurationMin: '', priority: 'medium' }

export default function ServiceManagement() {
  // Keep service changes in memory while the user manages this page
  const [services, setServices] = useState(initialServices)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')

  function validate() {
    // Validate required fields and accepted input limits before saving
    const next = {}
    if (!form.name.trim()) next.name = 'Service name is required.'
    else if (form.name.trim().length > 100) next.name = 'Service name must be 100 characters or fewer.'
    if (!form.description.trim()) next.description = 'Description is required.'
    const duration = Number(form.expectedDurationMin)
    if (!form.expectedDurationMin) next.expectedDurationMin = 'Expected duration is required.'
    else if (!Number.isInteger(duration) || duration < 1 || duration > 480) next.expectedDurationMin = 'Enter a whole number from 1 to 480.'
    if (!PRIORITY_LEVELS.includes(form.priority)) next.priority = 'Select a valid priority.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function submit(event) {
    event.preventDefault()
    if (!validate()) return
    const normalized = { ...form, name: form.name.trim(), description: form.description.trim(), expectedDurationMin: Number(form.expectedDurationMin) }
    if (editingId) {
      setServices((current) => current.map((service) => service.id === editingId ? { ...service, ...normalized } : service))
      setNotice(`${normalized.name} updated.`)
    } else {
      setServices((current) => [...current, { ...normalized, id: `s${Date.now()}`, isOpen: false }])
      setNotice(`${normalized.name} created as a closed queue.`)
    }
    cancelEdit()
  }

  function startEdit(service) {
    // Reuse the same form for both creating and editing a service
    setEditingId(service.id)
    setForm({ name: service.name, description: service.description, expectedDurationMin: String(service.expectedDurationMin), priority: service.priority })
    setErrors({})
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
  }

  return (
    <div className="admin-page">
      <AdminPageHeader title="Service management" description="Create services and define the duration and priority used by QueueSmart's wait estimates." />
      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div>}

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
            <textarea id="service-description" className={`textarea ${errors.description ? 'input-error' : ''}`} name="description" value={form.description} onChange={updateField} rows="4" required />
            {errors.description && <span className="error-text">{errors.description}</span>}
          </div>
          <div className="form-row">
            <div className="field">
              <label className="label" htmlFor="duration">Expected duration (minutes) <span aria-hidden="true">*</span></label>
              <input id="duration" className={`input ${errors.expectedDurationMin ? 'input-error' : ''}`} type="number" name="expectedDurationMin" value={form.expectedDurationMin} onChange={updateField} min="1" max="480" step="1" required />
              {errors.expectedDurationMin && <span className="error-text">{errors.expectedDurationMin}</span>}
            </div>
            <div className="field">
              <label className="label" htmlFor="priority">Priority level <span aria-hidden="true">*</span></label>
              <select id="priority" className="select" name="priority" value={form.priority} onChange={updateField} required>
                {PRIORITY_LEVELS.map((level) => <option key={level} value={level}>{level[0].toUpperCase() + level.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-actions"><button className="btn btn-primary" type="submit">{editingId ? 'Save changes' : 'Create service'}</button>{editingId && <button className="btn btn-ghost" type="button" onClick={cancelEdit}>Cancel</button>}</div>
        </form>

        <section className="service-list" aria-labelledby="existing-services">
          <div className="card-heading"><div><h2 id="existing-services">Existing services</h2><p>{services.length} services configured</p></div></div>
          {services.map((service) => (
            <article className="card service-list-item" key={service.id}>
              <div><div className="service-title-row"><h3>{service.name}</h3><span className={`badge badge-${service.priority === 'medium' ? 'med' : service.priority}`}>{service.priority}</span></div><p>{service.description}</p><span className="service-duration">Average visit: {service.expectedDurationMin} minutes</span></div>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => startEdit(service)}>Edit</button>
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}
