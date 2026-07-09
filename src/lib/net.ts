/**
 * Helpers réseau — retry avec backoff exponentiel + jitter.
 *
 * Sprint v8 Phase 1.5 (Auth Resilience) : nécessaire pour rendre les appels
 * `supabase.auth.*` tolérants aux 522/504 transitoires de Cloudflare devant
 * Supabase Auth (cf. incident observé le 2026-07-08 dans les logs MCP).
 *
 * Volontairement générique — pas de dépendance à `errors.ts` ni à supabase-js.
 * L'appelant fournit un `shouldRetry(err)` prédicat (typiquement
 * `isTransientNetworkError` de `errors.ts`) pour éviter de retenter sur des
 * 400 "mauvais password" ou du rate-limit métier.
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface WithRetryOptions {
  /** Nombre max d'appels (tentative initiale incluse). Défaut 3. */
  attempts?: number
  /** Délai initial entre tentatives en ms. Défaut 800. */
  baseDelayMs?: number
  /** Cap sur le délai avant jitter. Défaut 10s. */
  maxDelayMs?: number
  /**
   * Prédicat : true = retry, false = throw immédiatement.
   * Défaut : retente sur toutes les erreurs (utile pour tester en isolation).
   * En prod on passe toujours `isTransientNetworkError` pour ne pas retenter
   * un 400 "invalid password".
   */
  shouldRetry?: (err: unknown) => boolean
  /** Hook optionnel pour tracer les retries (logger, telemetry). */
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void
}

/**
 * Retente `fn` avec backoff exponentiel (base × 2^n) + jitter aléatoire ±20%.
 * Throw la dernière erreur si toutes les tentatives échouent.
 *
 * Timing par défaut (baseDelay=800ms) : ~800ms, ~1.6s, ~3.2s + jitter.
 * Total attente max ~5.6s sur 3 tentatives — sous le safety timer 8s de
 * `AuthContext.init`, donc compatible sans race.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: WithRetryOptions = {}
): Promise<T> {
  const {
    attempts = 3,
    baseDelayMs = 800,
    maxDelayMs = 10_000,
    shouldRetry = () => true,
    onRetry
  } = options

  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt >= attempts || !shouldRetry(err)) throw err

      // Backoff exponentiel capé, avec jitter ±20% pour éviter le thundering herd
      const exp = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs)
      const jitter = exp * (Math.random() * 0.4 - 0.2)
      const delay = Math.max(0, Math.round(exp + jitter))

      onRetry?.(err, attempt, delay)
      await sleep(delay)
    }
  }
  // Unreachable en pratique — le loop throw au dernier attempt. Nécessaire
  // pour satisfaire TypeScript qui ne voit pas que attempts >= 1.
  throw lastError
}
