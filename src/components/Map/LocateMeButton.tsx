import { useEffect, useState } from 'react'
import { useMap } from 'react-leaflet'
import { Crosshair } from 'lucide-react'
import toast from 'react-hot-toast'
import { useGeolocation } from '@/hooks/useGeolocation'

const LOCATE_USED_KEY = 'pianoworld:locate-used'

/**
 * Bouton "Me localiser" en haut à droite de la carte.
 *
 * Avant la première utilisation : affichage étendu avec label "Me localiser"
 * pour la découvrabilité (le newcomer qui débarque hors Rennes voit une carte
 * vide et doit comprendre comment se centrer chez lui). Après le premier clic
 * réussi, on revient à l'icône seule pour gagner de l'espace écran.
 */
export function LocateMeButton() {
  const map = useMap()
  const { locate, loading } = useGeolocation()
  const [hasUsed, setHasUsed] = useState(true)

  useEffect(() => {
    try {
      setHasUsed(!!localStorage.getItem(LOCATE_USED_KEY))
    } catch {
      // localStorage indispo : on assume "déjà vu" pour ne pas spam
    }
  }, [])

  const handleClick = async () => {
    try {
      const coords = await locate()
      map.setView([coords.lat, coords.lng], 16, { animate: true })
      try {
        localStorage.setItem(LOCATE_USED_KEY, '1')
        setHasUsed(true)
      } catch {
        // best-effort
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Position indisponible'
      toast.error(message)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-label="Me localiser"
      className={
        hasUsed
          ? 'absolute right-3 top-3 z-[400] flex h-10 w-10 items-center justify-center rounded-full bg-background text-foreground shadow-md ring-1 ring-border hover:bg-accent disabled:opacity-60'
          : 'absolute right-3 top-3 z-[400] flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg ring-1 ring-primary/60 hover:bg-primary/90 disabled:opacity-60'
      }
    >
      <Crosshair className="h-5 w-5" />
      {!hasUsed && <span>Me localiser</span>}
    </button>
  )
}
