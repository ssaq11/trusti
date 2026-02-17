import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, UserPlus, UserMinus, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  getUserProfile,
  getUserRecommendations,
  isFollowing,
  followUser,
  unfollowUser,
  getTrusti9,
  addToTrusti9,
  removeFromTrusti9,
  getFollowingProfiles,
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
  const [trusti9Ids, setTrusti9Ids] = useState([])
  const [trusti9Loading, setTrusti9Loading] = useState(false)
  const [showSwapUI, setShowSwapUI] = useState(false)
  const [swapCandidates, setSwapCandidates] = useState([])

  useEffect(() => {
    async function load() {
      try {
        const [prof, recs, followStatus, t9] = await Promise.all([
          getUserProfile(userId),
          getUserRecommendations(userId),
          isFollowing(user.uid, userId),
          getTrusti9(user.uid),
        ])
        setProfile(prof)
        setRecommendations(recs)
        setFollowing(followStatus)
        setTrusti9Ids(t9)
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
        // Also remove from trusti9 if they're in it
        if (trusti9Ids.includes(userId)) {
          await removeFromTrusti9(user.uid, userId)
          setTrusti9Ids(prev => prev.filter(id => id !== userId))
        }
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

  async function handleAddToTrusti9() {
    setTrusti9Loading(true)
    try {
      const success = await addToTrusti9(user.uid, userId)
      if (success) {
        setTrusti9Ids(prev => [...prev, userId])
      } else {
        const fresh = await getTrusti9(user.uid)
        setTrusti9Ids(fresh)
      }
    } catch (err) {
      console.error('Add to trusti9 failed:', err)
    }
    setTrusti9Loading(false)
  }

  async function handleRemoveFromTrusti9() {
    setTrusti9Loading(true)
    try {
      await removeFromTrusti9(user.uid, userId)
      const fresh = await getTrusti9(user.uid)
      setTrusti9Ids(fresh)
    } catch (err) {
      console.error('Remove from trusti9 failed:', err)
    }
    setTrusti9Loading(false)
  }

  async function openSwapUI() {
    setTrusti9Loading(true)
    try {
      const profiles = await getFollowingProfiles(user.uid)
      const t9Set = new Set(trusti9Ids)
      setSwapCandidates(profiles.filter(p => t9Set.has(p.id)))
      setShowSwapUI(true)
    } catch (err) {
      console.error('Failed to load swap candidates:', err)
    }
    setTrusti9Loading(false)
  }

  async function handleSwap(removeId) {
    setTrusti9Loading(true)
    try {
      await removeFromTrusti9(user.uid, removeId)
      await addToTrusti9(user.uid, userId)
      const fresh = await getTrusti9(user.uid)
      setTrusti9Ids(fresh)
      setShowSwapUI(false)
    } catch (err) {
      console.error('Swap failed:', err)
    }
    setTrusti9Loading(false)
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-6 bg-slate-700 rounded" />
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

  if (!profile) {
    return (
      <div className="max-w-md mx-auto px-4 pt-4">
        <button onClick={() => navigate(-1)} className="text-slate-400 mb-4">
          <ArrowLeft size={20} />
        </button>
        <p className="text-center text-slate-400 py-12">User not found</p>
      </div>
    )
  }

  const isOwnProfile = userId === user.uid
  const isInTrusti9 = trusti9Ids.includes(userId)
  const trusti9Full = trusti9Ids.length >= 9

  return (
    <div className="max-w-md mx-auto px-4 pt-4">
      {/* Back Button */}
      <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white mb-4">
        <ArrowLeft size={20} />
      </button>

      {/* Profile Header */}
      <div className="bg-slate-800 rounded-2xl p-5 mb-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-xl font-bold text-slate-400 overflow-hidden shrink-0">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
            ) : (
              profile.displayName?.[0]?.toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{profile.displayName}</h2>
            <p className="text-xs text-slate-400 truncate">{profile.email}</p>
          </div>
        </div>

        <div className="flex gap-6 mt-4 pt-4 border-t border-slate-700">
          <div className="text-center">
            <p className="text-lg font-bold text-white">{recommendations.length}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Recs</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">{profile.followersCount || 0}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">{profile.followingCount || 0}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Following</p>
          </div>
        </div>

        {!isOwnProfile && (
          <>
            <button
              onClick={handleFollowToggle}
              disabled={followLoading}
              className={`mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                following
                  ? 'text-slate-400 border border-slate-700 hover:text-red-500 hover:border-red-800'
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

            {/* Trusti 9 management buttons */}
            {following && isInTrusti9 && (
              <button
                onClick={handleRemoveFromTrusti9}
                disabled={trusti9Loading}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 text-orange-400 border border-orange-800 hover:bg-orange-900/30"
              >
                Swap out of trusti 9
              </button>
            )}
            {following && !isInTrusti9 && !trusti9Full && (
              <button
                onClick={handleAddToTrusti9}
                disabled={trusti9Loading}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 text-green-400 border border-green-800 hover:bg-green-900/30"
              >
                Add to trusti 9
              </button>
            )}
            {following && !isInTrusti9 && trusti9Full && (
              <button
                onClick={openSwapUI}
                disabled={trusti9Loading}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 text-yellow-400 border border-yellow-800 hover:bg-yellow-900/30"
              >
                Swap into trusti 9
              </button>
            )}
          </>
        )}
      </div>

      {/* Recommendations */}
      <h3 className="text-sm font-semibold text-slate-400 mb-3 px-1">Recommendations</h3>
      {recommendations.length > 0 ? (
        recommendations.map(rec => (
          <RecommendationCard key={rec.id} rec={rec} showUser={false} />
        ))
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm">No recommendations yet.</p>
        </div>
      )}

      {/* Swap UI Bottom Sheet */}
      {showSwapUI && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowSwapUI(false)}
          />
          <div className="relative w-full max-w-md bg-slate-800 rounded-t-2xl p-5 pb-8 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">
                Swap someone out for {profile.displayName?.split(' ')[0]}
              </h3>
              <button
                onClick={() => setShowSwapUI(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {swapCandidates.map(candidate => (
                <button
                  key={candidate.id}
                  onClick={() => handleSwap(candidate.id)}
                  disabled={trusti9Loading}
                  className="bg-slate-700 rounded-xl p-3 flex flex-col items-center hover:bg-red-900/40 hover:ring-1 hover:ring-red-500 transition-all disabled:opacity-50"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center text-sm font-medium text-slate-400 overflow-hidden ring-2 ring-green-500 ring-offset-1 ring-offset-slate-700">
                    {candidate.photoURL ? (
                      <img src={candidate.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      candidate.displayName?.[0]?.toUpperCase()
                    )}
                  </div>
                  <p className="text-xs font-medium text-white truncate max-w-[80px] text-center mt-1.5">
                    {candidate.displayName?.split(' ')[0]}
                  </p>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowSwapUI(false)}
              className="mt-4 w-full py-2.5 text-sm text-slate-400 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
