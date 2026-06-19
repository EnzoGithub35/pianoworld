/**
 * Utilitaires d'extraction et de classification d'erreurs.
 *
 * Couvre les trois grandes familles rencontrées dans l'app :
 *  - Error JS classique
 *  - PostgrestError de Supabase (objet avec { message, code, details, hint })
 *  - Réponse JSON d'API tierce (Photon, Nominatim) avec un champ message
 */

type PostgrestLikeError = {
  message: string
  code?: string
  details?: string | null
  hint?: string | null
}

export function isPostgrestError(err: unknown): err is PostgrestLikeError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string' &&
    'code' in err
  )
}

/**
 * Extrait un message lisible pour l'utilisateur final, quel que soit le format
 * de l'erreur. Toujours retourne une string non vide.
 */
export function getErrorMessage(
  err: unknown,
  fallback = 'Une erreur est survenue'
): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err) return err
  if (typeof err === 'object' && err !== null) {
    const candidate = err as { message?: unknown }
    if (typeof candidate.message === 'string' && candidate.message) {
      return candidate.message
    }
  }
  return fallback
}

/** Violation d'unicité (Postgres 23505). Utile pour les contraintes UNIQUE. */
export function isUniqueViolation(err: unknown): boolean {
  return isPostgrestError(err) && err.code === '23505'
}

/** Lignes interdites par RLS (PGRST301 / 42501). Utile pour message ciblé. */
export function isPermissionDenied(err: unknown): boolean {
  if (!isPostgrestError(err)) return false
  return err.code === '42501' || err.code === 'PGRST301'
}

/**
 * Limite de débit dépassée (raise exception 'rate_limit_exceeded' côté trigger
 * enforce_rate_limit, errcode P0001). Le `hint` Postgres porte le nom de
 * l'action (`piano_create`, `piano_update`, etc.) — exposé ici pour formatter
 * un toast contextualisé côté forms.
 */
export function isRateLimitError(err: unknown): boolean {
  if (!isPostgrestError(err)) return false
  return (
    err.code === 'P0001' &&
    (err.message ?? '').toLowerCase().includes('rate_limit_exceeded')
  )
}

/** Mot de passe incorrect renvoyé par RPCs irréversibles (raise 'invalid_password'). */
export function isInvalidPassword(err: unknown): boolean {
  if (!isPostgrestError(err)) return false
  return (err.message ?? '').toLowerCase().includes('invalid_password')
}

/**
 * Pour une erreur rate-limit Postgres, extrait le nom de l'action depuis le
 * `hint` (rempli par `enforce_rate_limit`). Permet de formater un message
 * contextualisé "tu as atteint X/24h, réessaie demain".
 *
 * Retourne null si non extractible.
 */
export function getRateLimitAction(err: unknown): string | null {
  if (!isRateLimitError(err)) return null
  const hint = (err as PostgrestLikeError).hint
  if (typeof hint === 'string' && hint.length > 0) return hint
  return null
}

/**
 * Sprint 4 audit P2 — message d'erreur friendly + spécifique.
 *
 * Stratégie :
 *  - Rate-limit : message FR avec délai si action connue
 *  - Permission denied : message d'action plutôt que "non autorisé" générique
 *  - Unique violation : indique la nature de la collision
 *  - Sinon : fallback au message d'erreur brut ou texte custom
 *
 * À préférer à `getErrorMessage` dans les toasts utilisateur des forms.
 *
 * `rateLimitLabels` (optionnel) : map action → label window humanizable,
 * sinon "limite atteinte" générique. Forms qui veulent un délai précis
 * passent leur RATE_LIMITS depuis constants.
 */
export function getFriendlyErrorMessage(
  err: unknown,
  options: {
    fallback?: string
    rateLimitLabels?: Record<string, { count: number; windowLabel: string }>
  } = {}
): string {
  const { fallback = 'Une erreur est survenue', rateLimitLabels } = options

  if (isRateLimitError(err)) {
    const action = getRateLimitAction(err)
    if (action && rateLimitLabels && rateLimitLabels[action]) {
      const { count, windowLabel } = rateLimitLabels[action]
      return `Tu as atteint la limite (${count} / ${windowLabel}). Réessaie plus tard.`
    }
    return 'Tu vas trop vite, réessaie dans quelques minutes.'
  }
  if (isPermissionDenied(err)) {
    return 'Action non autorisée — il faut être connecté ou propriétaire pour faire ça.'
  }
  if (isInvalidPassword(err)) {
    return 'Mot de passe incorrect.'
  }
  return getErrorMessage(err, fallback)
}
