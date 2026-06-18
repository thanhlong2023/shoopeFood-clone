import { useEffect, useRef, useState } from 'react'
import type { DriverLocation } from '../types'

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const p = 0.017453292519943295 // Math.PI / 180
  const c = Math.cos
  const a = 0.5 - c((lat2 - lat1) * p) / 2 + 
            c(lat1 * p) * c(lat2 * p) * 
            (1 - c((lon2 - lon1) * p)) / 2
  return 12742 * Math.asin(Math.sqrt(a)) // 2 * R; R = 6371 km
}

export function useOrderSimulation(
  initialDriverLocation: DriverLocation | null,
  targetLat?: number | null,
  targetLng?: number | null,
  isActive: boolean = false
) {
  const [simulatedLocation, setSimulatedLocation] = useState<DriverLocation | null>(initialDriverLocation)
  const realLocationRef = useRef<DriverLocation | null>(initialDriverLocation)

  // Sync with real location when it updates from Socket/API, but only if it's the first time or a significant change
  useEffect(() => {
    if (initialDriverLocation) {
      realLocationRef.current = initialDriverLocation
      setSimulatedLocation((currentSimulated) => {
        if (!currentSimulated) {
          return initialDriverLocation
        }
        const dist = distanceKm(
          currentSimulated.latitude,
          currentSimulated.longitude,
          initialDriverLocation.latitude,
          initialDriverLocation.longitude
        )
        // If the server location is significantly different (e.g. > 0.2km), sync to it.
        // Otherwise, let the local simulation run smoothly.
        if (dist > 0.2) {
          return initialDriverLocation
        }
        return currentSimulated
      })
    }
  }, [initialDriverLocation])

  useEffect(() => {
    if (!isActive || !targetLat || !targetLng) {
      return
    }

    const timer = setInterval(() => {
      setSimulatedLocation((prev) => {
        const current = prev || realLocationRef.current
        if (!current) return prev

        const dist = distanceKm(current.latitude, current.longitude, targetLat, targetLng)
        if (dist <= 0.05) {
          // Reached target
          return current
        }

        // Move 1km towards target
        // If distance is less than 1km, just jump to target
        const fraction = dist <= 1.0 ? 1.0 : 1.0 / dist

        const newLat = current.latitude + (targetLat - current.latitude) * fraction
        const newLng = current.longitude + (targetLng - current.longitude) * fraction

        return {
          ...current,
          latitude: newLat,
          longitude: newLng,
        }
      })
    }, 10000)

    return () => clearInterval(timer)
  }, [isActive, targetLat, targetLng])

  return simulatedLocation
}
