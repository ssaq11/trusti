// Wait for Google Maps API to load
function waitForGoogle() {
  return new Promise((resolve) => {
    if (window.google?.maps?.places) {
      resolve(true)
      return
    }
    const check = setInterval(() => {
      if (window.google?.maps?.places) {
        clearInterval(check)
        resolve(true)
      }
    }, 100)
    setTimeout(() => {
      clearInterval(check)
      console.error('Google Maps API failed to load. Check your API key and that billing is enabled.')
      resolve(false)
    }, 10000)
  })
}

let autocompleteService = null
let sessionToken = null

function getAutocompleteService() {
  if (!autocompleteService && window.google?.maps?.places) {
    autocompleteService = new window.google.maps.places.AutocompleteService()
  }
  return autocompleteService
}

function getSessionToken() {
  if (!sessionToken && window.google?.maps?.places) {
    sessionToken = new window.google.maps.places.AutocompleteSessionToken()
  }
  return sessionToken
}

function resetSessionToken() {
  sessionToken = null
}

// Search restaurants using Autocomplete
export async function searchRestaurants(queryText, location = null) {
  if (!queryText || queryText.length < 2) return []

  const loaded = await waitForGoogle()
  const service = getAutocompleteService()
  if (!loaded || !service) {
    console.warn('Google Places API not available — is billing enabled on your Google Cloud project?')
    return []
  }

  const request = {
    input: queryText,
    types: ['establishment'],
    sessionToken: getSessionToken(),
  }

  // Bias results toward user's location if available
  if (location?.lat && location?.lng) {
    request.location = new window.google.maps.LatLng(location.lat, location.lng)
    request.radius = 20000 // 20km
  }

  return new Promise((resolve) => {
    service.getPlacePredictions(request, (predictions, status) => {
      if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions) {
        console.warn('Places autocomplete status:', status)
        resolve([])
        return
      }
      resolve(
        predictions.map(p => ({
          placeId: p.place_id,
          name: p.structured_formatting?.main_text || p.description,
          address: p.structured_formatting?.secondary_text || '',
          fullDescription: p.description,
        }))
      )
    })
  })
}

// Get full details for a place
export async function getPlaceDetails(placeId) {
  const loaded = await waitForGoogle()
  if (!loaded || !window.google?.maps?.places) return null

  try {
    resetSessionToken()
    const place = new window.google.maps.places.Place({ id: placeId })
    await place.fetchFields({
      fields: ['displayName', 'formattedAddress', 'addressComponents', 'location', 'types', 'rating', 'photos'],
    })
    const zipComponent = place.addressComponents?.find(c => c.types?.includes('postal_code'))
    return {
      placeId,
      name: place.displayName,
      address: place.formattedAddress,
      zipCode: zipComponent?.longText || '',
      lat: place.location?.lat(),
      lng: place.location?.lng(),
      rating: place.rating,
      photoUrl: place.photos?.[0]?.getURI({ maxWidth: 400 }) || null,
    }
  } catch (err) {
    console.warn('Place.fetchFields failed:', err)
    return null
  }
}

// Search for places within the visible map area
// Uses Place.searchByText when a keyword is provided
// Uses Place.searchNearby for default browsing (no keyword)
export async function searchNearby(mapInstance, location, keyword = '') {
  const loaded = await waitForGoogle()
  if (!loaded || !mapInstance) return []

  const Place = window.google.maps.places.Place
  const bounds = mapInstance.getBounds?.() || null
  const PLACE_FIELDS = ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'photos', 'types']

  function mapPlaceResult(p) {
    return {
      placeId: p.id,
      name: p.displayName,
      address: p.formattedAddress || '',
      lat: p.location?.lat(),
      lng: p.location?.lng(),
      rating: p.rating,
      priceLevel: p.priceLevel,
      photoUrl: p.photos?.[0]?.getURI({ maxWidth: 200 }) || null,
      types: p.types || [],
    }
  }

  function filterToBounds(results) {
    if (!bounds) return results
    return results.filter(r => {
      if (r.lat == null || r.lng == null) return false
      return bounds.contains(new window.google.maps.LatLng(r.lat, r.lng))
    })
  }

  if (keyword) {
    try {
      const request = {
        textQuery: keyword,
        fields: PLACE_FIELDS,
      }
      if (bounds) {
        request.locationBias = bounds
      } else {
        request.locationBias = { lat: location.lat, lng: location.lng, radius: 5000 }
      }
      const { places } = await Place.searchByText(request)
      return (places || []).map(mapPlaceResult).filter(isFoodOrDrink)
    } catch (err) {
      console.warn('Place.searchByText failed:', err)
      return []
    }
  }

  // Default: nearby search for food & drink
  try {
    const center = bounds
      ? { lat: bounds.getCenter().lat(), lng: bounds.getCenter().lng() }
      : { lat: location.lat, lng: location.lng }
    const radius = bounds
      ? Math.max(
          Math.abs(bounds.getNorthEast().lat() - bounds.getSouthWest().lat()) * 111000 / 2,
          500
        )
      : 3000
    const { places } = await Place.searchNearby({
      fields: PLACE_FIELDS,
      locationRestriction: { center, radius: Math.min(radius, 50000) },
      includedPrimaryTypes: ['restaurant', 'cafe', 'bar', 'bakery', 'meal_delivery', 'meal_takeaway', 'night_club'],
      maxResultCount: 20,
    })
    return filterToBounds((places || []).map(mapPlaceResult)).filter(isFoodOrDrink)
  } catch (err) {
    console.warn('Place.searchNearby failed:', err)
    return []
  }
}

// Food & drink place types — everything else (gas stations, stores, etc.) is hidden
const FOOD_DRINK_TYPES = new Set([
  'restaurant', 'cafe', 'bar', 'bakery', 'meal_delivery', 'meal_takeaway',
  'night_club',
])

export function isFoodOrDrink(place) {
  if (!place.types || place.types.length === 0) return true
  return place.types.some(t => FOOD_DRINK_TYPES.has(t))
}

// Check if Google Maps API is loaded
export function isGoogleMapsLoaded() {
  return !!window.google?.maps
}
