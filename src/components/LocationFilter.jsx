import { useState, useEffect, useRef } from 'react'
import { MapPin, Locate, X } from 'lucide-react'
import { useLocationDetect } from '../hooks/useLocation'

export default function LocationFilter({ onLocationChange }) {
  const { location, detectLocation, setManualZip } = useLocationDetect()
  const [inputValue, setInputValue] = useState('')
  const prevZipRef = useRef('')

  // When auto-detect completes with a zip code, propagate it
  useEffect(() => {
    if (location.zipCode && location.lat && location.zipCode !== prevZipRef.current) {
      prevZipRef.current = location.zipCode
      setInputValue(location.zipCode)
      onLocationChange(location.zipCode)
    }
  }, [location.zipCode, location.lat, onLocationChange])

  function handleSubmit(e) {
    e.preventDefault()
    if (inputValue.trim()) {
      setManualZip(inputValue.trim())
      onLocationChange(inputValue.trim())
    }
  }

  function handleClear() {
    setInputValue('')
    prevZipRef.current = ''
    setManualZip('')
    onLocationChange('')
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by zip code — type & press Enter"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full pl-8 pr-8 py-2 rounded-lg bg-white border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          {inputValue && (
            <button type="button" onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={detectLocation}
          disabled={location.detecting}
          className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-green-600 hover:border-green-300 transition-colors disabled:opacity-50"
          title="Detect my location"
        >
          <Locate size={16} className={location.detecting ? 'animate-pulse' : ''} />
        </button>
      </form>
      {location.error && (
        <p className="text-[10px] text-red-400 mt-1 px-1">Location access denied. Enter a zip code manually.</p>
      )}
    </div>
  )
}
