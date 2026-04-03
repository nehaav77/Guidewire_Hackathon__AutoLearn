import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { sessionStore } from './api'
import LandingPage from './pages/LandingPage'
import Onboarding from './pages/Onboarding'
import WorkerDashboard from './pages/WorkerDashboard'
import InsurerDashboard from './pages/InsurerDashboard'
import './index.css'

function App() {
  const session = sessionStore.get()

  return (
    <BrowserRouter>
      <Routes>
        {/* Landing / Login — redirect if already logged in */}
        <Route path="/" element={
          session
            ? session.role === 'insurer'
              ? <Navigate to="/insurer" replace />
              : (session as any).has_active_policy
                ? <Navigate to="/dashboard" replace />
                : <Navigate to="/onboarding" replace />
            : <LandingPage />
        } />

        {/* Rider onboarding — only accessible to riders */}
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Rider dashboard — only accessible to riders */}
        <Route path="/dashboard" element={
          session?.role === 'insurer'
            ? <Navigate to="/insurer" replace />
            : <WorkerDashboard />
        } />

        {/* Insurer dashboard — only accessible to insurers */}
        <Route path="/insurer" element={
          session?.role === 'rider'
            ? <Navigate to="/dashboard" replace />
            : <InsurerDashboard />
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
