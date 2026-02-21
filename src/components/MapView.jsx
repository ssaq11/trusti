import { useEffect, useRef, useState, useCallback } from 'react'
import { Navigation, RefreshCw, Flag, Ban, AlertTriangle } from 'lucide-react'
import { searchNearby, isGoogleMapsLoaded, isFoodOrDrink } from '../services/places'
import { getDeduplicatedCounts, getDominantRating } from '../utils/ratings'
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
  container.style.cssText = 'display:flex;flex-direction:column;align-items:center;'

  const dot = document.createElement('div')
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
  if (intentType) {
    dot.style.position = 'relative'
    const intentOverlay = document.createElement('div')
    intentOverlay.className = 'trusti-intent-overlay'
    intentOverlay.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;'
    const svgEl = dot.querySelector('svg')
    const iw = svgEl ? parseInt(svgEl.getAttribute('width')) : 16
    const ih = svgEl ? parseInt(svgEl.getAttribute('height')) : 16
    intentOverlay.innerHTML = buildIntentOverlaySvg(intentType, iw, ih)
    dot.appendChild(intentOverlay)
  }

  container.appendChild(dot)

  const label = document.createElement('div')
  label.textContent = place.name
  label.style.cssText = 'font-size:11px;font-weight:500;color:#fff;background:rgba(30,41,59,0.85);padding:2px 6px;border-radius:4px;white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis;margin-top:2px;pointer-events:none;'
  if (!showLabel) label.style.display = 'none'
  container.appendChild(label)

  return { element: container, labelEl: label }
}

function buildIntentOverlaySvg(intentType, w, h) {
  if (intentType === 'try') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="9" fill="rgba(0,0,0,0.55)"/>
      <line x1="6" y1="3" x2="6" y2="17" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M6 3 L16 7 L6 11 Z" fill="#22c55e"/>
    </svg>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="9" fill="rgba(239,68,68,0.88)"/>
    <circle cx="10" cy="10" r="9" fill="none" stroke="white" stroke-width="1.5"/>
    <line x1="5" y1="5" x2="15" y2="15" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </svg>`
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

export default function MapView({ onPlaceSelect, onAddReview, onIntentSubmit, userIntents = [], onClearSearch, searchKeyword, trustiRecs = [], bookmarks = [], filter = 'all' }) {
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
  const [review, setReview] = useState(null) // null | { placeId, type:'light'|'flag', value, visible }
  const [reviewText, setReviewText] = useState('')
  const [selectedChips, setSelectedChips] = useState([])
  const cardRefs = useRef({})
  const savedScrollRef = useRef(0)

  // Highlight the selected marker — scale up dot + border ring
  useEffect(() => {
    // Reset all markers
    markersRef.current.forEach(m => {
      const dotEl = m.content?.firstChild
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
    const dotEl = marker?.content?.firstChild
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

  // Update intent overlays on existing markers immediately when intents change
  useEffect(() => {
    const intentLookup = new Map(userIntents.map(i => [i.placeId, i.type]))
    markersRef.current.forEach((marker, idx) => {
      const place = places[idx]
      if (!place) return
      const dot = marker.content?.firstChild
      if (!dot) return
      const existing = dot.querySelector('.trusti-intent-overlay')
      if (existing) existing.remove()
      const intentType = intentLookup.get(place.placeId)
      if (intentType) {
        dot.style.position = 'relative'
        const overlay = document.createElement('div')
        overlay.className = 'trusti-intent-overlay'
        overlay.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;'
        const svgEl = dot.querySelector('svg')
        const iw = svgEl ? parseInt(svgEl.getAttribute('width')) : 16
        const ih = svgEl ? parseInt(svgEl.getAttribute('height')) : 16
        overlay.innerHTML = buildIntentOverlaySvg(intentType, iw, ih)
        dot.appendChild(overlay)
      }
    })
  }, [userIntents, places])

  // Scroll to a place card in the list so it sits at the top of the visible area
  const scrollToCard = useCallback((placeId) => {
    setSelectedPlaceId(placeId)
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
          }
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

      // Tap on map dismisses the inline review banner
      map.addListener('click', () => {
        setReview(r => r ? { ...r, visible: false } : null)
        setTimeout(() => setReview(null), 220)
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

  // Re-search when Firebase data (trustiRecs/bookmarks) arrives after map is ready
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return
    const c = mapInstanceRef.current.getCenter()
    searchAtLocationRef.current?.({ lat: c.lat(), lng: c.lng() }, searchKeywordRef.current || '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, trustiRecs, bookmarks])

  function openReview(place, type, value) {
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
      await onAddReview?.({ ...placeData, rating: review.value })
    } else {
      await onIntentSubmit?.({ place: placeData, type: review.value, note: '' })
    }
    closeReview()
  }

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
              className="bg-[#0d1b33] rounded-t-2xl p-4 w-full shadow-[0_-4px_24px_rgba(0,0,0,0.6)] border-t-4 border-white/20 flex flex-col gap-3"
            >
              {/* Selected chips row */}
              {selectedChips.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedChips.map(chip => (
                    <button
                      key={chip}
                      onClick={() => setSelectedChips(prev => prev.filter(c => c !== chip))}
                      className="px-3 py-1.5 rounded-full text-[13px] font-medium flex items-center gap-1.5 bg-white/15 border border-white/30 text-white"
                    >
                      {chip} <span className="text-white/50 text-xs">×</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Unselected chips - horizontal scroll */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {(INTEL_DATA[review?.value]?.chips || [])
                  .filter(chip => !selectedChips.includes(chip))
                  .map(chip => (
                    <button
                      key={chip}
                      onClick={() => setSelectedChips(prev => [...prev, chip])}
                      className="px-3 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 flex-shrink-0"
                    >
                      {chip}
                    </button>
                  ))}
              </div>

              {/* Textarea */}
              <textarea
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                onInput={e => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 144) + 'px';
                }}
                placeholder={INTEL_DATA[review?.value]?.placeholder || "Add intel..."}
                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                style={{ minHeight: '96px' }}
              />

              {/* Slip-protection overlay behind chips — tight, not full map */}
              <div className="absolute bottom-[160px] left-0 right-0 h-10 z-[499]" />

              {/* Actions */}
              <div className="flex justify-between items-center pt-1">
                <button onClick={closeReview} className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 text-sm font-medium hover:text-white transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => postReview({ text: reviewText, chips: selectedChips })}
                  className="px-6 py-2 rounded-lg bg-blue-500 text-white font-bold text-sm shadow-lg transition-transform active:scale-95"
                >
                  Post
                </button>
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
                /* Outer is position:relative so divider + right zone can be
                   absolute. Left half button fills 100% width so text flows
                   freely across the full card. The right zone sits on top (no
                   background) and the divider is an absolute 1px line. */
                <div
                  key={place.placeId}
                  data-place-id={place.placeId}
                  ref={el => { cardRefs.current[place.placeId] = el }}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    height: 72,
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: '#263347',
                    outline: isSelected ? '2px solid #3b82f6' : 'none',
                    outlineOffset: -2,
                    transition: 'outline 0.3s ease',
                  }}
                >
                  {/* LEFT HALF button — spans full card width so text flows freely */}
                  <button
                    onClick={selectAndPan}
                    style={{
                      flex: '1 1 0',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 10px',
                      textAlign: 'left',
                      background: '#263347',
                      border: 'none',
                      cursor: 'pointer',
                      minWidth: 0,
                    }}
                  >
                    <div style={{ minWidth: 0, width: '100%' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'white', wordBreak: 'break-word', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ minWidth: 0 }}>{place.name}</span>
                        {isBookmarked && <span style={{ color: '#a78bfa', fontSize: 10, flexShrink: 0 }}>★</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, wordBreak: 'break-word', lineHeight: 1.3 }}>{place.address?.split(',').slice(0, 2).join(',').trim()}</div>
                      {cuisinePriceMeta && (
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{cuisinePriceMeta}</div>
                      )}
                      {place.rating && (
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 11, height: 11, borderRadius: '50%', background: 'white', color: '#4285F4', fontSize: 7, fontWeight: 900, fontFamily: 'Arial,sans-serif', flexShrink: 0 }}>G</span>
                          {place.rating}
                        </div>
                      )}
                    </div>
                  </button>

                  {/* 1px divider — absolute so it doesn't consume flex space */}
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.12)', pointerEvents: 'none' }} />

                  {/* RIGHT ZONE — absolute, no background, sits on top of text.
                      Traffic light + side-by-side flags. Both tap and pan. */}
                  <div
                    onClick={selectAndPan}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      padding: '3px 6px',
                      cursor: 'pointer',
                    }}
                  >
                    {/* Try / Pass flags — dims (not locked) when a light is active */}
                    <div
                      style={{
                        position: 'absolute', top: 4, left: 6, display: 'flex', gap: 6,
                        opacity: review?.placeId === place.placeId && review?.type === 'light' ? 0.35 : 1,
                        transition: 'opacity 0.15s',
                        alignItems: 'center',
                        height: 32
                      }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="relative inline-flex flex-col items-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); openReview(place, 'flag', 'try') }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            review?.placeId === place.placeId && review?.value === 'try'
                              ? 'bg-green-500/20 text-green-400'
                              : 'text-gray-500 bg-transparent'
                          }`}
                        >
                          <Flag size={15} />
                        </button>
                        {review?.placeId === place.placeId && review?.value === 'try' && (
                          <div className="absolute top-full mt-1.5 left-0 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide bg-slate-800/60 backdrop-blur-lg border border-white/20 shadow-[0_4px_30px_rgba(0,0,0,0.5)] text-green-400 whitespace-nowrap z-50 pointer-events-none">
                            want to go!
                          </div>
                        )}
                      </div>

                      <div className="relative inline-flex flex-col items-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); openReview(place, 'flag', 'pass') }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            review?.placeId === place.placeId && review?.value === 'pass'
                              ? 'bg-red-500/20 text-red-400'
                              : 'text-gray-500 bg-transparent'
                          }`}
                        >
                          <AlertTriangle size={15} />
                        </button>
                        {review?.placeId === place.placeId && review?.value === 'pass' && (
                          <div className="absolute top-full mt-1.5 left-0 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide bg-slate-800/60 backdrop-blur-lg border border-white/20 shadow-[0_4px_30px_rgba(0,0,0,0.5)] text-red-400 whitespace-nowrap z-50 pointer-events-none">
                            heard some things...
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Traffic light — dims (not locked) when a flag is active */}
                  <div
                    style={{
                      position: 'absolute', top: 4, right: 6, zIndex: 2,
                      opacity: review?.placeId === place.placeId && review?.type === 'flag' ? 0.35 : 1,
                      transition: 'opacity 0.15s',
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <TrafficLight
                      activeColors={['green', 'yellow', 'red'].filter(c => counts[c] > 0)}
                      size="card-h"
                      direction="row"
                      onColorClick={(color) => openReview(place, 'light', color)}
                      userSelection={isEditingThis && review?.type === 'light' ? review.value : null}
                      isEditing={isEditingThis}
                    />
                  </div>
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
