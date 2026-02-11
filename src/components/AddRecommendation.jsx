import { useState, useEffect } from 'react'
import { X, Search, MapPin } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { addRecommendation } from '../services/firestore'
import { searchRestaurants, getPlaceDetails } from '../services/places'

const RATINGS = [
  { value: 'red', bg: 'bg-red-500', ring: 'ring-red-300', label: "Don't go" },
  { value: 'yellow', bg: 'bg-yellow-400', ring: 'ring-yellow-300', label: "It's okay" },
  { value: 'green', bg: 'bg-green-500', ring: 'ring-green-300', label: 'Must try!' },
]

export default function AddRecommendation({ onClose, onAdded, prefill }) {
  const { user } = useAuth()
  const [step, setStep] = useState(prefill ? 'rate' : 'search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  const [restaurantName, setRestaurantName] = useState(prefill?.name || '')
  const [restaurantAddress, setRestaurantAddress] = useState(prefill?.address || '')
  const [zipCode, setZipCode] = useState(prefill?.zipCode || '')
  const [placeId, setPlaceId] = useState(prefill?.placeId || null)

  // Fetch full details when prefilled from map (may lack address/zip)
  useEffect(() => {
    if (prefill?.placeId && !prefill?.zipCode) {
      getPlaceDetails(prefill.placeId).then(details => {
        if (details) {
          setRestaurantAddress(details.address)
          setZipCode(details.zipCode)
        }
      })
    }
  }, [prefill])
  const [rating, setRating] = useState(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  let searchTimer = null

  function handleSearchInput(value) {
    setSearchQuery(value)
    if (searchTimer) clearTimeout(searchTimer)
    if (value.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    searchTimer = setTimeout(async () => {
      const results = await searchRestaurants(value)
      setSearchResults(results)
      setSearching(false)
    }, 300)
  }

  async function selectPlace(result) {
    setRestaurantName(result.name)
    setRestaurantAddress(result.address)
    setPlaceId(result.placeId)

    // Fetch full details for zip code
    const details = await getPlaceDetails(result.placeId)
    if (details) {
      setRestaurantAddress(details.address)
      setZipCode(details.zipCode)
    }

    setStep('rate')
  }

  function useManualEntry() {
    setStep('manual')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!restaurantName.trim()) {
      setError('Please enter a restaurant name')
      return
    }
    if (!rating) {
      setError('Please select a rating (tap a color)')
      return
    }

    setLoading(true)
    try {
      await addRecommendation({
        userId: user.uid,
        userName: user.displayName || user.email.split('@')[0],
        userPhotoURL: user.photoURL || null,
        restaurantName: restaurantName.trim(),
        restaurantAddress: restaurantAddress.trim(),
        restaurantPlaceId: placeId,
        restaurantLat: null,
        restaurantLng: null,
        rating,
        comment: comment.trim(),
        zipCode: zipCode.trim() || null,
      })
      onAdded?.()
      onClose()
    } catch (err) {
      console.error('Failed to add recommendation:', err)
      setError('Failed to save: ' + (err.message || 'Unknown error'))
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - always visible */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {step === 'search' ? 'Find Restaurant' : 'Add Recommendation'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="px-5 overflow-y-auto flex-1 min-h-0">
          {/* Step 1: Search for restaurant */}
          {step === 'search' && (
            <div>
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search restaurants near you..."
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {searching && (
                <p className="text-center text-gray-400 text-xs py-4">Searching...</p>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-1 mb-3">
                  {searchResults.map(r => (
                    <button
                      key={r.placeId}
                      type="button"
                      onClick={() => selectPlace(r)}
                      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <MapPin size={16} className="text-green-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{r.name}</p>
                        <p className="text-xs text-gray-400 truncate">{r.address}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-6">No restaurants found</p>
              )}

              <div className="border-t border-gray-100 pt-3 mt-3">
                <button
                  type="button"
                  onClick={useManualEntry}
                  className="w-full py-2.5 text-sm text-green-600 font-medium hover:text-green-700"
                >
                  Enter restaurant manually instead
                </button>
              </div>
            </div>
          )}

          {/* Step 1b: Manual entry */}
          {step === 'manual' && (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Restaurant name *"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Address (optional)"
                value={restaurantAddress}
                onChange={(e) => setRestaurantAddress(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Zip code (optional)"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />

              <RatingPicker rating={rating} setRating={setRating} />

              <textarea
                placeholder="What did you think? (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />

              {error && <p className="text-red-500 text-xs text-center">{error}</p>}
            </div>
          )}

          {/* Step 2: Rate the selected restaurant */}
          {step === 'rate' && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 flex items-start gap-3">
                <MapPin size={16} className="text-green-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{restaurantName}</p>
                  {restaurantAddress && <p className="text-xs text-gray-400 truncate">{restaurantAddress}</p>}
                </div>
                {!prefill && (
                  <button type="button" onClick={() => setStep('search')} className="text-xs text-green-600 shrink-0">
                    Change
                  </button>
                )}
              </div>

              <RatingPicker rating={rating} setRating={setRating} />

              <textarea
                placeholder="What did you think? (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                autoFocus
                className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />

              {error && <p className="text-red-500 text-xs text-center">{error}</p>}
            </div>
          )}
        </div>

        {/* Submit button - always visible at bottom */}
        {(step === 'rate' || step === 'manual') && (
          <div className="px-5 py-4 border-t border-gray-100 shrink-0">
            <div className="flex gap-2">
              {step === 'manual' && (
                <button
                  type="button"
                  onClick={() => setStep('search')}
                  className="px-4 py-3 text-sm text-gray-500 font-medium rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
              >
                {loading ? 'Adding...' : 'Add Recommendation'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RatingPicker({ rating, setRating }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-3">Your rating *</p>
      <div className="flex gap-4 justify-center">
        {RATINGS.map(r => (
          <button
            key={r.value}
            type="button"
            onClick={() => setRating(r.value)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${
              rating === r.value
                ? `ring-2 ${r.ring} bg-gray-50 scale-110`
                : 'hover:bg-gray-50'
            }`}
          >
            <div className={`w-10 h-10 rounded-full ${r.bg} ${
              rating === r.value ? 'shadow-lg' : 'opacity-60'
            } transition-all`} />
            <span className={`text-[11px] font-medium ${
              rating === r.value ? 'text-gray-900' : 'text-gray-400'
            }`}>{r.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
