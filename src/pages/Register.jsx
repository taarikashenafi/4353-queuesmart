import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { emailTaken, mockUsers } from '../data/mockUsers.js'
import { validateConfirm, validateEmail, validatePassword } from '../utils/validation.js'
import './auth.css'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({ email: '', password: '', confirm: '' })

  function handleChange(event) {
    const { name, value } = event.target

    setForm((currentForm) => ({ ...currentForm, [name]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [name]: '' }))
  }

  function handleSubmit(event) {
    event.preventDefault()

    const emailIsTaken = emailTaken(form.email)
    const nextErrors = {
      email: validateEmail(form.email) || (emailIsTaken ? 'An account already uses this email.' : ''),
      password: validatePassword(form.password),
      confirm: validateConfirm(form.password, form.confirm),
    }

    setErrors(nextErrors)

    if (Object.values(nextErrors).some(Boolean)) return

    mockUsers.push({
      email: form.email.trim(),
      password: form.password,
      role: 'user',
    })
    navigate('/login')
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="register-title">
        <div className="auth-card-body">
          <Link className="auth-brand" to="/login" aria-label="QueueSmart login">
            Queue<span>Smart</span>
          </Link>

          <header className="auth-heading">
            <p className="auth-kicker">Campus queues, simplified</p>
            <h1 id="register-title">Create your account</h1>
            <p>Get into line without standing in it.</p>
          </header>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor="register-email">Email address</label>
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                className={errors.email ? 'auth-input auth-input-error' : 'auth-input'}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'register-email-error' : undefined}
              />
              {errors.email && <p id="register-email-error" className="auth-field-error">{errors.email}</p>}
            </div>

            <div className="auth-field">
              <label htmlFor="register-password">Password</label>
              <input
                id="register-password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                className={errors.password ? 'auth-input auth-input-error' : 'auth-input'}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'register-password-error' : undefined}
              />
              {errors.password && <p id="register-password-error" className="auth-field-error">{errors.password}</p>}
            </div>

            <div className="auth-field">
              <label htmlFor="register-confirm">Confirm password</label>
              <input
                id="register-confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                value={form.confirm}
                onChange={handleChange}
                className={errors.confirm ? 'auth-input auth-input-error' : 'auth-input'}
                aria-invalid={Boolean(errors.confirm)}
                aria-describedby={errors.confirm ? 'register-confirm-error' : undefined}
              />
              {errors.confirm && <p id="register-confirm-error" className="auth-field-error">{errors.confirm}</p>}
            </div>

            <button className="auth-submit" type="submit">Create account</button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </section>
    </main>
  )
}