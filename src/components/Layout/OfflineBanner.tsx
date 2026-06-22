import { WifiOff } from 'lucide-react'
import { useOnline } from '@/hooks/useOnline'

/**
 * Banner fixé en haut quand le réseau est coupé. Reste visible jusqu'au retour
 * en ligne. Ne s'affiche jamais quand online → 0 impact en usage normal.
 */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div
      className="animate-fade-in fixed inset-x-0 top-0 z-[1500] flex items-center justify-center gap-2 bg-destructive/95 px-4 pb-2 pt-safe-banner-top text-xs font-medium text-destructive-foreground shadow-md backdrop-blur"
      role="status"
    >
      <WifiOff className="h-3.5 w-3.5" />
      Pas de connexion — tu peux consulter mais pas ajouter de pianos
    </div>
  )
}
