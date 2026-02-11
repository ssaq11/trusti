import { useEffect, useRef, useState, useCallback } from 'react'
import { Navigation, RefreshCw } from 'lucide-react'
import { searchNearby, isGoogleMapsLoaded } from '../services/places'
import { getDeduplicatedCounts, getDominantRating } from '../utils/ratings'

const DEFAULT_CENTER = { lat: 30.2672, lng: -97.7431 } // Austin, TX fallback
const TRUSTI_COLORS = { red: '#ef4444', yellow: '#eab308', green: '#22c55e' }

// Build an SVG marker for review counts
// - Single dominant color: filled circle + thin ring in secondary color
// - Even 2-way split: half-and-half circle
// - Even 3-way split: thirds
function buildReviewMarkerIcon(counts) {
  const colors = ['green', 'yellow', 'red']
  const active = colors.filter(c => counts[c] > 0)
  const total = active.reduce((sum, c) => sum + counts[c], 0)
  const size = 28
  const r = 11 // main radius
  const cx = size / 2
  const cy = size / 2

  let svg

  if (active.length <= 1) {
    // Single color — simple filled circle with white border
    const color = active[0] || 'green'
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${TRUSTI_COLORS[color]}" stroke="#fff" stroke-width="2.5"/>
    </svg>`
  } else {
    // Check if there's a dominant color
    const sorted = [...active].sort((a, b) => counts[b] - counts[a])
    const isDominant = counts[sorted[0]] > counts[sorted[1]]

    if (isDominant) {
      // Dominant color fills circle, ring shows secondary colors
      const dominant = sorted[0]
      const secondaries = sorted.slice(1)
      // Ring: split evenly among secondary colors
      const ringWidth = 3
      const ringR = r + 1
      let ringParts = ''
      if (secondaries.length === 1) {
        ringParts = `<circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" stroke="${TRUSTI_COLORS[secondaries[0]]}" stroke-width="${ringWidth}"/>`
      } else {
        // Two secondary colors — split ring in half
        ringParts = `
          <path d="M ${cx} ${cy - ringR} A ${ringR} ${ringR} 0 0 1 ${cx} ${cy + ringR}" fill="none" stroke="${TRUSTI_COLORS[secondaries[0]]}" stroke-width="${ringWidth}"/>
          <path d="M ${cx} ${cy + ringR} A ${ringR} ${ringR} 0 0 1 ${cx} ${cy - ringR}" fill="none" stroke="${TRUSTI_COLORS[secondaries[1]]}" stroke-width="${ringWidth}"/>
        `
      }
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        ${ringParts}
        <circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="${TRUSTI_COLORS[dominant]}" stroke="#fff" stroke-width="1.5"/>
      </svg>`
    } else {
      // Even split — pie chart segments
      const segments = active.map(c => ({ color: c, value: counts[c] }))
      let paths = ''
      let startAngle = -Math.PI / 2 // start at top
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
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        ${paths}
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="2.5"/>
      </svg>`
    }
  }

  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new window.google.maps.Size(size, size),
    anchor: new window.google.maps.Point(size / 2, size / 2),
  }
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

export default function MapView({ onPlaceSelect, searchKeyword, trustiRecs = [], bookmarkedPlaceIds = [] }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const userMarkerRef = useRef(null)
  const searchKeywordRef = useRef(searchKeyword)
  const idleTimerRef = useRef(null)
  const skipNextIdleRef = useRef(false)
  const [places, setPlaces] = useState([])
  const [userLocation, setUserLocation] = useState(null)
  const [mapReady, setMapReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [locating, setLocating] = useState(false)

  // Keep keyword ref in sync
  useEffect(() => {
    searchKeywordRef.current = searchKeyword
  }, [searchKeyword])

  // Search at a given center with a given keyword
  const searchAtLocation = useCallback(async (center, keyword) => {
    if (!mapInstanceRef.current) return

    setLoading(true)
    let results = await searchNearby(mapInstanceRef.current, center, keyword || '')

    // For keyword searches: show only results within visible bounds.
    // If none are in view, pan/zoom the map to show the nearest ones.
    if (keyword && results.length > 0) {
      const bounds = mapInstanceRef.current.getBounds()
      if (bounds) {
        const inView = results.filter(r =>
          r.lat != null && r.lng != null &&
          bounds.contains(new window.google.maps.LatLng(r.lat, r.lng))
        )
        if (inView.length > 0) {
          // Found results in view — only show those
          results = inView
        } else {
          // Nothing in view — pan map to show the nearest results
          const fitBounds = new window.google.maps.LatLngBounds()
          results.forEach(r => {
            if (r.lat != null && r.lng != null) fitBounds.extend({ lat: r.lat, lng: r.lng })
          })
          skipNextIdleRef.current = true
          mapInstanceRef.current.fitBounds(fitBounds, 40)
          const listener = mapInstanceRef.current.addListener('idle', () => {
            listener.remove()
            if (mapInstanceRef.current.getZoom() > 16) {
              skipNextIdleRef.current = true
              mapInstanceRef.current.setZoom(16)
            }
          })
        }
      }
    }

    setPlaces(results)

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

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

    // Build a set of bookmarked IDs for quick lookup
    const bookmarkedSet = new Set(bookmarkedPlaceIds)

    results.forEach(place => {
      const placeReviews = reviewsByPlace.get(place.placeId) || []
      const hasReviews = placeReviews.length > 0
      const isBookmarked = bookmarkedSet.has(place.placeId)

      // Determine marker icon based on review ratings (one vote per user)
      let icon
      if (hasReviews) {
        const counts = getDeduplicatedCounts(placeReviews)
        icon = buildReviewMarkerIcon(counts)
      } else if (isBookmarked) {
        // Bookmarked: star-like marker
        icon = {
          path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
          fillColor: '#8b5cf6',
          fillOpacity: 0.9,
          strokeColor: '#fff',
          strokeWeight: 1,
          scale: 1.2,
          anchor: new window.google.maps.Point(12, 12),
        }
      } else if (keyword) {
        // Search result: visible green pin marker
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
        // Default browsing: small gray dot
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
        map: mapInstanceRef.current,
        title: place.name,
        icon,
      })

      marker.addListener('click', () => {
        onPlaceSelect?.({
          placeId: place.placeId,
          name: place.name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
        })
      })

      markersRef.current.push(marker)
    })

    setLoading(false)
  }, [trustiRecs, bookmarkedPlaceIds, onPlaceSelect])

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

      const keyword = searchKeywordRef.current
      await searchAtLocation(loc, isZipCode(keyword) ? '' : keyword)
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
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        keyboardShortcuts: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
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

      // Auto-refresh places when map stops moving (drag, zoom, etc.)
      // Always searches what's visible on the map (no keyword = browse mode)
      // If user has a keyword active, re-search with that keyword but don't re-fit
      map.addListener('idle', () => {
        if (!mounted) return
        // Skip idle events triggered by programmatic pans (keyword search, goToMyLocation)
        if (skipNextIdleRef.current) {
          skipNextIdleRef.current = false
          return
        }
        // Debounce to avoid rapid-fire searches
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
        idleTimerRef.current = setTimeout(() => {
          const c = map.getCenter()
          // Re-search with the active keyword (or empty for browse mode)
          searchAtLocation({ lat: c.lat(), lng: c.lng() }, searchKeywordRef.current || '')
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

  // Search when keyword changes from the search bar
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return

    async function doSearch() {
      let keyword = searchKeyword || ''

      if (keyword && isZipCode(keyword)) {
        setLoading(true)
        const location = await geocodeLocation(keyword)
        if (location) {
          skipNextIdleRef.current = true
          mapInstanceRef.current.panTo(location)
          mapInstanceRef.current.setZoom(15)
          await searchAtLocation(location, '')
          return
        }
      }

      skipNextIdleRef.current = true
      const c = mapInstanceRef.current.getCenter()
      // Search within current view first, don't zoom out
      await searchAtLocation({ lat: c.lat(), lng: c.lng() }, keyword)
    }

    doSearch()
  }, [mapReady, searchKeyword, searchAtLocation])

  return (
    <div className="flex flex-col h-full">
      {/* Map with buttons */}
      <div className="relative shrink-0">
        <div
          ref={mapRef}
          className="w-full h-64 sm:h-72 rounded-xl overflow-hidden bg-gray-200"
        >
          {!isGoogleMapsLoaded() && (
            <div className="flex items-center justify-center h-full text-gray-400 text-xs">
              Loading map...
            </div>
          )}
        </div>

        {/* My Location button */}
        {mapReady && (
          <button
            onClick={goToMyLocation}
            disabled={locating}
            className="absolute bottom-3 left-3 bg-white rounded-lg shadow-md p-2 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50"
            title="Go to my location"
          >
            <Navigation
              size={18}
              className={`text-green-600 ${locating ? 'animate-pulse' : ''}`}
              fill={userLocation ? '#16a34a' : 'none'}
            />
          </button>
        )}

        {loading && (
          <div className="absolute bottom-3 right-3 bg-white rounded-lg shadow-md p-2">
            <RefreshCw size={16} className="text-green-600 animate-spin" />
          </div>
        )}
      </div>

      {/* Nearby places list - scrollable */}
      <div className="mt-3 flex-1 overflow-y-auto min-h-0">
        {loading && places.length === 0 && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-lg p-3 animate-pulse flex gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && places.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-6">
            {isGoogleMapsLoaded()
              ? 'No restaurants found nearby. Try a different search.'
              : 'Maps not loaded. Enable billing on Google Cloud to use Places API.'}
          </p>
        )}

        {places.length > 0 && (
          <div className="space-y-1.5">
            {places.map(place => {
              const placeReviews = trustiRecs.filter(r => r.restaurantPlaceId === place.placeId)
              const counts = getDeduplicatedCounts(placeReviews)
              const hasReviews = placeReviews.length > 0
              const isBookmarked = bookmarkedPlaceIds.includes(place.placeId)

              return (
                <button
                  key={place.placeId}
                  onClick={() => onPlaceSelect?.({
                    placeId: place.placeId,
                    name: place.name,
                    address: place.address,
                    lat: place.lat,
                    lng: place.lng,
                  })}
                  className="w-full flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                    {place.photoUrl ? (
                      <img src={place.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg">
                        🍽
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{place.name}</p>
                    <p className="text-xs text-gray-400 truncate">{place.address}</p>
                    {place.rating && (
                      <p className="text-[10px] text-gray-400 mt-0.5">⭐ {place.rating}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Stoplight dots with counts */}
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
                    {/* Bookmark indicator */}
                    {isBookmarked && (
                      <span className="text-purple-500 text-sm" title="Want to go">★</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
