import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'

type LegalTab = 'mentions' | 'privacy' | 'cgu'

/**
 * Page légale unique avec 3 sous-onglets :
 *  - Mentions légales (éditeur, hébergeur, contact)
 *  - Confidentialité (données collectées, RGPD, droits)
 *  - CGU (règles d'usage du service)
 *
 * L'onglet initial est déduit du hash de l'URL (`/legal#privacy`) pour permettre
 * de linker directement depuis le bandeau cookies ou les mails.
 */
export function LegalPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [tab, setTab] = useState<LegalTab>('mentions')

  useEffect(() => {
    const hash = location.hash.replace('#', '')
    if (hash === 'privacy' || hash === 'cgu' || hash === 'mentions') {
      setTab(hash)
    }
  }, [location.hash])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Retour"
          className="rounded-full p-1 hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-lg font-semibold">Informations légales</h1>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as LegalTab)}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <TabsList scrollable className="bg-background px-2">
          <TabsTrigger value="mentions">Mentions légales</TabsTrigger>
          <TabsTrigger value="privacy">Confidentialité</TabsTrigger>
          <TabsTrigger value="cgu">CGU</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="mentions">
            <MentionsContent />
          </TabsContent>
          <TabsContent value="privacy">
            <PrivacyContent />
          </TabsContent>
          <TabsContent value="cgu">
            <CguContent />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function Article({ children }: { children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl space-y-6 p-4 pb-24 text-sm leading-relaxed">
      {children}
    </article>
  )
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-base font-semibold">{children}</h2>
}

function MentionsContent() {
  return (
    <Article>
      <section className="space-y-2">
        <H>Éditeur</H>
        <p className="text-muted-foreground">
          PianoWorld est un projet personnel édité par <strong>Enzo Reine</strong>, en sa
          qualité de particulier (pas de société, pas d'association déclarée).
        </p>
        <p className="text-muted-foreground">
          Contact :{' '}
          <a href="mailto:enzo.reine35@gmail.com" className="text-primary underline">
            enzo.reine35@gmail.com
          </a>
        </p>
      </section>

      <section className="space-y-2">
        <H>Directeur de publication</H>
        <p className="text-muted-foreground">Enzo Reine.</p>
      </section>

      <section className="space-y-2">
        <H>Hébergement</H>
        <p className="text-muted-foreground">
          L'application est hébergée par <strong>Vercel Inc.</strong> (340 S Lemon Ave
          #4133, Walnut, CA 91789, USA) avec une infrastructure principalement en Europe.
        </p>
        <p className="text-muted-foreground">
          La base de données, le stockage des photos et l'authentification sont assurés
          par
          <strong> Supabase Inc.</strong> (970 Toa Payoh North #07-04, Singapour), avec un
          déploiement de la région PostgreSQL en Union européenne.
        </p>
      </section>

      <section className="space-y-2">
        <H>Propriété intellectuelle</H>
        <p className="text-muted-foreground">
          Les contenus publiés par les utilisateurs (pianos, photos, commentaires,
          sessions) restent leur propriété. En les publiant, l'utilisateur accorde à
          PianoWorld une licence non exclusive et révocable de reproduction et d'affichage
          dans le but de faire fonctionner le service.
        </p>
        <p className="text-muted-foreground">
          Les tuiles cartographiques proviennent d'OpenStreetMap (© contributeurs OSM,
          ODbL) et de CARTO (mode sombre).
        </p>
      </section>

      <section className="space-y-2">
        <H>Signalement de contenu</H>
        <p className="text-muted-foreground">
          Pour signaler un contenu illicite, contacter{' '}
          <a href="mailto:enzo.reine35@gmail.com" className="text-primary underline">
            enzo.reine35@gmail.com
          </a>
          . Un délai de traitement de 72 h est généralement appliqué.
        </p>
      </section>

      <p className="text-[11px] text-muted-foreground">
        Dernière mise à jour : mai 2026.
      </p>
    </Article>
  )
}

function PrivacyContent() {
  return (
    <Article>
      <section className="space-y-2">
        <H>Responsable du traitement</H>
        <p className="text-muted-foreground">
          Le responsable du traitement au sens du RGPD est Enzo Reine (contact :
          <a href="mailto:enzo.reine35@gmail.com" className="ml-1 text-primary underline">
            enzo.reine35@gmail.com
          </a>
          ).
        </p>
      </section>

      <section className="space-y-2">
        <H>Données collectées</H>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            Email (authentification, récupération de mot de passe, envoi des
            notifications)
          </li>
          <li>Pseudo (visible publiquement par tous les utilisateurs)</li>
          <li>Mot de passe (stocké chiffré via Supabase Auth, jamais en clair)</li>
          <li>
            Contenus publiés : pianos, photos, commentaires, passages, sessions, demandes
          </li>
          <li>Préférences de notification (5 toggles + push)</li>
          <li>
            Abonnements Web Push (endpoint anonymisé du navigateur, pas d'identifiant
            unique)
          </li>
          <li>Date d'inscription, dates d'activité</li>
          <li>Logs d'erreurs anonymisés envoyés à Sentry (uniquement pour debug)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <H>Bases légales</H>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            <strong>Exécution du service</strong> (Art. 6.1.b RGPD) : email, pseudo,
            contenu, sont strictement nécessaires pour fournir le service.
          </li>
          <li>
            <strong>Intérêt légitime</strong> (Art. 6.1.f) : logs d'erreurs, statistiques
            globales internes (nombre de pianos cartographiés, etc.).
          </li>
          <li>
            <strong>Consentement</strong> (Art. 6.1.a) : notifications par mail et push
            (toggles dans Settings, désactivables à tout moment).
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <H>Durée de conservation</H>
        <p className="text-muted-foreground">
          Tes données sont conservées tant que ton compte est actif. La suppression de ton
          compte (via Paramètres → Supprimer mon compte) efface immédiatement ton profil,
          tes pianos, tes passages, sessions et demandes. Les contributions historiques
          (mises à jour de pianos) restent visibles mais sont anonymisées.
        </p>
      </section>

      <section className="space-y-2">
        <H>Transmission à des tiers</H>
        <p className="text-muted-foreground">
          Tes données ne sont jamais vendues. Elles sont transmises uniquement aux
          sous-traitants techniques nécessaires :
        </p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>Supabase (hébergement DB + auth)</li>
          <li>Vercel (hébergement web)</li>
          <li>Resend (envoi des mails transactionnels)</li>
          <li>Sentry (rapport d'erreurs anonymisé)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <H>Tes droits (RGPD)</H>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            <strong>Accès / portabilité :</strong> bouton « Exporter mes données » dans
            Paramètres → Données pour télécharger tout en JSON.
          </li>
          <li>
            <strong>Rectification :</strong> modifier ton pseudo, tes pianos, ton mot de
            passe directement dans l'app.
          </li>
          <li>
            <strong>Effacement :</strong> bouton « Supprimer mon compte » dans Paramètres
            → Zone dangereuse.
          </li>
          <li>
            <strong>Opposition :</strong> coupe les toggles correspondants dans Paramètres
            → Notifications.
          </li>
          <li>
            <strong>Réclamation :</strong> tu peux saisir la CNIL à tout moment (
            <a
              href="https://www.cnil.fr/fr/plaintes"
              className="text-primary underline"
              target="_blank"
              rel="noreferrer"
            >
              cnil.fr/fr/plaintes
            </a>
            ).
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <H>Cookies et stockage local</H>
        <p className="text-muted-foreground">
          PianoWorld n'utilise <strong>aucun cookie publicitaire ni cookie tiers</strong>.
          Les éléments suivants sont stockés localement dans ton navigateur :
        </p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>Token de session Supabase (cookie essentiel à la connexion)</li>
          <li>Préférence de thème (clair / sombre)</li>
          <li>État du tutoriel d'accueil (déjà vu ou non)</li>
          <li>Date de dernière consultation de tes demandes (badge)</li>
          <li>Consentement RGPD (mémorisation de ton choix sur le bandeau)</li>
        </ul>
        <p className="text-muted-foreground">
          Tous ces éléments sont strictement nécessaires au service ou correspondent à des
          préférences personnelles que tu peux effacer en supprimant les données du site
          dans ton navigateur.
        </p>
      </section>

      <p className="text-[11px] text-muted-foreground">
        Dernière mise à jour : mai 2026.
      </p>
    </Article>
  )
}

function CguContent() {
  return (
    <Article>
      <section className="space-y-2">
        <H>1. Objet</H>
        <p className="text-muted-foreground">
          Les présentes Conditions Générales d'Utilisation (CGU) régissent l'utilisation
          du service PianoWorld (l'« Application »), accessible via le web et installable
          en PWA. L'utilisation du service implique l'acceptation pleine et entière des
          présentes CGU.
        </p>
      </section>

      <section className="space-y-2">
        <H>2. Description du service</H>
        <p className="text-muted-foreground">
          PianoWorld est une carte communautaire des pianos publics, permettant à ses
          utilisateurs de référencer des pianos, déclarer leurs passages et créneaux de
          jeu, interagir avec la communauté et participer à des évènements.
        </p>
      </section>

      <section className="space-y-2">
        <H>3. Inscription</H>
        <p className="text-muted-foreground">
          L'inscription est ouverte à toute personne capable juridiquement. Les mineurs de
          moins de 15 ans doivent disposer de l'autorisation de leurs représentants
          légaux. Un email valide et un pseudo unique sont requis. Un seul compte par
          personne.
        </p>
      </section>

      <section className="space-y-2">
        <H>4. Comportement attendu</H>
        <p className="text-muted-foreground">En utilisant PianoWorld, tu t'engages à :</p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>Ne publier que des contenus respectueux et conformes à la loi</li>
          <li>Ne pas usurper l'identité d'un tiers</li>
          <li>Ne pas spammer (signalements abusifs, créations massives, etc.)</li>
          <li>Ne pas tenter de contourner les mesures de sécurité</li>
          <li>
            Respecter le droit à l'image et le droit d'auteur sur les photos publiées
          </li>
          <li>Signaler tout contenu inapproprié via le bouton « Signaler »</li>
        </ul>
      </section>

      <section className="space-y-2">
        <H>5. Modération</H>
        <p className="text-muted-foreground">
          L'éditeur se réserve le droit de modérer a posteriori tout contenu publié, et de
          suspendre tout compte ne respectant pas les CGU, sans préavis ni indemnité. Les
          contenus signalés font l'objet d'une revue dans un délai indicatif de 72 h.
        </p>
      </section>

      <section className="space-y-2">
        <H>6. Quotas anti-abus</H>
        <p className="text-muted-foreground">
          Des limites d'usage sont appliquées pour préserver la qualité du service :
        </p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>Création de pianos : 5 par jour</li>
          <li>Mises à jour : 30 par jour</li>
          <li>Passages : 50 par jour</li>
          <li>Sessions de présence : 10 par jour</li>
          <li>Signalements : 5 par jour</li>
          <li>Demandes au support : 5 par semaine</li>
        </ul>
      </section>

      <section className="space-y-2">
        <H>7. Disponibilité</H>
        <p className="text-muted-foreground">
          Le service est fourni « tel quel », sans aucune garantie de disponibilité,
          d'intégrité ou de performances. L'éditeur peut suspendre l'accès pour
          maintenance ou raisons techniques sans préavis.
        </p>
      </section>

      <section className="space-y-2">
        <H>8. Responsabilité</H>
        <p className="text-muted-foreground">
          L'éditeur ne saurait être tenu responsable :
        </p>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>Du contenu publié par les utilisateurs</li>
          <li>D'un piano non trouvé, déplacé ou hors d'usage à l'adresse indiquée</li>
          <li>
            D'une rencontre organisée via l'application (passages, sessions, évènements)
          </li>
          <li>D'une interruption du service</li>
        </ul>
      </section>

      <section className="space-y-2">
        <H>9. Données personnelles</H>
        <p className="text-muted-foreground">
          Le traitement des données personnelles est détaillé dans l'onglet «
          Confidentialité ».
        </p>
      </section>

      <section className="space-y-2">
        <H>10. Modification des CGU</H>
        <p className="text-muted-foreground">
          Les présentes CGU peuvent être modifiées à tout moment. La version en vigueur
          est celle accessible depuis cette page. En cas de changement substantiel, les
          utilisateurs seront notifiés par email.
        </p>
      </section>

      <section className="space-y-2">
        <H>11. Droit applicable</H>
        <p className="text-muted-foreground">
          Les présentes CGU sont régies par le droit français. Tout litige relève de la
          compétence des tribunaux français, sauf disposition impérative contraire.
        </p>
      </section>

      <p className="text-[11px] text-muted-foreground">
        Dernière mise à jour : mai 2026.
      </p>
    </Article>
  )
}
