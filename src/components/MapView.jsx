import { useEffect, useRef, useState, useCallback } from 'react'
import { Navigation, RefreshCw, ChevronRight } from 'lucide-react'
import { searchNearby, isGoogleMapsLoaded, isFoodOrDrink } from '../services/places'
import { getDeduplicatedCounts, getDominantRating } from '../utils/ratings'

const DEFAULT_CENTER = { lat: 30.2672, lng: -97.7431 } // Austin, TX fallback
const TRUSTI_COLORS = { red: '#ef4444', yellow: '#eab308', green: '#22c55e' }
const LABEL_ZOOM = 16

const MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#515c6d" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#746855" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1f2835" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#f3d19c" }] },
  { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
]

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
function buildMarkerContent(place, { hasReviews, counts, isBookmarked, isKeywordMatch, showLabel }) {
  const container = document.createElement('div')
  container.style.cssText = 'display:flex;flex-direction:column;align-items:center;'

  const dot = document.createElement('div')
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

export default function MapView({ onPlaceSelect, onClearSearch, searchKeyword, trustiRecs = [], bookmarks = [], filter = 'all' }) {
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
  const centeredKeywordRef = useRef(null)
  const [places, setPlaces] = useState([])
  const [userLocation, setUserLocation] = useState(null)
  const [mapReady, setMapReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [locating, setLocating] = useState(false)
  const [selectedPlaceId, setSelectedPlaceId] = useState(null)

  // Keep refs in sync
  useEffect(() => {
    searchKeywordRef.current = searchKeyword
  }, [searchKeyword])

  useEffect(() => {
    filterRef.current = filter
  }, [filter])

  // Scroll to a place card in the list and highlight it persistently
  const scrollToCard = useCallback((placeId) => {
    setSelectedPlaceId(placeId)
    // Wait a tick for React to re-render the highlight, then scroll
    setTimeout(() => {
      const cardEl = listRef.current?.querySelector(`[data-place-id="${placeId}"]`)
      if (cardEl) cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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

    results.forEach(place => {
      if (place.lat == null || place.lng == null) return

      const placeReviews = reviewsByPlace.get(place.placeId) || []
      const hasReviews = placeReviews.length > 0
      const isBookmarked = bookmarkedSet.has(place.placeId)

      if (AdvancedMarker) {
        const counts = hasReviews ? getDeduplicatedCounts(placeReviews) : null
        const { element, labelEl } = buildMarkerContent(place, {
          hasReviews,
          counts,
          isBookmarked,
          isKeywordMatch: !!place._keywordMatch,
          showLabel,
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
      } else {
        // Fallback: legacy google.maps.Marker (if marker library failed to load)
        let icon
        if (hasReviews) {
          const counts = getDeduplicatedCounts(placeReviews)
          const svgStr = buildReviewDotSvg(counts)
          icon = {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgStr),
            scaledSize: new window.google.maps.Size(20, 20),
            anchor: new window.google.maps.Point(10, 10),
          }
        } else if (isBookmarked) {
          icon = {
            path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
            fillColor: '#8b5cf6',
            fillOpacity: 0.9,
            strokeColor: '#fff',
            strokeWeight: 1,
            scale: 1.2,
            anchor: new window.google.maps.Point(12, 12),
          }
        } else if (place._keywordMatch) {
          icon = {
            path: 'M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z',
            fillColor: '#16a34a',
            fillOpacity: 0.9,
            strokeColor: '#fff',
            strokeWeight: 1,
            scale: 1.4,
            anchor: new window.google.maps.Point(12, 21),
          }
        } else {
          icon = {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: '#9ca3af',
            fillOpacity: 0.7,
            strokeColor: '#fff',
            strokeWeight: 1,
          }
        }

        const marker = new window.google.maps.Marker({
          position: { lat: place.lat, lng: place.lng },
          map,
          title: place.name,
          icon,
        })

        marker.addListener('click', () => {
          scrollToCard(place.placeId)
        })

        markersRef.current.push(marker)
      }
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
        userMarkerRef.current.setPosition(loc)
      } else {
        userMarkerRef.current = new window.google.maps.Marker({
          position: loc,
          map: mapInstanceRef.current,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
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
        const { AdvancedMarkerElement } = await window.google.maps.importLibrary('marker')
        advancedMarkerClassRef.current = AdvancedMarkerElement
      } catch (err) {
        console.warn('Failed to load marker library, falling back to legacy markers:', err)
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
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        keyboardShortcuts: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: MAP_STYLE,
      })

      mapInstanceRef.current = map

      if (center !== DEFAULT_CENTER) {
        userMarkerRef.current = new window.google.maps.Marker({
          position: center,
          map,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
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

      // Clear card highlight when tapping the map background
      map.addListener('click', () => {
        setSelectedPlaceId(null)
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

  return (
    <div className="flex flex-col h-full">
      {/* Map with buttons */}
      <div className="relative shrink-0">
        <div
          ref={mapRef}
          className="w-full h-64 sm:h-72 rounded-xl overflow-hidden bg-slate-800"
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
      </div>

      {/* Nearby places list - scrollable */}
      <div ref={listRef} className="mt-3 flex-1 overflow-y-auto min-h-0">
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
              const hasReviews = placeReviews.length > 0
              const isBookmarked = bookmarks.some(b => b.placeId === place.placeId)

              const isSelected = selectedPlaceId === place.placeId

              return (
                <div
                  key={place.placeId}
                  data-place-id={place.placeId}
                  className={`flex items-center rounded-lg transition-colors ${isSelected ? 'bg-slate-700' : 'bg-slate-800 hover:bg-slate-700'}`}
                  style={{
                    outline: isSelected ? '2px solid #3b82f6' : 'none',
                    outlineOffset: isSelected ? '-2px' : '0',
                    transition: 'outline 0.3s ease, background-color 0.15s ease',
                  }}
                >
                  {/* Tapping the main area pans the map to this place */}
                  <button
                    onClick={() => {
                      if (place.lat != null && place.lng != null && mapInstanceRef.current) {
                        skipNextIdleRef.current = true
                        mapInstanceRef.current.panTo({ lat: place.lat, lng: place.lng })
                        if (mapInstanceRef.current.getZoom() < 15) {
                          mapInstanceRef.current.setZoom(15)
                        }
                      }
                    }}
                    className="flex-1 flex items-center gap-3 p-3 text-left min-w-0"
                  >
                    <div className="w-12 h-12 rounded-lg bg-slate-700 overflow-hidden shrink-0">
                      {place.photoUrl ? (
                        <img src={place.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 text-lg">
                          🍽
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{place.name}</p>
                      <p className="text-xs text-slate-400 truncate">{place.address}</p>
                      {place.rating && (
                        <p className="text-[10px] text-slate-400 mt-0.5">⭐ {place.rating}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasReviews && (
                        <div className="flex items-center gap-1">
                          {['green', 'yellow', 'red'].map(color => {
                            if (counts[color] === 0) return null
                            const bgClass = color === 'green' ? 'bg-green-500' :
                                            color === 'yellow' ? 'bg-yellow-400' : 'bg-red-500'
                            return (
                              <div
                                key={color}
                                className={`w-5 h-5 rounded-full ${bgClass} flex items-center justify-center`}
                              >
                                {counts[color] > 1 && (
                                  <span className="text-white text-[9px] font-bold">{counts[color]}</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {isBookmarked && (
                        <span className="text-purple-500 text-sm" title="Want to go">★</span>
                      )}
                    </div>
                  </button>

                  {/* Detail/review button */}
                  <button
                    onClick={() => onPlaceSelect?.({
                      placeId: place.placeId,
                      name: place.name,
                      address: place.address,
                      lat: place.lat,
                      lng: place.lng,
                    })}
                    className="px-2 py-3 shrink-0 text-slate-500 hover:text-green-500 transition-colors self-stretch flex items-center"
                    title="View details"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
