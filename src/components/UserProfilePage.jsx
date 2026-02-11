import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, UserPlus, UserMinus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  getUserProfile,
  getUserRecommendations,
  isFollowing,
  followUser,
  unfollowUser,
} from '../services/firestore'
import RecommendationCard from './RecommendationCard'

export default function UserProfilePage() {
  const { userId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [prof, recs, followStatus] = await Promise.all([
          getUserProfile(userId),
          getUserRecommendations(userId),
          isFollowing(user.uid, userId),
        ])
        setProfile(prof)
        setRecommendations(recs)
        setFollowing(followStatus)
      } catch (err) {
        console.error('Failed to load user profile:', err)
      }
      setLoading(false)
    }
    load()
  }, [userId, user.uid])

  async function handleFollowToggle() {
    setFollowLoading(true)
    try {
      if (following) {
        await unfollowUser(user.uid, userId)
        setFollowing(false)
        setProfile(prev => prev ? { ...prev, followersCount: (prev.followersCount || 1) - 1 } : prev)
      } else {
        await followUser(user.uid, userId)
        setFollowing(true)
        setProfile(prev => prev ? { ...prev, followersCount: (prev.followersCount || 0) + 1 } : prev)
      }
    } catch (err) {
      console.error('Follow/unfollow failed:', err)
    }
    setFollowLoading(false)
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-6 bg-gray-200 rounded" />
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-200" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto px-4 pt-4">
        <button onClick={() => navigate(-1)} className="text-gray-500 mb-4">
          <ArrowLeft size={20} />
        </button>
        <p className="text-center text-gray-400 py-12">User not found</p>
      </div>
    )
  }

  const isOwnProfile = userId === user.uid

  return (
    <div className="max-w-md mx-auto px-4 pt-4">
      {/* Back Button */}
      <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={20} />
      </button>

      {/* Profile Header */}
      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-500 overflow-hidden shrink-0">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
            ) : (
              profile.displayName?.[0]?.toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{profile.displayName}</h2>
            <p className="text-xs text-gray-400 truncate">{profile.email}</p>
          </div>
        </div>

        <div className="flex gap-6 mt-4 pt-4 border-t border-gray-100">
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{recommendations.length}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Recs</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{profile.followersCount || 0}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{profile.followingCount || 0}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Following</p>
          </div>
        </div>

        {!isOwnProfile && (
          <button
            onClick={handleFollowToggle}
            disabled={followLoading}
            className={`mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
              following
                ? 'text-gray-500 border border-gray-200 hover:text-red-500 hover:border-red-200'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {following ? (
              <>
                <UserMinus size={16} />
                Unfollow
              </>
            ) : (
              <>
                <UserPlus size={16} />
                Follow
              </>
            )}
          </button>
        )}
      </div>

      {/* Recommendations */}
      <h3 className="text-sm font-semibold text-gray-500 mb-3 px-1">Recommendations</h3>
      {recommendations.length > 0 ? (
        recommendations.map(rec => (
          <RecommendationCard key={rec.id} rec={rec} showUser={false} />
        ))
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">No recommendations yet.</p>
        </div>
      )}
    </div>
  )
}
