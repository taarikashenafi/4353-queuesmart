import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import NotFound from './pages/NotFound.jsx'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import ServiceManagement from './pages/admin/ServiceManagement.jsx'
import QueueManagement from './pages/admin/QueueManagement.jsx'

/*
 * QueueSmart route table — owner: Armaan (routing).
 * Only shared routes live here: the landing page and the 404 catch-all.
 * Teammates add their own screen + <Route> where marked below. Everything is
 * nested inside <Layout /> so every screen inherits the navbar + shell.
 *
 *   Auth  (Login, Register)                             -> e.g. <Route path="login" element={<Login />} />
 *   User  (Dashboard, Join Queue, Queue Status, History)
 *   Admin (Dashboard, Service Management, Queue Management)
 */
function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        {/* Administrator routes: dashboard, service setup, and live queue controls. */}
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="admin/services" element={<ServiceManagement />} />
        <Route path="admin/queues" element={<QueueManagement />} />
        {/* Other teammate routes go here. */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
