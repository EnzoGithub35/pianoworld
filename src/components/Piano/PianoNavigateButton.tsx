import { Navigation } from 'lucide-react'

export function PianoNavigateButton({ lat, lng }: { lat: number; lng: number }) {
  const isApple = /iPhone|iPad|iPod|Mac/.test(navigator.userAgent)
  const url = isApple
    ? `https://maps.apple.com/?daddr=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
    >
      <Navigation className="h-4 w-4" /> Y aller
    </a>
  )
}
