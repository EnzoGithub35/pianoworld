import * as Sentry from '@sentry/react'

/**
 * Logger centralisé pour l'application.
 *
 * - En dev : tout va dans la console avec un préfixe scope, couleurs natives du navigateur
 * - En prod :
 *   - debug/info : silencieux
 *   - warn       : Sentry (level=warning) + console.warn
 *   - error      : Sentry (captureException) + console.error
 *
 * Convention de scope : `domaine.action` (ex: `auth.signup`, `pianos.fetch`,
 * `photo.upload`). Un scope court permet de retrouver l'origine dans Sentry.
 */

type LogContext = Record<string, unknown>

const isDev = import.meta.env.DEV

function prefix(scope: string): string {
  return `[${scope}]`
}

function sanitize(ctx: LogContext | undefined): LogContext | undefined {
  if (!ctx) return undefined
  const out: LogContext = {}
  for (const [k, v] of Object.entries(ctx)) {
    if (v instanceof File) {
      out[k] = { _kind: 'File', name: v.name, size: v.size, type: v.type }
    } else {
      out[k] = v
    }
  }
  return out
}

export const logger = {
  debug(scope: string, msg: string, ctx?: LogContext): void {
    if (!isDev) return
    if (ctx) console.debug(prefix(scope), msg, sanitize(ctx))
    else console.debug(prefix(scope), msg)
  },

  info(scope: string, msg: string, ctx?: LogContext): void {
    if (!isDev) return
    if (ctx) console.info(prefix(scope), msg, sanitize(ctx))
    else console.info(prefix(scope), msg)
  },

  warn(scope: string, msg: string, ctx?: LogContext): void {
    if (ctx) console.warn(prefix(scope), msg, sanitize(ctx))
    else console.warn(prefix(scope), msg)
    Sentry.captureMessage(`${prefix(scope)} ${msg}`, {
      level: 'warning',
      extra: sanitize(ctx)
    })
  },

  error(scope: string, msg: string, err: unknown, ctx?: LogContext): void {
    if (ctx) console.error(prefix(scope), msg, err, sanitize(ctx))
    else console.error(prefix(scope), msg, err)
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
      tags: { scope },
      extra: { message: msg, ...(sanitize(ctx) ?? {}) }
    })
  }
}
