import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Share2, X, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  searchUsers, followUser, unfollowUser, isFollowing,
  getFollowingProfiles, getTrusti9, addToTrusti9, removeFromTrusti9
} from '../services/firestore'

export default function SearchPage() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [userResults, setUserResults] = useState([])
  const [followingMap, setFollowingMap] = useState({})
  const [loadingActions, setLoadingActions] = useState({})
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [friends, setFriends] = useState([])
  const [trusti9Ids, setTrusti9Ids] = useState([])
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [showContacts, setShowContacts] = useState(false)

  // Load friends and trusti9
  const loadData = useCallback(async () => {
    setLoadingFriends(true)
    try {
      const [profiles, t9] = await Promise.all([
        getFollowingProfiles(user.uid),
        getTrusti9(user.uid)
      ])
      setFriends(profiles)
      setTrusti9Ids(t9)
    } catch (err) {
      console.error('Failed to load data:', err)
    }
    setLoadingFriends(false)
  }, [user.uid])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Search for users
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

  async function handleAddContact(targetUid) {
    setLoadingActions(prev => ({ ...prev, [targetUid]: true }))
    try {
      await followUser(user.uid, targetUid)
      setFollowingMap(prev => ({ ...prev, [targetUid]: true }))
      await loadData()
    } catch (err) {
      console.error('Follow failed:', err)
    }
    setLoadingActions(prev => ({ ...prev, [targetUid]: false }))
  }

  async function handleRemoveContact(targetUid) {
    setLoadingActions(prev => ({ ...prev, [targetUid]: true }))
    try {
      // Also remove from trusti9 if they're in it
      if (trusti9Ids.includes(targetUid)) {
        await removeFromTrusti9(user.uid, targetUid)
      }
      await unfollowUser(user.uid, targetUid)
      setFollowingMap(prev => ({ ...prev, [targetUid]: false }))
      await loadData()
    } catch (err) {
      console.error('Unfollow failed:', err)
    }
    setLoadingActions(prev => ({ ...prev, [targetUid]: false }))
  }

  async function handlePromoteToTrusti9(targetUid) {
    if (trusti9Ids.length >= 9) return
    setLoadingActions(prev => ({ ...prev, [targetUid]: true }))
    try {
      await addToTrusti9(user.uid, targetUid)
      setTrusti9Ids(prev => [...prev, targetUid])
    } catch (err) {
      console.error('Add to trusti9 failed:', err)
    }
    setLoadingActions(prev => ({ ...prev, [targetUid]: false }))
  }

  async function handleDemoteFromTrusti9(targetUid) {
    setLoadingActions(prev => ({ ...prev, [targetUid]: true }))
    try {
      await removeFromTrusti9(user.uid, targetUid)
      setTrusti9Ids(prev => prev.filter(id => id !== targetUid))
    } catch (err) {
      console.error('Remove from trusti9 failed:', err)
    }
    setLoadingActions(prev => ({ ...prev, [targetUid]: false }))
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
      prompt('Copy this invite link:', text)
    }
  }

  // Split friends into trusti9 and contacts
  const trusti9Set = new Set(trusti9Ids)
  const trusti9Friends = friends.filter(f => trusti9Set.has(f.id))
  const contactFriends = friends.filter(f => !trusti9Set.has(f.id))
  const friendIds = new Set(friends.map(f => f.id))
  const filteredResults = userResults.filter(u => !friendIds.has(u.uid))
  const emptySlots = 9 - trusti9Friends.length

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-20">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">People</h1>
        <button
          onClick={handleInvite}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          <Share2 size={14} />
          Invite
        </button>
      </div>

      {/* Trusti 9 */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            My Trusti 9
          </h2>
          <span className="text-xs text-slate-400">{trusti9Friends.length}/9</span>
        </div>

        {loadingFriends ? (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-slate-800 rounded-xl p-3 animate-pulse flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-slate-700" />
                <div className="h-3 bg-slate-700 rounded w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {trusti9Friends.map(friend => (
              <div key={friend.id} className="bg-slate-800 rounded-xl p-3 flex flex-col items-center relative group">
                <button
                  onClick={() => handleDemoteFromTrusti9(friend.id)}
                  disabled={loadingActions[friend.id]}
                  className="absolute top-1.5 right-1.5 p-1 text-slate-400 hover:text-red-500 hover:bg-slate-700 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                  title="Move back to contacts"
                >
                  <X size={12} />
                </button>
                <Link to={`/user/${friend.id}`} className="flex flex-col items-center gap-1.5">
                  <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-sm font-medium text-slate-400 overflow-hidden ring-2 ring-green-500 ring-offset-1 ring-offset-slate-800">
                    {friend.photoURL ? (
                      <img src={friend.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      friend.displayName?.[0]?.toUpperCase()
                    )}
                  </div>
                  <p className="text-xs font-medium text-white truncate max-w-[80px] text-center">
                    {friend.displayName?.split(' ')[0]}
                  </p>
                </Link>
              </div>
            ))}
            {/* Empty slots */}
            {emptySlots > 0 && (
              <button
                onClick={() => setShowContacts(true)}
                className="bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-xl p-3 flex flex-col items-center gap-1.5 hover:border-green-500 hover:bg-slate-700/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center">
                  <Plus size={20} className="text-slate-400" />
                </div>
                <p className="text-xs text-slate-400">Add</p>
              </button>
            )}
          </div>
        )}

        {!loadingFriends && trusti9Friends.length === 0 && (
          <p className="text-xs text-slate-400 mt-2 text-center">
            Add up to 9 trusted people whose restaurant reviews you'll see
          </p>
        )}
      </div>

      {/* Contacts (collapsible) */}
      <div className="mb-5">
        <button
          onClick={() => setShowContacts(!showContacts)}
          className="flex items-center justify-between w-full mb-2"
        >
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Contacts {contactFriends.length > 0 && `(${contactFriends.length})`}
          </h2>
          {showContacts ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </button>

        {showContacts && (
          <div className="space-y-1">
            {contactFriends.length === 0 && !loadingFriends && (
              <p className="text-xs text-slate-400 text-center py-3">
                No contacts outside your Trusti 9. Search below to add people!
              </p>
            )}
            {contactFriends.map(friend => (
              <div key={friend.id} className="flex items-center gap-3 p-2.5 bg-slate-800 rounded-xl">
                <Link to={`/user/${friend.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-400 overflow-hidden shrink-0">
                    {friend.photoURL ? (
                      <img src={friend.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      friend.displayName?.[0]?.toUpperCase()
                    )}
                  </div>
                  <p className="text-sm text-white truncate">{friend.displayName}</p>
                </Link>
                <div className="flex items-center gap-1 shrink-0">
                  {trusti9Ids.length < 9 && (
                    <button
                      onClick={() => handlePromoteToTrusti9(friend.id)}
                      disabled={loadingActions[friend.id]}
                      className="px-2 py-1 text-xs font-medium text-green-500 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      + Trusti
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveContact(friend.id)}
                    disabled={loadingActions[friend.id]}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                    title="Remove contact"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search to add contacts */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Find People</h2>
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div className="space-y-1">
          {searching && <p className="text-center text-slate-400 text-xs py-4">Searching...</p>}
          {!searching && searched && filteredResults.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-4">No new people found</p>
          )}
          {filteredResults.map(u => (
            <div key={u.uid} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800 transition-colors">
              <Link to={`/user/${u.uid}`} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-400 overflow-hidden shrink-0">
                  {u.photoURL ? (
                    <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    u.displayName?.[0]?.toUpperCase()
                  )}
                </div>
                <p className="text-sm text-white truncate">{u.displayName}</p>
              </Link>
              <button
                onClick={() => followingMap[u.uid] ? handleRemoveContact(u.uid) : handleAddContact(u.uid)}
                disabled={loadingActions[u.uid]}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                  followingMap[u.uid]
                    ? 'bg-slate-700 text-slate-400 hover:bg-red-900 hover:text-red-500'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {followingMap[u.uid] ? 'Remove' : '+ Add'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
