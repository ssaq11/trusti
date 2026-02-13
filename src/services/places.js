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

  const div = document.createElement('div')
  const service = new window.google.maps.places.PlacesService(div)

  return new Promise((resolve) => {
    service.getDetails(
      {
        placeId,
        fields: ['name', 'formatted_address', 'address_components', 'geometry', 'types', 'rating', 'photos'],
        sessionToken: getSessionToken(),
      },
      (place, status) => {
        resetSessionToken()
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place) {
          resolve(null)
          return
        }
        const zipComponent = place.address_components?.find(c => c.types.includes('postal_code'))
        resolve({
          placeId,
          name: place.name,
          address: place.formatted_address,
          zipCode: zipComponent?.long_name || '',
          lat: place.geometry?.location?.lat(),
          lng: place.geometry?.location?.lng(),
          rating: place.rating,
          photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 400 }) || null,
        })
      }
    )
  })
}

// Search for places within the visible map area
// Uses textSearch when a keyword is provided (much better results)
// Uses nearbySearch for default browsing (no keyword)
// Always constrains results to the map's visible bounds
export async function searchNearby(mapInstance, location, keyword = '') {
  const loaded = await waitForGoogle()
  if (!loaded || !mapInstance) return []

  // Use a detached div instead of the map instance to prevent
  // PlacesService from auto-panning/zooming the map to show results
  const div = document.createElement('div')
  const service = new window.google.maps.places.PlacesService(div)
  const latLng = new window.google.maps.LatLng(location.lat, location.lng)
  const bounds = mapInstance.getBounds?.() || null

  function mapResult(r) {
    return {
      placeId: r.place_id,
      name: r.name,
      address: r.formatted_address || r.vicinity || '',
      lat: r.geometry?.location?.lat(),
      lng: r.geometry?.location?.lng(),
      rating: r.rating,
      priceLevel: r.price_level,
      photoUrl: r.photos?.[0]?.getUrl({ maxWidth: 200 }) || null,
      types: r.types,
    }
  }

  // Filter results to only include places within visible map bounds
  function filterToBounds(results) {
    if (!bounds) return results
    return results.filter(r => {
      if (r.lat == null || r.lng == null) return false
      return bounds.contains(new window.google.maps.LatLng(r.lat, r.lng))
    })
  }

  if (keyword) {
    // Keyword search: bias to visible map bounds, return all results
    // (let caller decide whether to filter or pan to fit)
    const request = {
      query: keyword,
    }
    if (bounds) {
      request.bounds = bounds
    } else {
      request.location = latLng
      request.radius = 5000
    }

    return new Promise((resolve) => {
      service.textSearch(request, (results, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results) {
          console.warn('Text search status:', status)
          resolve([])
          return
        }
        resolve(filterToBounds(results.map(mapResult)))
      })
    })
  }

  // Default: nearby search for all food & drink using map bounds
  const request = {}
  if (bounds) {
    request.bounds = bounds
  } else {
    request.location = latLng
    request.radius = 3000
  }
  request.keyword = 'restaurant | cafe | bar | coffee | bakery | food'

  return new Promise((resolve) => {
    service.nearbySearch(request, (results, status) => {
      if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results) {
        console.warn('Nearby search status:', status)
        resolve([])
        return
      }
      resolve(filterToBounds(results.map(mapResult)))
    })
  })
}

// Check if Google Maps API is loaded
export function isGoogleMapsLoaded() {
  return !!window.google?.maps
}
