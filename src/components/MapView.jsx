import { useEffect, useRef, useState, useCallback } from 'react'
import { Navigation, RefreshCw, Flag, Ban, AlertTriangle, X } from 'lucide-react'
import { searchNearby, isGoogleMapsLoaded, isFoodOrDrink } from '../services/places'
import { getDeduplicatedCounts, getDominantRating } from '../utils/ratings'
import { updateRecommendation, deleteRecommendation } from '../services/firestore'
import TrafficLight from './TrafficLight'
import IntentModal from './IntentModal'

const DEFAULT_CENTER = { lat: 30.2672, lng: -97.7431 } // Austin, TX fallback
const TRUSTI_COLORS = { red: '#ef4444', yellow: '#eab308', green: '#22c55e' }
const LABEL_ZOOM = 16

// Build an SVG string for review-count dots
function buildReviewDotSvg(counts) {
  const colors = ['green', 'yellow', 'red']
  const active = colors.filter(c => counts[c] > 0)
  const total = active.reduce((sum, c) => sum + counts[c], 0)
  const size = 20
  const r = 8
  const cx = size / 2
  const cy = size / 2

  if (active.length <= 1) {
    const color = active[0] || 'green'
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${TRUSTI_COLORS[color]}" stroke="#fff" stroke-width="2"/>
    </svg>`
  }

  const sorted = [...active].sort((a, b) => counts[b] - counts[a])
  const isDominant = counts[sorted[0]] > counts[sorted[1]]

  if (isDominant) {
    const dominant = sorted[0]
    const secondaries = sorted.slice(1)
    const ringWidth = 2.5
    const ringR = r + 0.5
    let ringParts = ''
    if (secondaries.length === 1) {
      ringParts = `<circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" stroke="${TRUSTI_COLORS[secondaries[0]]}" stroke-width="${ringWidth}"/>`
    } else {
      ringParts = `
        <path d="M ${cx} ${cy - ringR} A ${ringR} ${ringR} 0 0 1 ${cx} ${cy + ringR}" fill="none" stroke="${TRUSTI_COLORS[secondaries[0]]}" stroke-width="${ringWidth}"/>
        <path d="M ${cx} ${cy + ringR} A ${ringR} ${ringR} 0 0 1 ${cx} ${cy - ringR}" fill="none" stroke="${TRUSTI_COLORS[secondaries[1]]}" stroke-width="${ringWidth}"/>
      `
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      ${ringParts}
      <circle cx="${cx}" cy="${cy}" r="${r - 0.5}" fill="${TRUSTI_COLORS[dominant]}" stroke="#fff" stroke-width="1.5"/>
    </svg>`
  }

  // Even split — pie chart
  const segments = active.map(c => ({ color: c, value: counts[c] }))
  let paths = ''
  let startAngle = -Math.PI / 2
  segments.forEach(seg => {
    const sliceAngle = (seg.value / total) * 2 * Math.PI
    const endAngle = startAngle + sliceAngle
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const largeArc = sliceAngle > Math.PI ? 1 : 0
    paths += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${TRUSTI_COLORS[seg.color]}"/>`
    startAngle = endAngle
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    ${paths}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="2"/>
  </svg>`
}

// Build HTML content for an AdvancedMarkerElement
function buildMarkerContent(place, { hasReviews, counts, isBookmarked, isKeywordMatch, showLabel, intentType }) {
  const container = document.createElement('div')
  container.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:0;'

  // Balloon floats above the dot on a string
  if (intentType) {
    container.appendChild(buildBalloonDiv(intentType))
  }

  const dot = document.createElement('div')
  dot.dataset.markerDot = '1'
  dot.dataset.hasReviews = hasReviews ? '1' : ''
  if (hasReviews) {
    dot.innerHTML = buildReviewDotSvg(counts)
  } else if (isBookmarked) {
    dot.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#8b5cf6" fill-opacity="0.9" stroke="#fff" stroke-width="1"/>
    </svg>`
  } else if (isKeywordMatch) {
    dot.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="24" viewBox="0 0 24 24">
      <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" fill="#16a34a" fill-opacity="0.9" stroke="#fff" stroke-width="1"/>
    </svg>`
  } else {
    dot.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
      <circle cx="8" cy="8" r="7" fill="#9ca3af" fill-opacity="0.7" stroke="#fff" stroke-width="1"/>
    </svg>`
  }

  container.appendChild(dot)

  const label = document.createElement('div')
  label.textContent = place.name
  label.style.cssText = 'font-size:11px;font-weight:500;color:#fff;background:rgba(30,41,59,0.85);padding:2px 6px;border-radius:4px;white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis;margin-top:2px;pointer-events:none;'
  if (!showLabel) label.style.display = 'none'
  container.appendChild(label)

  return { element: container, labelEl: label }
}

// Build a "balloon on a string" div that floats above the marker dot
function buildBalloonDiv(intentType) {
  const BALLOON_R = 8
  const STRING_LEN = 22
  const OFFSET_X = 7  // balloon drifts right for 'try', left for 'pass'
  const isTry = intentType === 'try'
  const balloonColor = isTry ? '#22c55e' : '#ef4444'
  const offsetX = isTry ? OFFSET_X : -OFFSET_X
  const svgW = 38
  const svgH = BALLOON_R * 2 + STRING_LEN
  const centerX = svgW / 2
  const bCX = centerX + offsetX
  const bCY = BALLOON_R
  const s1X = bCX, s1Y = bCY + BALLOON_R  // bottom of balloon
  const s2X = centerX, s2Y = svgH          // bottom of SVG (touches top of dot)

  let icon = ''
  if (isTry) {
    icon = `<text x="${bCX}" y="${bCY}" text-anchor="middle" dominant-baseline="central" font-size="10" fill="white" font-weight="bold">★</text>`
  } else {
    const d = 3.5
    icon = `<line x1="${bCX-d}" y1="${bCY-d}" x2="${bCX+d}" y2="${bCY+d}" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="${bCX+d}" y1="${bCY-d}" x2="${bCX-d}" y2="${bCY+d}" stroke="white" stroke-width="1.8" stroke-linecap="round"/>`
  }

  const div = document.createElement('div')
  div.className = 'trusti-balloon-div'
  div.style.cssText = 'pointer-events:none;line-height:0;'
  div.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" overflow="visible">
    <line x1="${s1X}" y1="${s1Y}" x2="${s2X}" y2="${s2Y}" stroke="${balloonColor}" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="${bCX}" cy="${bCY}" r="${BALLOON_R}" fill="${balloonColor}" stroke="white" stroke-width="1.5"/>
    ${icon}
  </svg>`
  return div
}

function getCuisineLabel(types = []) {
  const specific = types.find(t => t.endsWith('_restaurant') && t !== 'restaurant')
  if (specific) {
    return specific.replace('_restaurant', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
  const known = { cafe: 'Café', bar: 'Bar', bakery: 'Bakery', night_club: 'Nightclub', meal_delivery: 'Delivery' }
  for (const [key, label] of Object.entries(known)) {
    if (types.includes(key)) return label
  }
  return null
}

function getPriceLabel(priceLevel) {
  const map = {
    PRICE_LEVEL_FREE: 'Free',
    PRICE_LEVEL_INEXPENSIVE: '$',
    PRICE_LEVEL_MODERATE: '$$',
    PRICE_LEVEL_EXPENSIVE: '$$$',
    PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
  }
  return map[priceLevel] || null
}

function isZipCode(text) {
  return /^\d{5}$/.test(text.trim())
}

function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

async function geocodeLocation(query) {
  if (!window.google?.maps) return null
  const geocoder = new window.google.maps.Geocoder()
  return new Promise((resolve) => {
    geocoder.geocode({ address: query }, (results, status) => {
      if (status === 'OK' && results[0]) {
        resolve({
          lat: results[0].geometry.location.lat(),
          lng: results[0].geometry.location.lng(),
        })
      } else {
        resolve(null)
      }
    })
  })
}

const INTEL_DATA = {
  green:  { placeholder: "What's the play?...",    borderColor: '#22c55e', chips: ['Hidden gem','Date night','Great cocktails','Must order...','Worth the wait','Incredible vibe'] },
  yellow: { placeholder: "What's the caveat?...",  borderColor: '#facc15', chips: ['Just okay','Overpriced','Too loud','Slow service','Only if nearby'] },
  red:    { placeholder: "Save your friends...",   borderColor: '#ef4444', chips: ['Tourist trap','Save your money','Rude staff','Fell off','Skip it'] },
  try:    { placeholder: "Why is it on radar?...", borderColor: '#4ade80', chips: ['Menu looks fire','Saw on IG','Highly recommended','Need a resy'] },
  pass:   { placeholder: "What's the warning?...", borderColor: '#f87171', chips: ['Overhyped','Impossible to get in','Sketchy vibe'] }
}

export default function MapView({ onPlaceSelect, onAddReview, onReviewPost, onIntentSubmit, onClearIntent, currentUser, userIntents = [], onClearSearch, searchKeyword, trustiRecs = [], bookmarks = [], filter = 'all' }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const markerLabelsRef = useRef([])
  const advancedMarkerClassRef = useRef(null)
  const listRef = useRef(null)
  const userMarkerRef = useRef(null)
  const searchKeywordRef = useRef(searchKeyword)
  const filterRef = useRef(filter)
  const searchAtLocationRef = useRef(null)
  const idleTimerRef = useRef(null)
  const skipNextIdleRef = useRef(false)
  const searchGenRef = useRef(0)
  const userIntentsRef = useRef(userIntents)
  const centeredKeywordRef = useRef(null)
  const [places, setPlaces] = useState([])
  const [userLocation, setUserLocation] = useState(null)
  const [mapReady, setMapReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [locating, setLocating] = useState(false)
  const [selectedPlaceId, setSelectedPlaceId] = useState(null)
  const [intentModal, setIntentModal] = useState(null) // null | { place, type }
  const [review, setReview] = useState(null) // null | { placeId, type:'light'|'flag', value, visible, isEdit?, editId? }
  const [reviewText, setReviewText] = useState('')
  const [selectedChips, setSelectedChips] = useState([])
  const [expandedPlaceId, setExpandedPlaceId] = useState(null)
  const [expandVisible, setExpandVisible] = useState(false)
  const cardRefs = useRef({})
  const savedScrollRef = useRef(0)
  const [noCommentPlaceId, setNoCommentPlaceId] = useState(null)

  // Highlight the selected marker — scale up dot + border ring
  useEffect(() => {
    // Reset all markers
    markersRef.current.forEach(m => {
      const dotEl = m.content?.querySelector('[data-marker-dot]')
      if (dotEl) {
        dotEl.style.transform = ''
        const ring = dotEl.querySelector('.trusti-select-ring')
        if (ring) ring.remove()
      }
    })

    if (!selectedPlaceId) return

    const idx = places.findIndex(p => p.placeId === selectedPlaceId)
    if (idx === -1) return
    const marker = markersRef.current[idx]
    const dotEl = marker?.content?.querySelector('[data-marker-dot]')
    if (!dotEl) return

    // Scale up the dot only (not the label)
    dotEl.style.transform = 'scale(1.25)'
    dotEl.style.position = 'relative'

    // Add an orange border ring flush against the dot
    const svg = dotEl.querySelector('svg')
    const dotW = svg ? svg.getAttribute('width') : 16
    const dotH = svg ? svg.getAttribute('height') : 16
    const ring = document.createElement('div')
    ring.className = 'trusti-select-ring'
    ring.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${dotW}px;height:${dotH}px;border-radius:50%;border:2.5px solid #FFB833;pointer-events:none;`
    dotEl.appendChild(ring)

    marker.zIndex = 1000
    return () => { marker.zIndex = null }
  }, [selectedPlaceId, places])

  // Keep refs in sync
  useEffect(() => {
    searchKeywordRef.current = searchKeyword
  }, [searchKeyword])

  useEffect(() => {
    filterRef.current = filter
  }, [filter])

  useEffect(() => {
    userIntentsRef.current = userIntents
  }, [userIntents])

  // Update intent balloons on existing markers immediately when intents change
  useEffect(() => {
    const intentLookup = new Map(userIntents.map(i => [i.placeId, i.type]))
    markersRef.current.forEach((marker, idx) => {
      const place = places[idx]
      if (!place) return
      const content = marker.content
      if (!content) return
      // Remove existing balloon
      const existingBalloon = content.querySelector('.trusti-balloon-div')
      if (existingBalloon) existingBalloon.remove()
      // Prepend new balloon if needed
      const intentType = intentLookup.get(place.placeId)
      if (intentType) {
        content.insertBefore(buildBalloonDiv(intentType), content.firstChild)
      }
    })
  }, [userIntents, places])

  // Scroll to a place card in the list so it sits at the top of the visible area
  const scrollToCard = useCallback((placeId) => {
    setSelectedPlaceId(placeId)
    setExpandVisible(false)
    setTimeout(() => setExpandedPlaceId(null), 220)
    setNoCommentPlaceId(null)
    setTimeout(() => {
      const list = listRef.current
      const cardEl = list?.querySelector(`[data-place-id="${placeId}"]`)
      if (list && cardEl) {
        list.scrollTo({ top: cardEl.offsetTop - list.offsetTop, behavior: 'smooth' })
      }
    }, 0)
  }, [])

  // Search at a given center with a given keyword
  const searchAtLocation = useCallback(async (center, keyword) => {
    if (!mapInstanceRef.current) return

    const activeFilter = filterRef.current
    const gen = ++searchGenRef.current

    setLoading(true)

    // Group reviews by placeId
    const reviewsByPlace = new Map()
    trustiRecs.forEach(rec => {
      if (rec.restaurantPlaceId) {
        if (!reviewsByPlace.has(rec.restaurantPlaceId)) {
          reviewsByPlace.set(rec.restaurantPlaceId, [])
        }
        reviewsByPlace.get(rec.restaurantPlaceId).push(rec)
      }
    })

    // Build bookmark lookup
    const bookmarkedSet = new Set(bookmarks.map(b => b.placeId))

    let results = []

    // For "reviewed" and "bookmarked" filters, skip Google Places search
    if (activeFilter === 'reviewed') {
      const bounds = mapInstanceRef.current.getBounds()
      reviewsByPlace.forEach((recs, placeId) => {
        const rec = recs[0]
        const lat = rec.restaurantLat
        const lng = rec.restaurantLng
        if (lat != null && lng != null) {
          if (!bounds || bounds.contains(new window.google.maps.LatLng(lat, lng))) {
            results.push({
              placeId,
              name: rec.restaurantName,
              address: rec.restaurantAddress || '',
              lat,
              lng,
              photoUrl: null,
              rating: null,
            })
          }
        }
      })
    } else if (activeFilter === 'bookmarked') {
      const bounds = mapInstanceRef.current.getBounds()
      bookmarks.forEach(b => {
        const lat = b.placeLat
        const lng = b.placeLng
        if (lat != null && lng != null) {
          if (!bounds || bounds.contains(new window.google.maps.LatLng(lat, lng))) {
            results.push({
              placeId: b.placeId,
              name: b.placeName,
              address: b.placeAddress || '',
              lat,
              lng,
              photoUrl: null,
              rating: null,
            })
          }
        }
      })
    } else {
      // "all" filter — use Google Places search
      if (keyword) {
        const [keywordResults, nearbyResults] = await Promise.all([
          searchNearby(mapInstanceRef.current, center, keyword),
          searchNearby(mapInstanceRef.current, center, ''),
        ])
        if (gen !== searchGenRef.current) return

        const keywordPlaceIds = new Set(keywordResults.map(r => r.placeId))
        const keywordWords = keyword.toLowerCase().split(/\s+/).filter(w => w.length > 1)
        keywordResults.forEach(r => {
          const nameLower = r.name.toLowerCase()
          if (keywordWords.some(w => nameLower.includes(w))) {
            r._keywordMatch = true
          }
        })

        results = keywordResults

        nearbyResults.forEach(r => {
          if (!keywordPlaceIds.has(r.placeId)) {
            results.push(r)
          }
        })

      } else {
        results = await searchNearby(mapInstanceRef.current, center, '')
        if (gen !== searchGenRef.current) return
      }

      // Also add trusti-reviewed and bookmarked places not already in results
      const resultPlaceIds = new Set(results.map(r => r.placeId))
      const bounds = mapInstanceRef.current.getBounds()

      // DEBUG
      console.log('[trusti-debug] overlay check — reviewsByPlace:', reviewsByPlace.size, 'bookmarks:', bookmarks.length, 'userIntents:', userIntentsRef.current.length)
      console.log('[trusti-debug] bounds:', bounds ? `${bounds.getSouthWest().lat().toFixed(4)},${bounds.getSouthWest().lng().toFixed(4)} → ${bounds.getNorthEast().lat().toFixed(4)},${bounds.getNorthEast().lng().toFixed(4)}` : 'null')

      reviewsByPlace.forEach((recs, placeId) => {
        if (resultPlaceIds.has(placeId)) return
        const rec = recs[0]
        const lat = rec.restaurantLat
        const lng = rec.restaurantLng
        if (lat != null && lng != null) {
          if (!bounds || bounds.contains(new window.google.maps.LatLng(lat, lng))) {
            results.push({
              placeId,
              name: rec.restaurantName,
              address: rec.restaurantAddress || '',
              lat,
              lng,
              photoUrl: null,
              rating: null,
            })
            resultPlaceIds.add(placeId)
          }
        }
      })
      bookmarks.forEach(b => {
        if (resultPlaceIds.has(b.placeId)) return
        const lat = b.placeLat
        const lng = b.placeLng
        if (lat != null && lng != null) {
          if (!bounds || bounds.contains(new window.google.maps.LatLng(lat, lng))) {
            results.push({
              placeId: b.placeId,
              name: b.placeName,
              address: b.placeAddress || '',
              lat,
              lng,
              photoUrl: null,
              rating: null,
            })
            resultPlaceIds.add(b.placeId)
          }
        }
      })
      // Always include intent-flagged places — flags are critical signals and must
      // stay visible at every zoom level, same priority as reviewed/bookmarked places
      console.log('[trusti-debug] intents to overlay:', userIntentsRef.current.map(i => ({ name: i.placeName, placeId: i.placeId, lat: i.placeLat, lng: i.placeLng, type: i.type })))
      userIntentsRef.current.forEach(intent => {
        const alreadyIn = resultPlaceIds.has(intent.placeId)
        const lat = intent.placeLat
        const lng = intent.placeLng
        const hasCoords = lat != null && lng != null
        const inBounds = hasCoords && bounds && bounds.contains(new window.google.maps.LatLng(lat, lng))
        console.log(`[trusti-debug] intent "${intent.placeName}" (${intent.type}): alreadyIn=${alreadyIn}, lat=${lat}, lng=${lng}, hasCoords=${hasCoords}, inBounds=${inBounds}`)
        if (alreadyIn) return
        if (lat != null && lng != null) {
          if (!bounds || bounds.contains(new window.google.maps.LatLng(lat, lng))) {
            results.push({
              placeId: intent.placeId,
              name: intent.placeName,
              address: intent.placeAddress || '',
              lat,
              lng,
              photoUrl: null,
              rating: null,
            })
            resultPlaceIds.add(intent.placeId)
            console.log(`[trusti-debug] ✅ added "${intent.placeName}" to results`)
          } else {
            console.log(`[trusti-debug] ❌ "${intent.placeName}" out of bounds — skipped`)
          }
        } else {
          console.log(`[trusti-debug] ❌ "${intent.placeName}" missing coords — skipped`)
        }
      })
    }

    // Sort: keyword matches first, then reviewed places, then rest
    if (keyword && activeFilter === 'all') {
      results.sort((a, b) => {
        const aKey = a._keywordMatch ? 1 : 0
        const bKey = b._keywordMatch ? 1 : 0
        if (aKey !== bKey) return bKey - aKey
        const aRev = reviewsByPlace.has(a.placeId) ? 1 : 0
        const bRev = reviewsByPlace.has(b.placeId) ? 1 : 0
        return bRev - aRev
      })
    }

    // Sort by rating when in "reviewed" filter
    if (activeFilter === 'reviewed') {
      results.sort((a, b) => {
        const countsA = getDeduplicatedCounts(reviewsByPlace.get(a.placeId) || [])
        const countsB = getDeduplicatedCounts(reviewsByPlace.get(b.placeId) || [])
        const scoreA = countsA.green * 3 + countsA.yellow * 2 + countsA.red
        const scoreB = countsB.green * 3 + countsB.yellow * 2 + countsB.red
        return scoreB - scoreA
      })
    }

    setPlaces(results)

    // Clear old markers
    markersRef.current.forEach(m => { m.map = null })
    markersRef.current = []
    markerLabelsRef.current = []

    const AdvancedMarker = advancedMarkerClassRef.current
    const map = mapInstanceRef.current
    const showLabel = (map.getZoom() || 15) >= LABEL_ZOOM

    const intentLookup = new Map(userIntentsRef.current.map(i => [i.placeId, i.type]))

    results.forEach(place => {
      if (place.lat == null || place.lng == null) return

      const placeReviews = reviewsByPlace.get(place.placeId) || []
      const hasReviews = placeReviews.length > 0
      const isBookmarked = bookmarkedSet.has(place.placeId)

      const counts = hasReviews ? getDeduplicatedCounts(placeReviews) : null
      const { element, labelEl } = buildMarkerContent(place, {
        hasReviews,
        counts,
        isBookmarked,
        isKeywordMatch: !!place._keywordMatch,
        showLabel,
        intentType: intentLookup.get(place.placeId) || null,
      })

      const marker = new AdvancedMarker({
        map,
        position: { lat: place.lat, lng: place.lng },
        content: element,
        title: place.name,
        gmpClickable: true,
      })

      marker.addEventListener('gmp-click', () => {
        scrollToCard(place.placeId)
      })

      markersRef.current.push(marker)
      markerLabelsRef.current.push(labelEl)
    })

    setLoading(false)
    return results
  }, [trustiRecs, bookmarks, onPlaceSelect, scrollToCard])

  // Keep ref in sync so idle listener always uses latest version
  useEffect(() => {
    searchAtLocationRef.current = searchAtLocation
  }, [searchAtLocation])

  // Request location and move map there
  async function goToMyLocation() {
    if (!mapInstanceRef.current) return
    setLocating(true)
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 60000
        })
      })
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      setUserLocation(loc)
      skipNextIdleRef.current = true
      mapInstanceRef.current.panTo(loc)
      mapInstanceRef.current.setZoom(15)

      if (userMarkerRef.current) {
        userMarkerRef.current.position = loc
      } else {
        const dot = document.createElement('div')
        dot.innerHTML = '<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="7" fill="#4285F4" stroke="#fff" stroke-width="2"/></svg>'
        userMarkerRef.current = new (advancedMarkerClassRef.current)({
          position: loc,
          map: mapInstanceRef.current,
          content: dot,
          zIndex: 999,
        })
      }

      centeredKeywordRef.current = null
      onClearSearch?.()
      await searchAtLocation(loc, '')
    } catch (err) {
      if (err.code === 1) {
        alert('Location access is blocked. Please tap the lock icon in your browser\'s address bar and allow location access, then try again.')
      } else {
        alert('Could not detect your location. Please check your device settings.')
      }
    }
    setLocating(false)
  }

  // Initialize map
  useEffect(() => {
    let mounted = true

    async function initMap() {
      const checkGoogle = () => {
        return new Promise((resolve) => {
          if (isGoogleMapsLoaded()) { resolve(true); return }
          const check = setInterval(() => {
            if (isGoogleMapsLoaded()) { clearInterval(check); resolve(true) }
          }, 200)
          setTimeout(() => { clearInterval(check); resolve(false) }, 10000)
        })
      }

      const loaded = await checkGoogle()
      if (!loaded || !mounted || !mapRef.current) {
        setLoading(false)
        return
      }

      // Load AdvancedMarkerElement library
      try {
        const markerLib = await window.google.maps.importLibrary('marker')
        advancedMarkerClassRef.current = markerLib.AdvancedMarkerElement
        console.log('[trusti] AdvancedMarkerElement loaded via importLibrary')
      } catch (err) {
        // Fallback: try direct access (loaded via script tag libraries=marker)
        if (window.google.maps.marker?.AdvancedMarkerElement) {
          advancedMarkerClassRef.current = window.google.maps.marker.AdvancedMarkerElement
          console.log('[trusti] AdvancedMarkerElement loaded via direct access')
        } else {
          console.warn('[trusti] AdvancedMarkerElement NOT available — falling back to legacy markers:', err)
        }
      }

      let center = DEFAULT_CENTER
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false, timeout: 5000, maximumAge: 300000
          })
        })
        center = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        if (mounted) setUserLocation(center)
      } catch {
        // User can tap the location button
      }

      if (!mounted || !mapRef.current) return

      const map = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 15,
        mapId: 'c35383f740cf2c5bd706182f',
        colorScheme: 'DARK',
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        keyboardShortcuts: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })

      mapInstanceRef.current = map
      console.log('[trusti] Map created with mapId: c35383f740cf2c5bd706182f')
      console.log('[trusti] AdvancedMarker available:', !!advancedMarkerClassRef.current)

      if (center !== DEFAULT_CENTER && advancedMarkerClassRef.current) {
        const dot = document.createElement('div')
        dot.innerHTML = '<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="7" fill="#4285F4" stroke="#fff" stroke-width="2"/></svg>'
        userMarkerRef.current = new (advancedMarkerClassRef.current)({
          position: center,
          map,
          content: dot,
          zIndex: 999,
        })
      }

      // Toggle marker labels on zoom change
      map.addListener('zoom_changed', () => {
        const show = (map.getZoom() || 15) >= LABEL_ZOOM
        markerLabelsRef.current.forEach(label => {
          label.style.display = show ? 'block' : 'none'
        })
      })

      // Auto-refresh places when map stops moving
      map.addListener('idle', () => {
        if (!mounted) return
        if (skipNextIdleRef.current) {
          skipNextIdleRef.current = false
          return
        }
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
        idleTimerRef.current = setTimeout(() => {
          const c = map.getCenter()
          searchAtLocationRef.current?.({ lat: c.lat(), lng: c.lng() }, searchKeywordRef.current || '')
        }, 600)
      })

      // Tap on map dismisses the inline review banner and expanded panel
      map.addListener('click', () => {
        setReview(r => r ? { ...r, visible: false } : null)
        setTimeout(() => setReview(null), 220)
        setExpandVisible(false)
        setTimeout(() => setExpandedPlaceId(null), 220)
        setNoCommentPlaceId(null)
      })

      if (mounted) {
        setMapReady(true)
        setLoading(false)
      }
    }

    initMap()
    return () => {
      mounted = false
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [])

  // Search when keyword or filter changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return

    async function doSearch() {
      const keyword = searchKeywordRef.current || ''
      const center = mapInstanceRef.current.getCenter()
      const mapCenter = { lat: center.lat(), lng: center.lng() }

      if (keyword && centeredKeywordRef.current !== keyword) {
        centeredKeywordRef.current = keyword
        setLoading(true)

        const keywordResults = await searchNearby(mapInstanceRef.current, mapCenter, keyword)
        const firstResult = keywordResults.find(r => r.lat != null && r.lng != null)

        if (firstResult) {
          const newCenter = { lat: firstResult.lat, lng: firstResult.lng }
          skipNextIdleRef.current = true
          mapInstanceRef.current.setCenter(newCenter)
          mapInstanceRef.current.setZoom(15)
          await searchAtLocationRef.current?.(newCenter, keyword)
        } else {
          await searchAtLocationRef.current?.(mapCenter, keyword)
        }
      } else {
        await searchAtLocationRef.current?.(mapCenter, keyword)
      }
    }

    const keyword = searchKeyword || ''
    if (keyword && isZipCode(keyword)) {
      setLoading(true)
      geocodeLocation(keyword).then(location => {
        if (location) {
          skipNextIdleRef.current = true
          mapInstanceRef.current.panTo(location)
          mapInstanceRef.current.setZoom(15)
          searchAtLocationRef.current?.(location, '')
        }
      })
    } else {
      doSearch()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, searchKeyword, filter])

  // Re-search when Firebase data (trustiRecs/bookmarks/userIntents) arrives after map is ready
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return
    const c = mapInstanceRef.current.getCenter()
    searchAtLocationRef.current?.({ lat: c.lat(), lng: c.lng() }, searchKeywordRef.current || '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, trustiRecs, bookmarks, userIntents])

  function closeExpanded() {
    setExpandVisible(false)
    setTimeout(() => setExpandedPlaceId(null), 220)
  }

  function openReview(place, type, value) {
    // Close expanded read panel when opening write banner
    setExpandVisible(false)
    setExpandedPlaceId(null)
    setNoCommentPlaceId(null)
    if (review?.placeId === place.placeId && review?.type === type && review?.value === value) {
      // Same element tapped again — deselect and close
      closeReview()
      return
    }
    if (review?.placeId === place.placeId) {
      // Same card, different pick — update label in place, no re-animation
      setReview(r => r ? { ...r, type, value } : null)
      return
    }
    // New card — highlight it, save scroll pos, scroll card to top of list
    setSelectedPlaceId(place.placeId)
    setReview({ placeId: place.placeId, type, value, visible: false })
    const list = listRef.current
    const cardEl = cardRefs.current[place.placeId]
    if (list && cardEl) {
      savedScrollRef.current = list.scrollTop
      const cardOffsetInList = cardEl.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop
      list.scrollTo({ top: cardOffsetInList, behavior: 'smooth' })
    }
    setTimeout(() => setReview(r => r ? { ...r, visible: true } : null), 10)
  }

  function closeReview({ skipRestore = false } = {}) {
    setReview(r => r ? { ...r, visible: false } : null)
    setReviewText('')
    setSelectedChips([])
    if (!skipRestore) {
      listRef.current?.scrollTo({ top: savedScrollRef.current, behavior: 'smooth' })
    }
    setTimeout(() => setReview(null), 220)
  }

  async function postReview() {
    if (!review) return
    const place = places.find(p => p.placeId === review.placeId)
    if (!place) return
    const placeData = { placeId: place.placeId, name: place.name, address: place.address, lat: place.lat, lng: place.lng }
    if (review.type === 'light') {
      if (review.isEdit && review.editId) {
        await updateRecommendation(review.editId, {
          rating: review.value,
          comment: reviewText.trim(),
          chips: selectedChips,
        })
        onReviewPost?.({ reload: true })
      } else {
        await onReviewPost?.({ place: placeData, rating: review.value, comment: reviewText, chips: selectedChips })
      }
    } else {
      await onIntentSubmit?.({ place: placeData, type: review.value, note: reviewText })
    }
    closeReview()
  }

  function openEditReview(rec) {
    const placeId = rec.restaurantPlaceId
    const place = places.find(p => p.placeId === placeId)
    if (!place) return
    setExpandedPlaceId(null)
    setSelectedPlaceId(placeId)
    setReviewText(rec.comment || '')
    setSelectedChips(rec.chips || [])
    setReview({ placeId, type: 'light', value: rec.rating, visible: false, isEdit: true, editId: rec.id })
    const list = listRef.current
    const cardEl = cardRefs.current[placeId]
    if (list && cardEl) {
      savedScrollRef.current = list.scrollTop
      const cardOffsetInList = cardEl.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop
      list.scrollTo({ top: cardOffsetInList, behavior: 'smooth' })
    }
    setTimeout(() => setReview(r => r ? { ...r, visible: true } : null), 10)
  }

  // Data for the slide-up expanded panel
  const expandedPlace = expandedPlaceId ? (places.find(p => p.placeId === expandedPlaceId) ?? null) : null
  const expandedIntent = expandedPlaceId ? (userIntents.find(i => i.placeId === expandedPlaceId) ?? null) : null
  const expandedUserGroups = (() => {
    if (!expandedPlaceId) return []
    const expReviews = trustiRecs.filter(r => r.restaurantPlaceId === expandedPlaceId)
    const byUser = {}
    expReviews.forEach(rec => {
      if (!byUser[rec.userId]) byUser[rec.userId] = []
      byUser[rec.userId].push(rec)
    })
    return Object.values(byUser)
      .map(recs => [...recs].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
      .sort((a, b) => (b[0].createdAt?.seconds || 0) - (a[0].createdAt?.seconds || 0))
  })()

  return (
    <div className="flex flex-col h-full">
      {/* Map with buttons */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div
          ref={mapRef}
          className="w-full h-full overflow-hidden bg-slate-800"
        >
          {!isGoogleMapsLoaded() && (
            <div className="flex items-center justify-center h-full text-slate-400 text-xs">
              Loading map...
            </div>
          )}
        </div>

        {/* My Location button */}
        {mapReady && (
          <button
            onClick={goToMyLocation}
            disabled={locating}
            className="absolute bottom-3 left-3 bg-slate-700 rounded-lg shadow-md p-2 hover:bg-slate-600 active:bg-slate-500 transition-colors disabled:opacity-50"
            title="Go to my location"
          >
            <Navigation
              size={18}
              className={`text-green-500 ${locating ? 'animate-pulse' : ''}`}
              fill={userLocation ? '#16a34a' : 'none'}
            />
          </button>
        )}

        {loading && (
          <div className="absolute bottom-3 right-3 bg-slate-700 rounded-lg shadow-md p-2">
            <RefreshCw size={16} className="text-green-500 animate-spin" />
          </div>
        )}


        {/* Expanded review panel — slides up over map like write banner */}
        {expandedPlaceId && expandedPlace && (
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              zIndex: 400,
              maxHeight: '55%',
              background: '#0d1b33',
              borderRadius: '16px 16px 0 0',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.6)',
              borderTop: '4px solid rgba(255,255,255,0.08)',
              transform: expandVisible ? 'translateY(0)' : 'translateY(100%)',
              transition: 'transform 0.22s cubic-bezier(0.2,0,0,1)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
              <div style={{ width: 36, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
            </div>
            {/* Place header */}
            <div style={{ padding: '0 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{expandedPlace.name}</span>
                  {expandedIntent && (
                    <button
                      onClick={() => onClearIntent?.(expandedPlaceId)}
                      title="Remove flag"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        fontSize: 10, fontWeight: 500,
                        color: expandedIntent.type === 'try' ? '#4ade80' : '#f87171',
                        background: expandedIntent.type === 'try' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                        border: `1px solid ${expandedIntent.type === 'try' ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
                        borderRadius: 999, padding: '1px 8px 1px 6px',
                        cursor: 'pointer',
                      }}
                    >
                      {expandedIntent.type === 'try'
                        ? <><Flag size={9} />&nbsp;want to go&nbsp;×</>
                        : <><AlertTriangle size={9} />&nbsp;passing&nbsp;×</>
                      }
                    </button>
                  )}
                </div>
                {expandedPlace.address && (
                  <span style={{ fontSize: 10, color: '#64748b' }}>
                    {expandedPlace.address.split(',').slice(0, 2).join(',').trim()}
                  </span>
                )}
              </div>
              <button
                onClick={closeExpanded}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', lineHeight: 1, flexShrink: 0 }}
              >
                <X size={16} />
              </button>
            </div>
            {/* Review groups */}
            <div
              style={{ flex: 1, overflowY: 'scroll', scrollSnapType: 'y proximity', scrollbarWidth: 'none' }}
              className="[&::-webkit-scrollbar]:hidden"
            >
              {expandedUserGroups.length === 0 ? (
                <p style={{ padding: '16px', fontSize: 12, color: '#475569', margin: 0, textAlign: 'center' }}>
                  No reviews yet — tap a light to add yours!
                </p>
              ) : (
                expandedUserGroups.map((group, gIdx) => {
                  const newest = group[0]
                  const isOwn = newest.userId === currentUser?.uid
                  const hasMultiple = group.length > 1
                  const newestColor = TRUSTI_COLORS[newest.rating] || '#9ca3af'
                  const newestTime = newest.createdAt?.seconds ? getTimeAgo(newest.createdAt.seconds * 1000) : ''
                  return (
                    <div key={newest.id} style={{ scrollSnapAlign: 'start', borderTop: gIdx > 0 ? '1px solid rgba(255,255,255,0.15)' : 'none' }}>
                      <div style={{ padding: '10px 14px', paddingBottom: hasMultiple ? 6 : 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#334155', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>
                            {newest.userPhotoURL
                              ? <img src={newest.userPhotoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : newest.userName?.[0]?.toUpperCase()
                            }
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>{newest.userName}</span>
                          <span style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>gave this a</span>
                          <div style={{ width: 14, height: 14, borderRadius: '50%', background: newestColor, boxShadow: `0 0 6px 3px ${newestColor}70`, flexShrink: 0 }} />
                          {newestTime && <span style={{ fontSize: 10, color: '#475569' }}>{hasMultiple ? `Updated · ${newestTime}` : newestTime}</span>}
                          {isOwn && (
                            <button
                              onClick={() => { closeExpanded(); openEditReview(newest) }}
                              style={{ marginLeft: 'auto', fontSize: 10, color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: 'none', cursor: 'pointer', padding: '2px 8px', borderRadius: 4 }}
                            >
                              Edit
                            </button>
                          )}
                        </div>
                        {newest.comment && (
                          <p style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap' }}>{newest.comment}</p>
                        )}
                        {newest.chips?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                            {newest.chips.map(chip => (
                              <span key={chip} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.18)' }}>{chip}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      {group.slice(1).map((rec, rIdx) => {
                        const recColor = TRUSTI_COLORS[rec.rating] || '#9ca3af'
                        const recTime = rec.createdAt?.seconds ? getTimeAgo(rec.createdAt.seconds * 1000) : ''
                        const isOldest = rIdx === group.length - 2
                        return (
                          <div key={rec.id} style={{ borderTop: '1px dashed rgba(255,255,255,0.12)', padding: '8px 14px', paddingBottom: isOldest ? 10 : 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: rec.comment || rec.chips?.length ? 4 : 0 }}>
                              <div style={{ width: 7, height: 7, borderRadius: '50%', background: recColor, flexShrink: 0 }} />
                              <span style={{ fontSize: 10, color: '#475569' }}>{isOldest ? `Original · ${recTime}` : recTime}</span>
                              {isOwn && (
                                <button
                                  onClick={async () => {
                                    if (confirm('Delete this visit?')) {
                                      await deleteRecommendation(rec.id)
                                      onReviewPost?.({ reload: true })
                                    }
                                  }}
                                  style={{ marginLeft: 'auto', fontSize: 11, color: '#f87171', background: 'rgba(248,113,113,0.08)', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}
                                >×</button>
                              )}
                            </div>
                            {rec.comment && (
                              <p style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap' }}>{rec.comment}</p>
                            )}
                            {rec.chips?.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                                {rec.chips.map(chip => (
                                  <span key={chip} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.18)' }}>{chip}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Review banner — slides up from map bottom edge */}
        {review && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 500,
              display: 'flex',
              justifyContent: 'center',
              transform: review.visible ? 'translateY(0)' : 'translateY(100%)',
              transition: 'transform 0.22s cubic-bezier(0.2,0,0,1)',
              pointerEvents: review.visible ? 'auto' : 'none',
            }}
          >
            <div
              style={{ borderTopColor: INTEL_DATA[review?.value]?.borderColor || '#3b82f6' }}
              className="bg-[#0d1b33] rounded-t-2xl p-3 pb-2 w-full shadow-[0_-4px_24px_rgba(0,0,0,0.6)] border-t-4 border-white/20 flex flex-col gap-1.5"
            >
              {/* Chips — above textarea, centered, 2 rows */}
              <div className="flex flex-wrap justify-center gap-1.5">
                {(INTEL_DATA[review?.value]?.chips || []).map(chip => {
                  const isSelected = selectedChips.includes(chip)
                  return (
                    <button
                      key={chip}
                      onClick={() => setSelectedChips(prev => prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip])}
                      style={{ touchAction: 'manipulation' }}
                      className={`px-2.5 py-1 rounded-full text-[12px] font-medium border ${
                        isSelected
                          ? 'bg-[#1a73e8]/30 border-[#1a73e8] text-white'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {chip}
                    </button>
                  )
                })}
              </div>

              {/* Textarea + right column (counter top, Post bottom) */}
              <div className="flex gap-2 items-stretch">
                <textarea
                  rows={2}
                  value={reviewText}
                  onChange={e => {
                    let val = e.target.value;
                    if (reviewText === '' && val !== '') val = '• ' + val;
                    setReviewText(val);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setReviewText(prev => prev + '\n• ');
                    }
                  }}
                  onInput={e => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 192) + 'px';
                  }}
                  placeholder={
                    review?.value === 'green'
                      ? "Some tips friends should know?.."
                      : review?.value === 'yellow' || review?.value === 'red'
                      ? "Why...got intel for friends?"
                      : INTEL_DATA[review?.value]?.placeholder || "Add intel..."
                  }
                  className="flex-1 bg-black/20 rounded-xl p-3 text-white text-sm placeholder:text-slate-500 focus:outline-none resize-none overflow-hidden"
                  style={{ border: '1px solid rgba(255,255,255,0.35)', boxShadow: '0 0 10px rgba(255,255,255,0.12)' }}
                />
                <div className="flex flex-col justify-between items-end shrink-0">
                  <span className="text-[12px] text-slate-400">{reviewText.length}/150</span>
                  <button
                    onClick={() => postReview({ text: reviewText, chips: selectedChips })}
                    style={{ touchAction: 'manipulation' }}
                    className="px-4 py-1.5 rounded-lg bg-blue-500 text-white font-bold text-sm shadow-lg transition-transform active:scale-95"
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Nearby places list - scrollable, 2.5 cards visible on mobile, full on desktop */}
      <div ref={listRef} className="mt-2 overflow-y-auto shrink-0 max-md:h-[210px] md:h-[214px]">
        {loading && places.length === 0 && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-slate-800 rounded-lg p-3 animate-pulse flex gap-3">
                <div className="w-12 h-12 rounded-lg bg-slate-700 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-slate-700 rounded w-3/4" />
                  <div className="h-3 bg-slate-600 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && places.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-6">
            {!isGoogleMapsLoaded()
              ? 'Maps not loaded. Enable billing on Google Cloud to use Places API.'
              : filter === 'reviewed'
              ? 'No trusti reviews in this area yet. Be the first!'
              : filter === 'bookmarked'
              ? 'No saved places in this area. Bookmark places to see them here!'
              : 'No restaurants found nearby. Try a different search.'}
          </p>
        )}

        {places.length > 0 && (
          <div className="space-y-1.5">
            {places.map(place => {
              const placeReviews = trustiRecs.filter(r => r.restaurantPlaceId === place.placeId)
              const counts = getDeduplicatedCounts(placeReviews)
              const myIntent = userIntents.find(i => i.placeId === place.placeId) ?? null
              const dominantColor = placeReviews.length > 0
                ? ['green', 'yellow', 'red'].reduce((best, c) => counts[c] > counts[best] ? c : best)
                : null
              const isBookmarked = bookmarks.some(b => b.placeId === place.placeId)
              const isSelected = selectedPlaceId === place.placeId
              const cuisine = getCuisineLabel(place.types || [])
              const price = getPriceLabel(place.priceLevel)
              const cuisinePriceMeta = [cuisine, price].filter(Boolean).join(' • ')
              const isEditingThis = review?.placeId === place.placeId

              function selectAndPan() {
                if (review && review.placeId !== place.placeId) {
                  // Different card tapped — close banner, don't restore old scroll
                  closeReview({ skipRestore: true })
                }
                setSelectedPlaceId(place.placeId)
                const list = listRef.current
                const cardEl = cardRefs.current[place.placeId]
                if (list && cardEl) {
                  const cardOffsetInList = cardEl.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop
                  list.scrollTo({ top: cardOffsetInList, behavior: 'smooth' })
                }
                if (place.lat != null && place.lng != null && mapInstanceRef.current) {
                  skipNextIdleRef.current = true
                  mapInstanceRef.current.panTo({ lat: place.lat, lng: place.lng })
                  if (mapInstanceRef.current.getZoom() < 15) mapInstanceRef.current.setZoom(15)
                }
              }

              return (
                /* Outer wrapper — flex column so nudge sits flush above the card */
                <div
                  key={place.placeId}
                  data-place-id={place.placeId}
                  ref={el => { cardRefs.current[place.placeId] = el }}
                  style={{ display: 'flex', flexDirection: 'column' }}
                >
                  {/* No-reviews nudge — blue pill, slides in above the card */}
                  <div style={{
                    overflow: 'hidden',
                    maxHeight: noCommentPlaceId === place.placeId ? 36 : 0,
                    transition: 'max-height 0.2s cubic-bezier(0.2,0,0,1)',
                    display: 'flex',
                    justifyContent: 'center',
                  }}>
                    <div style={{
                      background: '#3B82F6',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '7px 16px',
                      borderRadius: '10px 10px 0 0',
                      whiteSpace: 'nowrap',
                    }}>
                      no reviews yet — tap a light or flag to be first!
                    </div>
                  </div>

                  {/* Card */}
                  <div style={{
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: '#263347',
                    border: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
                    transition: 'border-color 0.3s ease',
                  }}
                >
                  {/* Main 60px row */}
                  <div style={{ position: 'relative', display: 'flex', height: 60 }}>

                  {/* READ zone — covers name/address area, stops before the flag icons */}
                  <button
                    onClick={() => {
                      selectAndPan()
                      if (expandedPlaceId === place.placeId) {
                        closeExpanded()
                        return
                      }
                      if (noCommentPlaceId === place.placeId) {
                        setNoCommentPlaceId(null)
                        return
                      }
                      if (placeReviews.length > 0) {
                        setNoCommentPlaceId(null)
                        const wasOpen = !!expandedPlaceId
                        setExpandedPlaceId(place.placeId)
                        if (!wasOpen) {
                          setExpandVisible(false)
                          setTimeout(() => setExpandVisible(true), 10)
                        }
                        // if panel already visible, content swaps in-place without re-animating
                      } else {
                        if (expandedPlaceId) closeExpanded()
                        setNoCommentPlaceId(place.placeId)
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: 0, top: 0, bottom: 0,
                      right: 128,
                      display: 'flex',
                      alignItems: 'flex-start',
                      padding: '7px 10px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ minWidth: 0, width: '100%', overflow: 'hidden' }}>
                      {/* Name · Cuisine — compact single line */}
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'white', wordBreak: 'break-word', lineHeight: 1.25, display: 'flex', alignItems: 'baseline', gap: 3, flexWrap: 'wrap' }}>
                        <span style={{ minWidth: 0 }}>{place.name}</span>
                        {cuisine && <span style={{ fontSize: 10, fontWeight: 400, color: '#64748b', flexShrink: 0 }}>• {cuisine}</span>}
                        {isBookmarked && <span style={{ color: '#a78bfa', fontSize: 9, flexShrink: 0 }}>★</span>}
                      </div>
                      {/* Address */}
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, wordBreak: 'break-word', lineHeight: 1.25 }}>{place.address?.split(',').slice(0, 2).join(',').trim()}</div>
                    </div>
                  </button>

                  {/* Right zone: flag buttons LEFT of traffic lights — single row */}
                  <div
                    style={{
                      position: 'absolute', top: 0, bottom: 0, right: 6, zIndex: 2,
                      display: 'flex', alignItems: 'flex-start', paddingTop: 7, gap: 2,
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Flag buttons — dim when a light review is open */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (myIntent?.type === 'try') {
                          onClearIntent?.(place.placeId)
                        } else {
                          openReview(place, 'flag', 'try')
                        }
                      }}
                      style={{ opacity: review?.placeId === place.placeId && review?.type === 'light' ? 0.35 : 1, transition: 'opacity 0.15s' }}
                      className={`w-6 h-6 flex items-center justify-center transition-colors ${
                        (review?.placeId === place.placeId && review?.value === 'try') || myIntent?.type === 'try'
                          ? 'text-green-400' : 'text-green-700/50'
                      }`}
                    >
                      <Flag size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (myIntent?.type === 'pass') {
                          onClearIntent?.(place.placeId)
                        } else {
                          openReview(place, 'flag', 'pass')
                        }
                      }}
                      style={{ opacity: review?.placeId === place.placeId && review?.type === 'light' ? 0.35 : 1, transition: 'opacity 0.15s' }}
                      className={`w-6 h-6 flex items-center justify-center transition-colors ${
                        (review?.placeId === place.placeId && review?.value === 'pass') || myIntent?.type === 'pass'
                          ? 'text-red-400' : 'text-orange-800/50'
                      }`}
                    >
                      <AlertTriangle size={13} />
                    </button>

                    {/* Slim separator */}
                    <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', flexShrink: 0, marginLeft: 2 }} />

                    {/* Traffic lights — dim when a flag review is open */}
                    <div style={{ opacity: review?.placeId === place.placeId && review?.type === 'flag' ? 0.35 : 1, transition: 'opacity 0.15s' }}>
                      <TrafficLight
                        activeColors={dominantColor ? [dominantColor] : []}
                        size="md"
                        direction="row"
                        onColorClick={(color) => openReview(place, 'light', color)}
                        userSelection={isEditingThis && review?.type === 'light' ? review.value : null}
                        isEditing={isEditingThis}
                        counts={counts}
                      />
                    </div>
                  </div>

                  </div>{/* end main row */}
                  </div>{/* end card */}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {intentModal && (
        <IntentModal
          place={intentModal.place}
          initialType={intentModal.type}
          onClose={() => setIntentModal(null)}
          onSubmit={async ({ type, note }) => {
            await onIntentSubmit?.({ place: intentModal.place, type, note })
            setIntentModal(null)
          }}
        />
      )}

    </div>
  )
}
