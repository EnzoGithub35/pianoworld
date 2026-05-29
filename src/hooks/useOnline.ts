import { useEffect, useState } from 'react'

/**
 * Suit l'état de connexion réseau via les events online/offline du navigateur.
 * Note : ces events détectent surtout les changements drastiques (mode avion,
 * câble débranché). Une vraie détection de disponibilité serveur nécessiterait
 * un ping périodique, hors scope ici.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  )

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return online
}
