import { Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'

// App shell: navbar on top, the active route in the middle, footer at the bottom.
// Every screen renders inside <Outlet />, so they all share this chrome.
export default function Layout() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <span>QueueSmart · COSC 4353 · Group 16</span>
          <span>Shell: routing · nav · shared mock data</span>
        </div>
      </footer>
    </>
  )
}
