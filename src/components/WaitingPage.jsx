import { useAuth } from '../contexts/AuthContext'

export default function WaitingPage() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-4xl font-bold text-green-600 mb-2">trusti</h1>
        <p className="text-gray-500 text-sm mb-8">Restaurant recs from people you trust</p>

        <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-50 flex items-center justify-center">
            <span className="text-3xl">&#9203;</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">You're on the list!</h2>
          <p className="text-sm text-gray-500 mb-1">
            trusti is invite-only right now.
          </p>
          <p className="text-sm text-gray-500">
            Ask a friend who's already on trusti to send you an invite link to get access.
          </p>
        </div>

        <p className="text-xs text-gray-400 mb-4">
          Signed in as {user?.email}
        </p>

        <button
          onClick={logout}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
