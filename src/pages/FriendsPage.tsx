import { FriendsTab } from '@/components/Friends/FriendsTab'

/**
 * v7 — Page standalone /friends accessible depuis la NavBar (5e icône).
 *
 * Réutilise le composant FriendsTab existant (livré en PR-B v6) — il gère
 * déjà les 3 sub-tabs (Mes amis / Reçues / Envoyées) avec son propre layout.
 */
export function FriendsPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="border-b border-border bg-background/80 px-4 py-5 backdrop-blur">
        <h1 className="font-display text-2xl font-bold tracking-tight">Amis</h1>
        <p className="text-xs text-muted-foreground">
          Tes contacts et les invitations en cours.
        </p>
      </header>
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <FriendsTab />
      </div>
    </div>
  )
}
