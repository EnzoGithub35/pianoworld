import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { FriendsTab } from '@/components/Friends/FriendsTab'

/**
 * v7 — Page standalone /friends accessible depuis la NavBar (5e icône).
 *
 * Réutilise le composant FriendsTab existant (livré en v6 — système d'amitié)
 * qui gère déjà les 3 sub-tabs (Mes amis / Reçues / Envoyées) avec son propre layout.
 *
 * Sprint 6 — back-button explicite (cohérence avec PianoPage/UserPage/Legal).
 * Fallback `/dashboard` si on est arrivé en deep-link direct (history vide).
 */
export function FriendsPage() {
  const navigate = useNavigate()
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/dashboard')
  }
  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="flex items-start gap-2 border-b border-border bg-background/80 px-4 py-5 backdrop-blur">
        <button
          onClick={handleBack}
          aria-label="Retour"
          className="-ml-2 mt-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">Amis</h1>
          <p className="text-xs text-muted-foreground">
            Tes contacts et les invitations en cours.
          </p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <FriendsTab />
      </div>
    </div>
  )
}
