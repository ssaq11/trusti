import { useState, useEffect } from 'react'
import { X, MapPin, Plus, Bookmark } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isBookmarked, addBookmark, removeBookmark } from '../services/firestore'

const RATING_CONFIG = {
  red: { bg: 'bg-red-500', label: "Don't go", textColor: 'text-red-600' },
  yellow: { bg: 'bg-yellow-400', label: "It's okay", textColor: 'text-yellow-600' },
  green: { bg: 'bg-green-500', label: 'Must try!', textColor: 'text-green-600' },
}

export default function PlaceDetail({ place, reviews, onClose, onAddReview, onBookmarkChange }) {
  const { user } = useAuth()
  const [bookmarked, setBookmarked] = useState(false)
  const [bookmarkLoading, setBookmarkLoading] = useState(false)

  useEffect(() => {
    if (user?.uid && place?.placeId) {
      isBookmarked(user.uid, place.placeId).then(setBookmarked)
    }
  }, [user?.uid, place?.placeId])

  async function toggleBookmark() {
    if (bookmarkLoading) return
    setBookmarkLoading(true)
    try {
      if (bookmarked) {
        await removeBookmark(user.uid, place.placeId)
        setBookmarked(false)
      } else {
        await addBookmark(user.uid, place)
        setBookmarked(true)
      }
      onBookmarkChange?.()
    } catch (err) {
      console.error('Bookmark error:', err)
    }
    setBookmarkLoading(false)
  }

  // Group reviews by rating
  const counts = { green: 0, yellow: 0, red: 0 }
  reviews.forEach(r => { if (counts[r.rating] !== undefined) counts[r.rating]++ })
  const totalReviews = reviews.length

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85dvh] mb-16 sm:mb-0 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-3">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900">{place.name}</h2>
              {place.address && (
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                  <MapPin size={12} />
                  {place.address}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={toggleBookmark}
                disabled={bookmarkLoading}
                className={`p-1.5 rounded-lg transition-colors ${
                  bookmarked
                    ? 'text-purple-500 bg-purple-50'
                    : 'text-gray-300 hover:text-purple-400 hover:bg-purple-50'
                }`}
                title={bookmarked ? 'Remove from Want to go' : 'Want to go'}
              >
                <Bookmark size={20} fill={bookmarked ? 'currentColor' : 'none'} />
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Stoplight summary */}
          {totalReviews > 0 && (
            <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-3 mb-3">
              <div className="flex items-center gap-2">
                {['green', 'yellow', 'red'].map(color => {
                  if (counts[color] === 0) return null
                  return (
                    <div key={color} className="flex items-center gap-1">
                      <div className={`w-6 h-6 rounded-full ${RATING_CONFIG[color].bg} flex items-center justify-center`}>
                        {counts[color] > 1 && (
                          <span className="text-white text-[10px] font-bold">{counts[color]}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-gray-500">
                {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'} from your network
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => onAddReview(place)}
              className="flex-1 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Add Review
            </button>
            <button
              onClick={toggleBookmark}
              disabled={bookmarkLoading}
              className={`px-4 py-2.5 font-medium rounded-lg transition-colors text-sm flex items-center gap-2 ${
                bookmarked
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-purple-50 hover:text-purple-600'
              }`}
            >
              <Bookmark size={16} fill={bookmarked ? 'currentColor' : 'none'} />
              {bookmarked ? 'Saved' : 'Want to go'}
            </button>
          </div>
        </div>

        {/* Reviews list */}
        {totalReviews > 0 && (
          <div className="border-t border-gray-100">
            <p className="px-5 pt-3 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Reviews
            </p>
            <div className="px-5 pb-5 space-y-3">
              {reviews.map(rec => {
                const rating = RATING_CONFIG[rec.rating]
                const timeAgo = rec.createdAt?.seconds
                  ? getTimeAgo(rec.createdAt.seconds * 1000)
                  : ''

                return (
                  <div key={rec.id} className="flex items-start gap-3">
                    <div className={`mt-0.5 w-4 h-4 rounded-full ${rating.bg} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/user/${rec.userId}`}
                          className="flex items-center gap-1.5 group"
                          onClick={onClose}
                        >
                          <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-500 overflow-hidden">
                            {rec.userPhotoURL ? (
                              <img src={rec.userPhotoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              rec.userName?.[0]?.toUpperCase()
                            )}
                          </div>
                          <span className="text-xs font-medium text-gray-700 group-hover:text-green-600">
                            {rec.userName}
                          </span>
                        </Link>
                        <span className={`text-[10px] font-medium ${rating.textColor}`}>
                          {rating.label}
                        </span>
                        {timeAgo && <span className="text-[10px] text-gray-300">{timeAgo}</span>}
                      </div>
                      {rec.comment && (
                        <p className="text-sm text-gray-600 mt-1 leading-relaxed">{rec.comment}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {totalReviews === 0 && (
          <div className="px-5 pb-5 pt-2">
            <p className="text-center text-gray-400 text-xs">
              No one in your network has reviewed this place yet. Be the first!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  return `${weeks}w`
}
