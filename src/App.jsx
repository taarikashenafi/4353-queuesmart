import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Dashboard from './pages/Dashboard.jsx'
import JoinQueue from './pages/JoinQueue.jsx'
import QueueStatus from './pages/QueueStatus.jsx'
import History from './pages/History.jsx'
import NotFound from './pages/NotFound.jsx'

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
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="join" element={<JoinQueue />} />
        <Route path="queue-status" element={<QueueStatus />} />
        <Route path="history" element={<History />} />
        {/* Teammate routes go here. */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
