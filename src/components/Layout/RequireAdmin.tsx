import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { SplashScreen } from './SplashScreen'

/**
 * Guard pour les routes admin. Tant que le profil n'est pas chargé, affiche le
 * splash (évite un flash de redirection). Si l'user n'est pas admin, on le
 * renvoie sur la racine plutôt que sur /auth (il est déjà connecté).
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, profile, loading, isAdmin } = useAuth()
  if (loading) return <SplashScreen />
  if (!user) return <Navigate to="/auth" replace />
  if (!profile) return <SplashScreen />
  if (!isAdmin) return <Navigate to="/map" replace />
  return <>{children}</>
}
