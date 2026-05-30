import * as Sentry from '@sentry/react'

/**
 * Init Sentry en prod uniquement. En dev, on reste sur console.* via le logger.
 *
 * Sécurité / RGPD : `beforeSend` scrubbe TOUTES les PII susceptibles de
 * remonter accidentellement dans les payloads d'erreur :
 *  - email user (event.user.email)
 *  - IP user (event.user.ip_address)
 *  - cookies (event.request.cookies)
 *  - regex globale : adresses mail dans les strings + JWT
 *
 * Le tradeoff : on perd la corrélation user pour le debug, mais on respecte
 * le principe de minimisation RGPD et on évite de remplir Sentry de tokens
 * en cas de log accidentel d'une réponse Supabase.
 */

const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/g
// JWT à 3 segments base64url séparés par '.'
const JWT_REGEX = /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g

function scrubString(s: string): string {
  return s.replace(EMAIL_REGEX, '[email]').replace(JWT_REGEX, '[jwt]')
}

/** Visite récursive d'un objet pour scrub toutes les strings. */
function scrubDeep<T>(value: T, depth = 0): T {
  if (depth > 8) return value
  if (typeof value === 'string') return scrubString(value) as unknown as T
  if (Array.isArray(value)) {
    return value.map((v) => scrubDeep(v, depth + 1)) as unknown as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = scrubDeep(v, depth + 1)
    }
    return out as unknown as T
  }
  return value
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn || !import.meta.env.PROD) return
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    environment: 'production',
    sendDefaultPii: false,
    beforeSend(event) {
      // Couches structurées : on enlève d'abord les champs sensibles connus.
      if (event.user) {
        delete event.user.email
        delete event.user.ip_address
      }
      if (event.request) {
        delete event.request.cookies
        delete event.request.headers
      }
      // Puis on scrub récursivement toute string restante (logs ctx, breadcrumbs).
      return scrubDeep(event)
    },
    beforeBreadcrumb(breadcrumb) {
      // Scrub aussi les breadcrumbs (fetch URLs, console logs avec tokens…).
      return scrubDeep(breadcrumb)
    }
  })
}

export const SentryErrorBoundary = Sentry.ErrorBoundary
