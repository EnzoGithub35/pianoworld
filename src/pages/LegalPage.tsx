import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function LegalPage() {
  const navigate = useNavigate()
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Retour">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-medium">Mentions légales & confidentialité</h1>
      </header>

      <article className="mx-auto max-w-2xl space-y-6 p-4 pb-24 text-sm leading-relaxed">
        <section>
          <h2 className="mb-2 font-semibold">À propos</h2>
          <p className="text-muted-foreground">
            PianoWorld est un projet personnel et communautaire visant à cartographier les
            pianos publics. Le service est fourni « tel quel », sans garantie de disponibilité.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">Données collectées</h2>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            <li>Email (pour la connexion et la récupération de mot de passe)</li>
            <li>Pseudo (visible publiquement)</li>
            <li>Mot de passe chiffré (jamais visible en clair)</li>
            <li>Contenu que tu ajoutes : pianos, photos, commentaires, mises à jour</li>
            <li>Date d'inscription et d'activité</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">Pourquoi ces données</h2>
          <p className="text-muted-foreground">
            Strictement pour faire fonctionner le service : t'authentifier, te permettre
            d'ajouter et consulter des pianos, attribuer le contenu à son auteur. Aucune
            publicité, aucun tracking tiers, aucune revente.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">Hébergement</h2>
          <p className="text-muted-foreground">
            Les données sont stockées sur Supabase (PostgreSQL hébergé en Union européenne).
            L'application est servie par Vercel. Aucune donnée n'est volontairement
            transmise hors UE.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">Tes droits (RGPD)</h2>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            <li>
              <strong>Accès / portabilité :</strong> bouton « Exporter mes données » dans
              les Paramètres pour télécharger ton profil et tes contributions en JSON.
            </li>
            <li>
              <strong>Rectification :</strong> tu peux modifier ton pseudo, et modifier ou
              supprimer tes pianos.
            </li>
            <li>
              <strong>Suppression :</strong> bouton « Supprimer mon compte » dans les
              Paramètres. Action irréversible, supprime toutes tes données.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">Cookies & stockage local</h2>
          <p className="text-muted-foreground">
            L'app utilise le stockage local du navigateur pour conserver ta session, ta
            préférence de thème et l'état du tutoriel d'accueil. Aucun cookie tiers.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            Pour toute question ou demande RGPD, contacte l'administrateur du service.
          </p>
        </section>
      </article>
    </div>
  )
}
