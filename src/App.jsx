// Re-trigger Vercel deployment
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './components/LoginPage'
import HomePage from './components/HomePage'
import SearchPage from './components/SearchPage'
import ProfilePage from './components/ProfilePage'
import UserProfilePage from './components/UserProfilePage'
import BottomNav from './components/BottomNav'
import WaitingPage from './components/WaitingPage'

function AppRoutes() {
  const { user, approved, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    )
  }

  // Logged in but not approved — show waiting screen
  if (user && !approved) {
    return (
      <Routes>
        <Route path="*" element={<WaitingPage />} />
      </Routes>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-16">
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/user/:userId" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
      </Routes>
      {user && <BottomNav />}
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  )
}
