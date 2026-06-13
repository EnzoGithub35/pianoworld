import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie, X } from 'lucide-react'
import { COOKIE_CONSENT_KEY } from '@/lib/constants'

/**
 * Bandeau cookies minimaliste.
 *
 * PianoWorld n'utilise QUE des cookies essentiels au service (session Supabase)
 * + préférences locales (thème, tutoriel). Pas de tracking, pas de pub.
 * Selon la CNIL, ce type d'usage ne requiert pas de consentement opt-in
 * (cookies strictement nécessaires), mais une information claire est obligatoire.
 *
 * Le bandeau affiche cette info la première fois, et l'utilisateur clique
 * "OK compris". Le choix est mémorisé en localStorage.
 *
 * NB : volontairement pas de bouton "Refuser" — il n'y a rien à refuser.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(COOKIE_CONSENT_KEY)) {
        // Laisse l'app respirer avant de poper le bandeau
        const t = setTimeout(() => setVisible(true), 800)
        return () => clearTimeout(t)
      }
    } catch {
      // localStorage indispo (mode privé strict) → on n'affiche rien
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, new Date().toISOString())
    } catch {
      // best-effort
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Information cookies"
      className="animate-slide-up-modal fixed inset-x-0 bottom-0 z-[1200] px-3 pb-3"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-2xl items-start gap-3 rounded-2xl border border-border bg-popover/95 p-4 shadow-2xl backdrop-blur">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Cookie className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm leading-snug">
            PianoWorld utilise <strong>uniquement des cookies essentiels</strong>{' '}
            (session, préférences). Pas de pub, pas de tracking tiers.
          </p>
          <p className="text-[11px] text-muted-foreground">
            En savoir plus dans la{' '}
            <Link to="/legal#privacy" className="text-primary underline">
              politique de confidentialité
            </Link>
            .
          </p>
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              OK, compris
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          className="-mr-1 -mt-1 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
