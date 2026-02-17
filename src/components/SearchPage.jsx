import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Share2, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  searchUsers, followUser, unfollowUser, isFollowing,
  getFollowingProfiles, getTrusti9
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
  const [showFriends, setShowFriends] = useState(true)
  const [friendsFilter, setFriendsFilter] = useState('')

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
      await unfollowUser(user.uid, targetUid)
      setFollowingMap(prev => ({ ...prev, [targetUid]: false }))
      await loadData()
    } catch (err) {
      console.error('Unfollow failed:', err)
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

  // Split friends into trusti9 and others
  const trusti9Set = new Set(trusti9Ids)
  const trusti9Friends = friends.filter(f => trusti9Set.has(f.id))
  const contactFriends = friends.filter(f => !trusti9Set.has(f.id))
  const friendIds = new Set(friends.map(f => f.id))
  const filteredResults = userResults.filter(u => !friendIds.has(u.uid))

  // Filter "all trusti friends" by local search
  const filteredContactFriends = friendsFilter
    ? contactFriends.filter(f =>
        f.displayName?.toLowerCase().includes(friendsFilter.toLowerCase())
      )
    : contactFriends

  // Build ordered trusti 9 grid: filled slots in order, then empties to fill 9
  const emptySlots = 9 - trusti9Friends.length

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link to="/" className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-white">trusti friends</h1>
        </div>
        <button
          onClick={handleInvite}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          <Share2 size={14} />
          Invite
        </button>
      </div>

      {/* Section 1: My Trusti 9 — fixed 3x3 grid */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            my trusti 9
          </h2>
          <span className="text-xs text-slate-400">{trusti9Friends.length}/9</span>
        </div>

        {loadingFriends ? (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
              <div key={i} className="bg-slate-800 rounded-xl p-3 animate-pulse flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-slate-700" />
                <div className="h-3 bg-slate-700 rounded w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {trusti9Friends.map(friend => (
              <Link
                key={friend.id}
                to={`/user/${friend.id}`}
                className="bg-slate-800 rounded-xl p-3 flex flex-col items-center"
              >
                <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-sm font-medium text-slate-400 overflow-hidden ring-2 ring-green-500 ring-offset-1 ring-offset-slate-800">
                  {friend.photoURL ? (
                    <img src={friend.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    friend.displayName?.[0]?.toUpperCase()
                  )}
                </div>
                <p className="text-xs font-medium text-white truncate max-w-[80px] text-center mt-1.5">
                  {friend.displayName?.split(' ')[0]}
                </p>
              </Link>
            ))}
            {/* Empty slots to always show 9 total */}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="border-2 border-dashed border-slate-700 rounded-xl p-3 flex flex-col items-center"
              >
                <div className="w-12 h-12 rounded-full bg-slate-800/50" />
                <p className="text-xs text-slate-600 mt-1.5">&nbsp;</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: All Trusti Friends — collapsible with filter */}
      <div className="mb-5">
        <button
          onClick={() => setShowFriends(!showFriends)}
          className="flex items-center justify-between w-full mb-2"
        >
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            all trusti friends {contactFriends.length > 0 && `(${contactFriends.length})`}
          </h2>
          {showFriends ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </button>

        {showFriends && (
          <div>
            {contactFriends.length > 3 && (
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter friends..."
                  value={friendsFilter}
                  onChange={(e) => setFriendsFilter(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            )}
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {filteredContactFriends.length === 0 && !loadingFriends && (
                <p className="text-xs text-slate-400 text-center py-3">
                  {friendsFilter ? 'No matching friends' : 'No friends outside your trusti 9. Search below to add people!'}
                </p>
              )}
              {filteredContactFriends.map(friend => (
                <Link
                  key={friend.id}
                  to={`/user/${friend.id}`}
                  className="flex items-center gap-3 p-2.5 bg-slate-800 rounded-xl"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-400 overflow-hidden shrink-0">
                    {friend.photoURL ? (
                      <img src={friend.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      friend.displayName?.[0]?.toUpperCase()
                    )}
                  </div>
                  <p className="text-sm text-white truncate">{friend.displayName}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Find People */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">find people</h2>
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
