// Get deduplicated rating counts (one rating per user, latest wins)
export function getDeduplicatedCounts(reviews) {
  const latestByUser = new Map()
  // Sort by createdAt ascending so latest overwrites earlier
  const sorted = [...reviews].sort(
    (a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
  )
  sorted.forEach(r => {
    if (r.userId && r.rating) {
      latestByUser.set(r.userId, r.rating)
    }
  })

  const counts = { green: 0, yellow: 0, red: 0 }
  latestByUser.forEach(rating => {
    if (counts[rating] !== undefined) counts[rating]++
  })
  return counts
}

// Get dominant rating color (tiebreak: green > yellow > red)
export function getDominantRating(counts) {
  return ['green', 'yellow', 'red'].reduce((a, b) => counts[a] >= counts[b] ? a : b)
}
