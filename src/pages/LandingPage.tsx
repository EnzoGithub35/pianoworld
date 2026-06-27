import { Link, Navigate } from 'react-router-dom'
import {
  Map as MapIcon,
  MapPin,
  Music,
  Users,
  Bell,
  Heart,
  ArrowRight,
  Sparkles
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/Layout/Logo'
import { SplashScreen } from '@/components/Layout/SplashScreen'
import { buttonVariants } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

/**
 * Landing publique servie sur `/`. Visible sans authentification — premier
 * point de contact pour un visiteur qui découvre l'app via un lien partagé
 * ou un moteur de recherche.
 *
 * Objectifs :
 * 1. Expliquer ce qu'est PianoWorld en < 5 secondes (hero clair, tagline)
 * 2. Convertir vers signup (CTA principal "Créer un compte")
 * 3. SEO-friendly : structure HTML sémantique, contenu indexable,
 *    pas de dépendance lourde (Leaflet est laissé pour `/map`)
 *
 * Si l'user est déjà loggué → redirect direct vers `/map`. La landing
 * n'a aucune raison de s'afficher pour un user connecté.
 */
export function LandingPage() {
  const { user, loading } = useAuth()

  if (loading) return <SplashScreen />
  if (user) return <Navigate to="/map" replace />

  return (
    <div className="min-h-full overflow-y-auto bg-background text-foreground">
      {/* Header sticky simple — pas de NavBar (réservée aux users loggués) */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <Logo className="h-9 w-9" />
            <span className="font-display text-lg font-bold tracking-tight">
              PianoWorld
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              to="/auth/login"
              className="rounded-md px-3 py-2 font-medium text-muted-foreground hover:text-foreground"
            >
              Se connecter
            </Link>
            <Link to="/auth/signup" className={cn(buttonVariants({ size: 'sm' }))}>
              Créer un compte
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero : titre + tagline + CTAs + mock visuel carte */}
      <section className="relative overflow-hidden">
        {/* Décor warm en arrière-plan, cohérent avec AuthPage */}
        <div className="pointer-events-none absolute inset-0 -z-0">
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -right-32 top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Communautaire · Gratuit · Open
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              Trouve un piano public, <span className="text-primary">joue, partage.</span>
            </h1>
            <p className="text-base text-muted-foreground md:text-lg">
              PianoWorld cartographie les pianos publics autour de toi. Ajoute ceux que tu
              découvres, signale leur état, planifie des créneaux avec d'autres pianistes.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/auth/signup"
                className={cn(buttonVariants({ size: 'lg' }), 'gap-2 shadow-md')}
              >
                Commencer maintenant
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/auth/login"
                className={cn(
                  buttonVariants({ size: 'lg', variant: 'outline' }),
                  'gap-2'
                )}
              >
                <MapIcon className="h-4 w-4" />
                Voir la carte
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              Démarrage à Rennes · carte ouverte partout
            </p>
          </div>

          {/* Mockup carte stylisé — pas de Leaflet pour garder le bundle léger.
              Visuel illustratif : zone "carte" avec pins fake colorés selon
              les qualités du design system. */}
          <MapMockup />
        </div>
      </section>

      {/* Comment ça marche : 3 étapes */}
      <section className="border-t border-border bg-card/30">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Comment ça marche
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Trois étapes, aucune friction.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Step
              n={1}
              icon={<MapPin className="h-5 w-5" />}
              title="Découvre"
              body="Explore la carte des pianos publics référencés par la communauté. Filtre par état, distance, fraîcheur."
            />
            <Step
              n={2}
              icon={<Music className="h-5 w-5" />}
              title="Contribue"
              body="Ajoute un piano que tu croises, photo + état + commentaire. Signale ceux qui ont disparu ou se sont dégradés."
            />
            <Step
              n={3}
              icon={<Users className="h-5 w-5" />}
              title="Connecte-toi"
              body="Planifie un créneau pour jouer, ajoute des amis, vois quand quelqu'un est en train de jouer à proximité."
            />
          </div>
        </div>
      </section>

      {/* Pourquoi PianoWorld : valeurs */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Pensé pour les pianistes
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Feature
              icon={<Heart className="h-5 w-5" />}
              title="Tes favoris"
              body="Garde un œil sur les pianos que tu fréquentes. Reçois une notif si leur état change."
            />
            <Feature
              icon={<Bell className="h-5 w-5" />}
              title="Notifications opt-in"
              body="Mail + push web. Tout est désactivable, granulaire, sans pister tes habitudes."
            />
            <Feature
              icon={<Users className="h-5 w-5" />}
              title="Amitié réciproque"
              body="Choisis qui voit tes créneaux. Visibilité publique ou amis uniquement, modifiable à tout moment."
            />
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-border bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Prêt à explorer la carte ?
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Crée ton compte en 30 secondes. C'est 100 % gratuit et sans pub.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              to="/auth/signup"
              className={cn(buttonVariants({ size: 'lg' }), 'gap-2 shadow-md')}
            >
              Créer mon compte
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer minimal */}
      <footer className="border-t border-border bg-card/30">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} PianoWorld · Communautaire & gratuit</p>
          <nav className="flex items-center gap-4">
            <Link to="/legal" className="hover:text-foreground">
              Mentions légales
            </Link>
            <Link to="/legal" className="hover:text-foreground">
              Confidentialité
            </Link>
            <Link to="/legal" className="hover:text-foreground">
              CGU
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

function Step({
  n,
  icon,
  title,
  body
}: {
  n: number
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="relative space-y-3 rounded-2xl border border-border bg-card p-5">
      <span className="absolute -top-3 left-4 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
        {n}
      </span>
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

function Feature({
  icon,
  title,
  body
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

/**
 * Mock visuel d'une carte avec quelques pins colorés. Pur CSS, aucune dépendance
 * Leaflet. Sert uniquement à donner l'idée du produit sans embarquer 200 Ko de
 * JS sur la landing. Le vrai map est sur `/map`.
 */
function MapMockup() {
  // Positions arbitraires des "pianos" sur le mock — choisies pour donner
  // l'impression d'une distribution naturelle (clusters + isolés)
  const pins: Array<{ top: string; left: string; quality: string }> = [
    { top: '22%', left: '28%', quality: 'pm-neuf' },
    { top: '34%', left: '52%', quality: 'pm-bon_etat' },
    { top: '46%', left: '38%', quality: 'pm-potable' },
    { top: '58%', left: '62%', quality: 'pm-bon_etat' },
    { top: '70%', left: '46%', quality: 'pm-desaccorde' },
    { top: '28%', left: '74%', quality: 'pm-neuf' },
    { top: '64%', left: '22%', quality: 'pm-autre' }
  ]
  return (
    <div
      aria-hidden="true"
      className="relative aspect-square w-full max-w-md justify-self-center overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-muted via-secondary to-muted shadow-xl"
    >
      {/* "Rues" en grille subtile pour évoquer un plan */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-y-0 left-[30%] w-px bg-border" />
        <div className="absolute inset-y-0 left-[55%] w-px bg-border" />
        <div className="absolute inset-y-0 left-[78%] w-px bg-border" />
        <div className="absolute inset-x-0 top-[28%] h-px bg-border" />
        <div className="absolute inset-x-0 top-[58%] h-px bg-border" />
        <div className="absolute inset-x-0 top-[82%] h-px bg-border" />
      </div>
      {/* Zone "parc" */}
      <div className="absolute left-[12%] top-[12%] h-[28%] w-[24%] rounded-2xl bg-primary/10" />
      <div className="absolute bottom-[10%] right-[14%] h-[26%] w-[28%] rounded-2xl bg-primary/10" />

      {/* Les pins eux-mêmes, colorés via les classes pm-* du design system */}
      {pins.map((pin, i) => (
        <span
          key={i}
          style={{ top: pin.top, left: pin.left }}
          className={cn('absolute -translate-x-1/2 -translate-y-full', pin.quality)}
        >
          <span className="pm-border flex h-7 w-7 items-center justify-center rounded-full border-[3px] bg-background shadow-md">
            <Music className="pm-icon h-3.5 w-3.5" />
          </span>
        </span>
      ))}

      {/* Petite légende */}
      <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur">
        <MapIcon className="h-3 w-3 text-primary" />
        Rennes · 7 pianos
      </div>
    </div>
  )
}
