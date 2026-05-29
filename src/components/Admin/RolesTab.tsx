import { ShieldAlert } from 'lucide-react'

/**
 * Page de gestion des rôles (superadmin only).
 *
 * Pour la v3 on n'a pas besoin d'une UI dédiée séparée : promouvoir / rétrograder
 * se fait directement depuis UsersTab via les boutons "Admin" / "Rétrograder"
 * conditionnés par `isSuperadmin`. Ce tab est donc un rappel + un lien.
 */
export function RolesTab() {
  return (
    <div className="space-y-4 p-4 pb-24">
      <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <ShieldAlert className="h-5 w-5 flex-shrink-0 text-primary" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold">Gestion des rôles</p>
          <p className="text-muted-foreground">
            Tu peux promouvoir un utilisateur admin ou le rétrograder depuis l'onglet{' '}
            <strong>Utilisateurs</strong>. Les boutons « Admin » et « Rétrograder » n'apparaissent
            que pour toi (superadmin).
          </p>
        </div>
      </div>

      <ul className="space-y-2 text-sm text-muted-foreground">
        <li className="rounded-lg border border-border bg-card p-3">
          <p className="font-medium text-foreground">user</p>
          <p>Compte standard. Peut ajouter pianos, visites, sessions, demandes.</p>
        </li>
        <li className="rounded-lg border border-border bg-card p-3">
          <p className="font-medium text-foreground">admin</p>
          <p>
            Peut bannir, résoudre les signalements, supprimer des pianos, créer des
            évènements, répondre aux demandes.
          </p>
        </li>
        <li className="rounded-lg border border-border bg-card p-3">
          <p className="font-medium text-foreground">superadmin</p>
          <p>Ajoute la gestion des rôles. Ne peut être ni banni ni rétrogradé par un admin.</p>
        </li>
      </ul>
    </div>
  )
}
