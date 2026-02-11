import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, UserPlus, UserMinus, Share2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { searchUsers, followUser, unfollowUser, isFollowing } from '../services/firestore'

export default function SearchPage() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [userResults, setUserResults] = useState([])
  const [followingMap, setFollowingMap] = useState({})
  const [loadingFollows, setLoadingFollows] = useState({})
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 2) {
        setUserResults([])
        setSearched(false)
        return
      }
      setSearching(true)
      setSearched(true)
      try {
        const results = await searchUsers(query)
        const filtered = results.filter(u => u.uid !== user.uid)
        setUserResults(filtered)
        const map = {}
        for (const u of filtered) {
          try {
            map[u.uid] = await isFollowing(user.uid, u.uid)
          } catch {
            map[u.uid] = false
          }
        }
        setFollowingMap(map)
      } catch (err) {
        console.error('Search failed:', err)
      }
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, user.uid])

  async function handleFollowToggle(targetUid) {
    setLoadingFollows(prev => ({ ...prev, [targetUid]: true }))
    try {
      if (followingMap[targetUid]) {
        await unfollowUser(user.uid, targetUid)
        setFollowingMap(prev => ({ ...prev, [targetUid]: false }))
      } else {
        await followUser(user.uid, targetUid)
        setFollowingMap(prev => ({ ...prev, [targetUid]: true }))
      }
    } catch (err) {
      console.error('Follow/unfollow failed:', err)
    }
    setLoadingFollows(prev => ({ ...prev, [targetUid]: false }))
  }

  async function handleInvite() {
    const inviteUrl = `${window.location.origin}?ref=${user.uid}`
    const shareData = {
      title: 'Join me on trusti!',
      text: 'I\'m using trusti to share restaurant recs with friends. Join me!',
      url: inviteUrl,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        if (err.name !== 'AbortError') {
          await copyToClipboard(inviteUrl)
        }
      }
    } else {
      await copyToClipboard(inviteUrl)
    }
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
      alert('Invite link copied to clipboard!')
    } catch {
      // Fallback for older browsers
      prompt('Copy this invite link:', text)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-4">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">Find People</h1>
        <button
          onClick={handleInvite}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          <Share2 size={14} />
          Invite Friends
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-4">Follow people to see their restaurant recommendations</p>

      {/* Search Input */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-3 rounded-xl bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          autoFocus
        />
      </div>

      {/* Results */}
      <div className="space-y-1">
        {searching && <p className="text-center text-gray-400 text-xs py-4">Searching...</p>}
        {!searching && searched && userResults.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No users found</p>
        )}
        {userResults.map(u => (
          <div key={u.uid} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white transition-colors">
            <Link to={`/user/${u.uid}`} className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-500 overflow-hidden shrink-0">
                {u.photoURL ? (
                  <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  u.displayName?.[0]?.toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{u.displayName}</p>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
              </div>
            </Link>
            <button
              onClick={() => handleFollowToggle(u.uid)}
              disabled={loadingFollows[u.uid]}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                followingMap[u.uid]
                  ? 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {followingMap[u.uid] ? 'Unfollow' : 'Follow'}
            </button>
          </div>
        ))}
        {!searching && !searched && (
          <p className="text-center text-gray-400 text-sm py-8">
            Type a name to search for people
          </p>
        )}
      </div>
    </div>
  )
}
