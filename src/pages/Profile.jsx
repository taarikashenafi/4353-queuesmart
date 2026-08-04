// User Profile page.
// Owner: Armaan — loads and saves the user's profile via the backend
// so profile data persists in the database across sessions.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPut } from '../api/client.js'

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('qs_user'))
  } catch {
    return null
  }
}

const NOTIFICATION_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'Text message' },
  { value: 'none', label: 'None' },
]

export default function Profile() {
  const user = getCurrentUser()
  const [form, setForm] = useState({ fullName: '', phone: '', notifications: 'email' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      try {
        const profile = await apiGet(`/profile/${user.id}`)
        if (cancelled) return
        setForm({
          fullName: profile.fullName || '',
          phone: profile.phone || '',
          notifications: profile.preferences?.notifications || 'email',
        })
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setError('')
    setSaved(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!form.fullName.trim()) {
      setError('Full name is required.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const profile = await apiPut(`/profile/${user.id}`, {
        fullName: form.fullName,
        phone: form.phone,
        preferences: { notifications: form.notifications },
      })
      setForm({
        fullName: profile.fullName,
        phone: profile.phone,
        notifications: profile.preferences?.notifications || 'email',
      })
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <section className="stack">
        <p className="muted">Please log in to view your profile.</p>
        <Link to="/login" className="btn btn-primary">Log in</Link>
      </section>
    )
  }

  return (
    <section className="stack">
      <div className="section-head">
        <span className="eyebrow">My profile</span>
        <h1>Profile settings</h1>
        <p className="muted">
          Update your contact details and how you want to hear about queue updates.
        </p>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}
      {saved && <p className="muted" role="status">Profile saved.</p>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <form className="card" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="profile-email">Email address</label>
            <input id="profile-email" className="input" value={user.email} disabled />
            <span className="hint">Your login email cannot be changed here.</span>
          </div>

          <div className="field">
            <label htmlFor="profile-name">Full name</label>
            <input
              id="profile-name"
              className="input"
              name="fullName"
              value={form.fullName}
              onChange={updateField}
              maxLength="100"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="profile-phone">Phone (optional)</label>
            <input
              id="profile-phone"
              className="input"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={updateField}
              maxLength="20"
            />
          </div>

          <div className="field">
            <label htmlFor="profile-notifications">Preferred notifications</label>
            <select
              id="profile-notifications"
              className="select"
              name="notifications"
              value={form.notifications}
              onChange={updateField}
            >
              {NOTIFICATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
