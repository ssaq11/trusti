import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import TrafficLight from './TrafficLight'

const RATING_CONFIG = {
  red: { bg: 'bg-red-500', ring: 'ring-red-200', label: "Don't go", textColor: 'text-red-600' },
  yellow: { bg: 'bg-yellow-400', ring: 'ring-yellow-200', label: "It's okay", textColor: 'text-yellow-600' },
  green: { bg: 'bg-green-500', ring: 'ring-green-200', label: 'Must try!', textColor: 'text-green-600' },
}

export default function RecommendationCard({ rec, showUser = true, onDelete }) {
  const rating = RATING_CONFIG[rec.rating] || RATING_CONFIG.green
  const timeAgo = rec.createdAt?.seconds
    ? getTimeAgo(rec.createdAt.seconds * 1000)
    : ''

  return (
    <div className="bg-slate-800 rounded-xl shadow-sm p-4 mb-3">
      <div className="flex items-start gap-3">
        <TrafficLight activeColors={[rec.rating]} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-white text-sm">{rec.restaurantName}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{rec.restaurantAddress}</p>
            </div>
            <span className={`text-xs font-medium ${rating.textColor} whitespace-nowrap`}>
              {rating.label}
            </span>
          </div>

          {rec.comment && (
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">{rec.comment}</p>
          )}

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              {showUser && (
                <Link to={`/user/${rec.userId}`} className="flex items-center gap-1.5 group">
                  <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-medium text-slate-400 overflow-hidden">
                    {rec.userPhotoURL ? (
                      <img src={rec.userPhotoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      rec.userName?.[0]?.toUpperCase()
                    )}
                  </div>
                  <span className="text-xs text-slate-400 group-hover:text-green-500">{rec.userName}</span>
                </Link>
              )}
              {timeAgo && <span className="text-[10px] text-slate-400">{timeAgo}</span>}
            </div>
            {onDelete && (
              <button
                onClick={() => onDelete(rec.id)}
                className="text-slate-400 hover:text-red-500 transition-colors p-1"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
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
