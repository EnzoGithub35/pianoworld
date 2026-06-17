import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { AppShell } from '@/components/Layout/AppShell'
import { SplashScreen } from '@/components/Layout/SplashScreen'
import { OfflineBanner } from '@/components/Layout/OfflineBanner'
import { RequireAdmin } from '@/components/Layout/RequireAdmin'

/**
 * Pages chargées paresseusement pour réduire le bundle initial.
 * - MapPage et PianoPage embarquent Leaflet → gros gain à isoler.
 * - AuthPage est sur le chemin critique (1ère visite), mais chargée seule
 *   sans le reste, donc plus rapide quand non connecté.
 */
const AuthPage = lazy(() =>
  import('@/pages/AuthPage').then((m) => ({ default: m.AuthPage }))
)
const MapPage = lazy(() =>
  import('@/pages/MapPage').then((m) => ({ default: m.MapPage }))
)
const PianoPage = lazy(() =>
  import('@/pages/PianoPage').then((m) => ({ default: m.PianoPage }))
)
const Dashboard = lazy(() =>
  import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard }))
)
const SearchPage = lazy(() =>
  import('@/pages/SearchPage').then((m) => ({ default: m.SearchPage }))
)
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)
const UserPage = lazy(() =>
  import('@/pages/UserPage').then((m) => ({ default: m.UserPage }))
)
const FriendsPage = lazy(() =>
  import('@/pages/FriendsPage').then((m) => ({ default: m.FriendsPage }))
)
const LegalPage = lazy(() =>
  import('@/pages/LegalPage').then((m) => ({ default: m.LegalPage }))
)
const AdminPage = lazy(() =>
  import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage }))
)

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <SplashScreen />
  if (!user) {
    // Préserve la destination (pathname + search) pour que l'AuthPage redirige
    // l'user vers la page demandée après signIn. Sans ça, un newcomer qui clique
    // un lien de notif `/dashboard?tab=friends` et n'est pas loggué atterrit
    // sur `/` après login et perd sa destination.
    const from = location.pathname + location.search + location.hash
    return <Navigate to="/auth" replace state={{ from }} />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <>
      <OfflineBanner />
      <Suspense fallback={<SplashScreen />}>
        <Routes>
          <Route path="/auth/*" element={<AuthPage />} />
          <Route path="/piano/:id" element={<PianoPage />} />
          <Route path="/legal" element={<LegalPage />} />

          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/" element={<MapPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/user/:pseudo" element={<UserPage />} />
          </Route>

          <Route
            path="/admin/*"
            element={
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}
