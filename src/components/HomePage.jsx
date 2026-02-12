import { useState, useEffect, useCallback } from 'react'
import { Search } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getTrusti9, getFeedRecommendations, getDiscoverRecommendations, getBookmarks, backfillRecCoords } from '../services/firestore'
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
    // Force re-trigger even if keyword is the same by clearing first
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
  }

  return (
    <div className="max-w-md mx-auto h-[calc(100dvh-64px)] flex flex-col">
      {/* Header - fixed */}
      <div className="px-4 pt-4 pb-2 shrink-0">
        <h1 className="text-2xl font-bold text-green-600 mb-3">trusti</h1>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="relative mb-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder='Try "tacos", "coffee", or a zip code...'
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-16 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
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
