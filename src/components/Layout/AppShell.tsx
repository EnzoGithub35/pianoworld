import { Outlet } from 'react-router-dom'
import { NavBar } from './NavBar'
import { CookieBanner } from './CookieBanner'
import { useOnline } from '@/hooks/useOnline'
import { cn } from '@/lib/utils'

/**
 * Shell de l'application post-login : Outlet + NavBar.
 *
 * Le CookieBanner est monté ici (et pas dans App.tsx) pour qu'il n'apparaisse
 * que quand l'utilisateur entre effectivement dans l'app — pas sur les écrans
 * d'auth ou la page légale publique. Conforme aux recommandations CNIL :
 * informer au moment où le service est utilisé.
 *
 * Quand offline : on pousse le main vers le bas (`pt-9`) pour ne pas que
 * l'OfflineBanner fixed top recouvre les headers sticky des pages
 * (PianoPage, UserPage, etc.).
 */
export function AppShell() {
  const online = useOnline()
  return (
    <div className="flex h-full flex-col">
      <main className={cn('flex-1 overflow-hidden pb-16', !online && 'pt-9')}>
        <Outlet />
      </main>
      <NavBar />
      <CookieBanner />
    </div>
  )
}
