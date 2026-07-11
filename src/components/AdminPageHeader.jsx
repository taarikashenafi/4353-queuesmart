import { Link } from 'react-router-dom'

export default function AdminPageHeader({ eyebrow = 'Administrator', title, description, action }) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <Link className="btn btn-primary" to={action.to}>{action.label}</Link>}
    </header>
  )
}
