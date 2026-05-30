import { Outlet } from 'react-router-dom'
import { NavBar } from './NavBar'
import { CookieBanner } from './CookieBanner'

/**
 * Shell de l'application post-login : Outlet + NavBar.
 *
 * Le CookieBanner est monté ici (et pas dans App.tsx) pour qu'il n'apparaisse
 * que quand l'utilisateur entre effectivement dans l'app — pas sur les écrans
 * d'auth ou la page légale publique. Conforme aux recommandations CNIL :
 * informer au moment où le service est utilisé.
 */
export function AppShell() {
  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 overflow-hidden pb-16">
        <Outlet />
      </main>
      <NavBar />
      <CookieBanner />
    </div>
  )
}
