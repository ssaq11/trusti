import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Clock, Menu, X, Users, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getTrusti9, getFeedRecommendations, getDiscoverRecommendations, getBookmarks, backfillRecCoords, backfillBookmarkCoords } from '../services/firestore'
import MapView from './MapView'
import PlaceDetail from './PlaceDetail'
import AddRecommendation from './AddRecommendation'

export default function HomePage() {
  const { user } = useAuth()
  const [allRecs, setAllRecs] = useState([])
  const [allBookmarks, setAllBookmarks] = useState([])
  const [selectedPlace, setSelectedPlace] = useState(null) // place detail view
  const [showAdd, setShowAdd] = useState(null) // add recommendation modal
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'reviewed' | 'bookmarked'
  const [showRecent, setShowRecent] = useState(false)
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('trusti_recent_searches') || '[]') } catch { return [] }
  })
  const searchInputRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)

  function saveRecentSearch(keyword) {
    if (!keyword) return
    const updated = [keyword, ...recentSearches.filter(s => s !== keyword)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('trusti_recent_searches', JSON.stringify(updated))
  }

  // Load all recommendations to overlay on map
  const loadRecs = useCallback(async () => {
    try {
      const ids = await getTrusti9(user.uid)
      const allIds = [...ids, user.uid]
      const recs = await getFeedRecommendations(allIds)
      if (recs.length === 0) {
        const discoverRecs = await getDiscoverRecommendations()
        setAllRecs(discoverRecs)
      } else {
        setAllRecs(recs)
        // Backfill lat/lng for reviews missing coordinates (one-time fix)
        const needsBackfill = recs.filter(r => r.restaurantPlaceId && r.restaurantLat == null)
        if (needsBackfill.length > 0) {
          const updated = await backfillRecCoords(needsBackfill)
          if (updated > 0) {
            // Re-fetch to get updated coords
            const refreshed = await getFeedRecommendations(allIds)
            setAllRecs(refreshed)
          }
        }
      }
    } catch (err) {
      console.error('Failed to load recs:', err)
    }
  }, [user.uid])

  const loadBookmarks = useCallback(async () => {
    try {
      const bmarks = await getBookmarks(user.uid)
      setAllBookmarks(bmarks)
      // Backfill lat/lng for bookmarks missing coordinates (one-time fix)
      const needsBackfill = bmarks.filter(b => b.placeId && b.placeLat == null)
      if (needsBackfill.length > 0) {
        const updated = await backfillBookmarkCoords(needsBackfill)
        if (updated > 0) {
          const refreshed = await getBookmarks(user.uid)
          setAllBookmarks(refreshed)
        }
      }
    } catch (err) {
      console.error('Failed to load bookmarks:', err)
    }
  }, [user.uid])

  useEffect(() => {
    loadRecs()
    loadBookmarks()
  }, [loadRecs, loadBookmarks])

  // Re-fetch when page becomes visible again (e.g. after editing trusti 9)
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        loadRecs()
        loadBookmarks()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loadRecs, loadBookmarks])

  function handlePlaceSelect(place) {
    setSelectedPlace(place)
  }

  function handleAddReview(place) {
    setSelectedPlace(null)
    setShowAdd(place)
  }

  function handleSearch(e) {
    e.preventDefault()
    const keyword = searchInput.trim()
    if (!keyword) return
    setShowRecent(false)
    searchInputRef.current?.blur()
    saveRecentSearch(keyword)
    // Switch to "All" filter when searching so results aren't limited
    if (filter !== 'all') {
      setFilter('all')
    }
    // Force re-trigger even if keyword is the same by clearing first
    if (keyword === searchKeyword) {
      setSearchKeyword('')
      setTimeout(() => setSearchKeyword(keyword), 0)
    } else {
      setSearchKeyword(keyword)
    }
  }

  function selectRecentSearch(keyword) {
    setSearchInput(keyword)
    setShowRecent(false)
    searchInputRef.current?.blur()
    saveRecentSearch(keyword)
    if (filter !== 'all') setFilter('all')
    if (keyword === searchKeyword) {
      setSearchKeyword('')
      setTimeout(() => setSearchKeyword(keyword), 0)
    } else {
      setSearchKeyword(keyword)
    }
  }

  function clearSearch() {
    setSearchInput('')
    setSearchKeyword('')
    setShowRecent(false)
  }

  return (
    <div className="max-w-md mx-auto h-dvh flex flex-col relative">
      {/* Header - logo only */}
      <div className="px-4 pt-3 pb-1 shrink-0">
        <a href="/" className="flex items-baseline no-underline" style={{ fontFamily: "'Quicksand', sans-serif", fontWeight: 500, fontSize: "1.75rem", lineHeight: "0.8" }}>
          <span style={{color: "#4B8BBE"}}>trustı</span>
          <span style={{color: "#2ECC71"}}>.</span>
          <span style={{color: "#4B8BBE"}}>es</span>
        </a>
      </div>

      {/* Map + scrollable places list */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Search bar + hamburger + filter tabs floating over the map */}
        <div className="absolute top-2 left-0 right-0 z-10 px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMenuOpen(true)}
              className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white backdrop-blur-sm shrink-0"
            >
              <Menu size={18} />
            </button>
            <div className="relative w-[70%]">
              <form onSubmit={handleSearch} className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Find a place..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onFocus={() => { if (recentSearches.length > 0 && !searchInput) setShowRecent(true) }}
                  onBlur={() => setTimeout(() => setShowRecent(false), 150)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-700 border border-slate-500 text-white text-sm placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-xs"
                  >
                    Clear
                  </button>
                )}
              </form>
              {/* Recent searches dropdown */}
              {showRecent && recentSearches.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-lg overflow-hidden">
                  {recentSearches.map(s => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectRecentSearch(s)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-800 transition-colors"
                    >
                      <Clock size={14} className="text-slate-400 shrink-0" />
                      <span className="text-sm text-white truncate">{s}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Filter tabs */}
          <div className="flex gap-2 mt-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'reviewed', label: 'Trusti Reviews' },
              { key: 'bookmarked', label: 'Want to Go' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors backdrop-blur-sm ${
                  filter === tab.key
                    ? 'bg-green-600 text-white border border-green-600'
                    : 'bg-slate-800/90 text-slate-400 hover:bg-slate-700 border-2 border-green-600/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <MapView
          onPlaceSelect={handlePlaceSelect}
          onClearSearch={clearSearch}
          searchKeyword={searchKeyword}
          trustiRecs={allRecs}
          bookmarks={allBookmarks}
          filter={filter}
        />
      </div>

      {/* Slide-in side menu — scoped to app container */}
      {menuOpen && (
        <div className="absolute inset-0 z-50 flex overflow-hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          {/* Panel — positioned to start at the same top as hamburger button */}
          <div className="absolute left-0 z-50 w-[60%] max-w-[260px] bg-slate-900/85 backdrop-blur-sm shadow-xl rounded-b-xl animate-[slideIn_0.2s_ease-out]"
               style={{ top: 'calc(0.75rem + 1.4rem + 0.25rem + 0.5rem)' }}>
            <div className="flex items-center px-4 pt-3 pb-2">
              <button onClick={() => setMenuOpen(false)} className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white backdrop-blur-sm shrink-0">
                <X size={18} />
              </button>
            </div>
            <nav className="px-4 pb-4 space-y-1">
              <Link
                to="/search"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors no-underline"
              >
                <Users size={18} />
                trusti friends
              </Link>
              <Link
                to="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors no-underline"
              >
                <User size={18} />
                profile
              </Link>
            </nav>
          </div>
        </div>
      )}

      {/* Place detail modal */}
      {selectedPlace && (
        <PlaceDetail
          place={selectedPlace}
          reviews={allRecs.filter(r => r.restaurantPlaceId === selectedPlace.placeId)}
          onClose={() => setSelectedPlace(null)}
          onAddReview={handleAddReview}
          onBookmarkChange={loadBookmarks}
          onReviewChanged={loadRecs}
        />
      )}

      {/* Add recommendation modal */}
      {showAdd && (
        <AddRecommendation
          prefill={showAdd}
          onClose={() => setShowAdd(null)}
          onAdded={() => { setShowAdd(null); loadRecs() }}
        />
      )}
    </div>
  )
}
