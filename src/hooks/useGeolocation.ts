import { useCallback, useState } from 'react'
import { logger } from '@/lib/logger'

export type Coords = { lat: number; lng: number }

/**
 * Wrapper React autour de l'API navigator.geolocation.
 *
 * Le throw est délégué à l'appelant, mais le logger trace toujours l'échec :
 *  - PERMISSION_DENIED : warn (cas attendu, utilisateur a refusé)
 *  - autres            : error (anomalie : GPS HS, timeout réseau, etc.)
 */
export function useGeolocation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locate = useCallback((): Promise<Coords> => {
    setError(null)
    if (!('geolocation' in navigator)) {
      const msg = 'Géolocalisation non supportée par ton navigateur'
      logger.warn('geoloc.locate', 'unsupported')
      setError(msg)
      return Promise.reject(new Error(msg))
    }
    setLoading(true)
    return new Promise<Coords>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLoading(false)
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          logger.debug('geoloc.locate', 'success', { accuracy: pos.coords.accuracy })
          resolve(coords)
        },
        (err) => {
          setLoading(false)
          const denied = err.code === err.PERMISSION_DENIED
          const msg = denied
            ? 'Permission refusée — autorise la géolocalisation dans ton navigateur'
            : 'Position indisponible'
          if (denied) {
            logger.warn('geoloc.locate', 'permission denied')
          } else {
            logger.error('geoloc.locate', 'failed', err, { code: err.code })
          }
          setError(msg)
          reject(new Error(msg))
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
      )
    })
  }, [])

  return { locate, loading, error }
}
