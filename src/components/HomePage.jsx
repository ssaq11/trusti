import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Clock } from 'lucide-react'
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
    <div className="max-w-md mx-auto h-[calc(100dvh-64px)] flex flex-col">
      {/* Header - fixed */}
      <div className="px-4 pt-4 pb-2 shrink-0">
        <h1 className="text-2xl font-bold text-green-600 mb-3">trusti</h1>

        {/* Search bar */}
        <div className="relative mb-2">
          <form onSubmit={handleSearch} className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder='Try "tacos", "coffee", or a zip code...'
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onFocus={() => { if (recentSearches.length > 0 && !searchInput) setShowRecent(true) }}
              onBlur={() => setTimeout(() => setShowRecent(false), 150)}
              className="w-full pl-9 pr-16 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-xs"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-green-600 text-white text-xs rounded-lg"
            >
              Go
            </button>
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

        {/* Filter tabs */}
        <div className="flex gap-2 mb-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'reviewed', label: 'Trusti Reviews' },
            { key: 'bookmarked', label: 'Want to Go' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map + scrollable places list */}
      <div className="px-4 flex-1 flex flex-col min-h-0">
        <MapView
          onPlaceSelect={handlePlaceSelect}
          onClearSearch={clearSearch}
          searchKeyword={searchKeyword}
          trustiRecs={allRecs}
          bookmarks={allBookmarks}
          filter={filter}
        />
      </div>

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
