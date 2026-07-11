import { Navigate, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Dashboard from './pages/Dashboard.jsx'
import JoinQueue from './pages/JoinQueue.jsx'
import QueueStatus from './pages/QueueStatus.jsx'
import History from './pages/History.jsx'
import NotFound from './pages/NotFound.jsx'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import ServiceManagement from './pages/admin/ServiceManagement.jsx'
import QueueManagement from './pages/admin/QueueManagement.jsx'
import { authRoutes } from './authRoutes.jsx'

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
      {authRoutes}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="join" element={<JoinQueue />} />
        <Route path="queue-status" element={<QueueStatus />} />
        <Route path="history" element={<History />} />
        {/* Administrator routes: dashboard, service setup, and live queue controls. */}
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="admin/services" element={<ServiceManagement />} />
        <Route path="admin/queues" element={<QueueManagement />} />
        {/* Other teammate routes go here. */}
        <Route path="home" element={<Home />} />
        {/* Teammate routes go here. */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
