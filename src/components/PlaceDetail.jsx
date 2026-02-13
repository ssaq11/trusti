import { useState, useEffect } from 'react'
import { X, MapPin, Plus, Bookmark, Pencil, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isBookmarked, addBookmark, removeBookmark, deleteRecommendation, updateRecommendation } from '../services/firestore'
import { getDeduplicatedCounts } from '../utils/ratings'

const RATING_CONFIG = {
  red: { bg: 'bg-red-500', label: "Don't go", textColor: 'text-red-600' },
  yellow: { bg: 'bg-yellow-400', label: "It's okay", textColor: 'text-yellow-600' },
  green: { bg: 'bg-green-500', label: 'Must try!', textColor: 'text-green-600' },
}

export default function PlaceDetail({ place, reviews, onClose, onAddReview, onBookmarkChange, onReviewChanged }) {
  const { user } = useAuth()
  const [bookmarked, setBookmarked] = useState(false)
  const [bookmarkLoading, setBookmarkLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editComment, setEditComment] = useState('')
  const [editRating, setEditRating] = useState(null)
  const [saving, setSaving] = useState(false)

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

  // Group reviews by rating (one vote per user for the summary)
  const counts = getDeduplicatedCounts(reviews)
  const totalVoters = counts.green + counts.yellow + counts.red
  const totalReviews = reviews.length

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-slate-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85dvh] mb-16 sm:mb-0 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-3">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white">{place.name}</h2>
              {place.address && (
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
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
            <div className="flex items-center gap-4 bg-slate-800 rounded-xl p-3 mb-3">
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
              <p className="text-xs text-slate-400">
                {totalVoters} {totalVoters === 1 ? 'person' : 'people'} from your network
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
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Bookmark size={16} fill={bookmarked ? 'currentColor' : 'none'} />
              {bookmarked ? 'Saved' : 'Want to go'}
            </button>
          </div>
        </div>

        {/* Reviews list */}
        {totalReviews > 0 && (
          <div className="border-t border-slate-700">
            <p className="px-5 pt-3 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Reviews
            </p>
            <div className="px-5 pb-5 space-y-3">
              {reviews.map(rec => {
                const ratingConfig = RATING_CONFIG[rec.rating]
                const timeAgo = rec.createdAt?.seconds
                  ? getTimeAgo(rec.createdAt.seconds * 1000)
                  : ''
                const isOwn = rec.userId === user?.uid
                const isEditing = editingId === rec.id

                if (isEditing) {
                  return (
                    <div key={rec.id} className="bg-slate-800 rounded-lg p-3 space-y-3">
                      <div className="flex gap-3 justify-center">
                        {['red', 'yellow', 'green'].map(color => {
                          const cfg = RATING_CONFIG[color]
                          return (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setEditRating(color)}
                              className={`w-8 h-8 rounded-full ${cfg.bg} transition-all ${
                                editRating === color ? 'ring-2 ring-offset-2 ring-slate-600 scale-110' : 'opacity-50'
                              }`}
                            />
                          )
                        })}
                      </div>
                      <textarea
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            setSaving(true)
                            await updateRecommendation(rec.id, {
                              rating: editRating,
                              comment: editComment.trim()
                            })
                            setEditingId(null)
                            setSaving(false)
                            onReviewChanged?.()
                          }}
                          disabled={saving}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={rec.id} className="flex items-start gap-3">
                    <div className={`mt-0.5 w-4 h-4 rounded-full ${ratingConfig.bg} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/user/${rec.userId}`}
                          className="flex items-center gap-1.5 group"
                          onClick={onClose}
                        >
                          <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-medium text-slate-400 overflow-hidden">
                            {rec.userPhotoURL ? (
                              <img src={rec.userPhotoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              rec.userName?.[0]?.toUpperCase()
                            )}
                          </div>
                          <span className="text-xs font-medium text-slate-300 group-hover:text-green-500">
                            {rec.userName}
                          </span>
                        </Link>
                        <span className={`text-[10px] font-medium ${ratingConfig.textColor}`}>
                          {ratingConfig.label}
                        </span>
                        {timeAgo && <span className="text-[10px] text-slate-500">{timeAgo}</span>}
                        {isOwn && (
                          <div className="flex items-center gap-1 ml-auto">
                            <button
                              onClick={() => {
                                setEditingId(rec.id)
                                setEditComment(rec.comment || '')
                                setEditRating(rec.rating)
                              }}
                              className="p-1 text-slate-500 hover:text-green-500 transition-colors"
                              title="Edit"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm('Delete this review?')) {
                                  await deleteRecommendation(rec.id)
                                  onReviewChanged?.()
                                }
                              }}
                              className="p-1 text-slate-500 hover:text-red-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                      {rec.comment && (
                        <p className="text-sm text-slate-300 mt-1 leading-relaxed">{rec.comment}</p>
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
            <p className="text-center text-slate-400 text-xs">
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
