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
export function getErrorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
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
