import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getUserProfile, getUserRecommendations, deleteRecommendation } from '../services/firestore'
import RecommendationCard from './RecommendationCard'

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const [profile, setProfile] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [prof, recs] = await Promise.all([
          getUserProfile(user.uid),
          getUserRecommendations(user.uid),
        ])
        setProfile(prof)
        setRecommendations(recs)
      } catch (err) {
        console.error('Failed to load profile:', err)
      }
      setLoading(false)
    }
    load()
  }, [user.uid])

  async function handleDelete(recId) {
    try {
      await deleteRecommendation(recId)
      setRecommendations(prev => prev.filter(r => r.id !== recId))
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-700" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-slate-700 rounded w-1/2" />
              <div className="h-3 bg-slate-600 rounded w-3/4" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-4">
      {/* Back arrow */}
      <Link to="/" className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors mb-3">
        <ArrowLeft size={20} />
        <span className="text-sm">Back</span>
      </Link>

      {/* Profile Header */}
      <div className="bg-slate-800 rounded-2xl p-5 mb-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-xl font-bold text-slate-400 overflow-hidden shrink-0">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
            ) : (
              (user.displayName || user.email)?.[0]?.toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate">
              {user.displayName || user.email?.split('@')[0]}
            </h2>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
        </div>

        <div className="flex gap-6 mt-4 pt-4 border-t border-slate-700">
          <div className="text-center">
            <p className="text-lg font-bold text-white">{recommendations.length}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Recs</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">{profile?.followersCount || 0}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">{profile?.followingCount || 0}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Following</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-sm text-slate-400 hover:text-red-500 border border-slate-700 rounded-lg hover:border-red-800 transition-colors"
        >
          <LogOut size={16} />
          Log out
        </button>
      </div>

      {/* Recommendations */}
      <h3 className="text-sm font-semibold text-slate-400 mb-3 px-1">Your Recommendations</h3>
      {recommendations.length > 0 ? (
        recommendations.map(rec => (
          <RecommendationCard
            key={rec.id}
            rec={rec}
            showUser={false}
            onDelete={handleDelete}
          />
        ))
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm">You haven't made any recommendations yet.</p>
        </div>
      )}
    </div>
  )
}
