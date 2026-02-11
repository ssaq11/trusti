import { useState, useCallback } from 'react'

export function useLocationDetect() {
  const [location, setLocation] = useState({ lat: null, lng: null, zipCode: '', detecting: false, error: null })

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation(prev => ({ ...prev, error: 'Geolocation not supported by your browser' }))
      return
    }
    setLocation(prev => ({ ...prev, detecting: true, error: null }))
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'Accept': 'application/json' } }
          )
          const data = await res.json()
          const zip = data.address?.postcode || ''
          setLocation({ lat: latitude, lng: longitude, zipCode: zip, detecting: false, error: zip ? null : 'Could not determine zip code' })
        } catch {
          setLocation({ lat: latitude, lng: longitude, zipCode: '', detecting: false, error: 'Could not determine zip code' })
        }
      },
      (err) => {
        let message = 'Location access denied'
        if (err.code === 1) message = 'Location permission denied. Check browser settings.'
        else if (err.code === 2) message = 'Location unavailable. Enable location services on your device.'
        else if (err.code === 3) message = 'Location request timed out.'
        setLocation(prev => ({ ...prev, detecting: false, error: message }))
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  }, [])

  const setManualZip = useCallback((zipCode) => {
    setLocation(prev => ({ ...prev, zipCode, lat: null, lng: null, error: null }))
  }, [])

  return { location, detectLocation, setManualZip }
}
