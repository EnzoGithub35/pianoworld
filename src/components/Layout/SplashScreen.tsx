import { Loader2 } from 'lucide-react'
import { Logo } from './Logo'

/**
 * Écran d'attente initial : logo + spinner. Affiché tant que la session
 * Supabase n'est pas résolue. Sécurisé par un timer de 8s côté AuthContext.
 */
export function SplashScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-background animate-fade-in">
      <Logo className="h-16 w-16" />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement…
      </div>
    </div>
  )
}
