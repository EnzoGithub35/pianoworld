import { useMap } from 'react-leaflet'
import { Crosshair } from 'lucide-react'
import toast from 'react-hot-toast'
import { useGeolocation } from '@/hooks/useGeolocation'

export function LocateMeButton() {
  const map = useMap()
  const { locate, loading } = useGeolocation()

  const handleClick = async () => {
    try {
      const coords = await locate()
      map.setView([coords.lat, coords.lng], 16, { animate: true })
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
      className="absolute right-3 top-3 z-[400] flex h-10 w-10 items-center justify-center rounded-full bg-background text-foreground shadow-md ring-1 ring-border hover:bg-accent disabled:opacity-60"
    >
      <Crosshair className="h-5 w-5" />
    </button>
  )
}
