import { useState, useEffect, useCallback } from 'react'
import { Search } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getFollowingIds, getFeedRecommendations, getDiscoverRecommendations, getBookmarks } from '../services/firestore'
import MapView from './MapView'
import PlaceDetail from './PlaceDetail'
import AddRecommendation from './AddRecommendation'

export default function HomePage() {
  const { user } = useAuth()
  const [allRecs, setAllRecs] = useState([])
  const [bookmarkedPlaceIds, setBookmarkedPlaceIds] = useState([])
  const [selectedPlace, setSelectedPlace] = useState(null) // place detail view
  const [showAdd, setShowAdd] = useState(null) // add recommendation modal
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Load all recommendations to overlay on map
  const loadRecs = useCallback(async () => {
    try {
      const ids = await getFollowingIds(user.uid)
      const allIds = [...ids, user.uid]
      const recs = await getFeedRecommendations(allIds)
      if (recs.length === 0) {
        const discoverRecs = await getDiscoverRecommendations()
        setAllRecs(discoverRecs)
      } else {
        setAllRecs(recs)
      }
    } catch (err) {
      console.error('Failed to load recs:', err)
    }
  }, [user.uid])

  const loadBookmarks = useCallback(async () => {
    try {
      const bookmarks = await getBookmarks(user.uid)
      setBookmarkedPlaceIds(bookmarks.map(b => b.placeId))
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
    setSearchKeyword(searchInput.trim())
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
        <form onSubmit={handleSearch} className="relative mb-1">
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
      </div>

      {/* Map + scrollable places list */}
      <div className="px-4 flex-1 flex flex-col min-h-0">
        <MapView
          onPlaceSelect={handlePlaceSelect}
          searchKeyword={searchKeyword}
          trustiRecs={allRecs}
          bookmarkedPlaceIds={bookmarkedPlaceIds}
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
