import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { findUser } from '../data/mockUsers.js'
import { validateEmail, validatePassword } from '../utils/validation.js'
import './auth.css'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({ email: '', password: '' })
  const [authError, setAuthError] = useState('')

  function handleChange(event) {
    const { name, value } = event.target

    setForm((currentForm) => ({ ...currentForm, [name]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [name]: '' }))
    setAuthError('')
  }

  function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = {
      email: validateEmail(form.email),
      password: validatePassword(form.password),
    }

    setErrors(nextErrors)
    setAuthError('')

    if (Object.values(nextErrors).some(Boolean)) return

    const user = findUser(form.email, form.password)

    if (!user) {
      setAuthError('Invalid email or password.')
      return
    }

    localStorage.setItem('qs_user', JSON.stringify(user))
    navigate(user.role === 'admin' ? '/admin' : '/dashboard')
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-card-body">
          <Link className="auth-brand" to="/login" aria-label="QueueSmart login">
            Queue<span>Smart</span>
          </Link>

          <header className="auth-heading">
            <p className="auth-kicker">Campus queues, simplified</p>
            <h1 id="login-title">Welcome back</h1>
            <p>Sign in to see where you are in line.</p>
          </header>

          {authError && (
            <p className="auth-banner" role="alert">
              {authError}
            </p>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                className={errors.email ? 'auth-input auth-input-error' : 'auth-input'}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
              />
              {errors.email && <p id="login-email-error" className="auth-field-error">{errors.email}</p>}
            </div>

            <div className="auth-field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={handleChange}
                className={errors.password ? 'auth-input auth-input-error' : 'auth-input'}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'login-password-error' : undefined}
              />
              {errors.password && <p id="login-password-error" className="auth-field-error">{errors.password}</p>}
            </div>

            <button className="auth-submit" type="submit">Log in</button>
          </form>

          <p className="auth-switch">
            New to QueueSmart? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </section>
    </main>
  )
}