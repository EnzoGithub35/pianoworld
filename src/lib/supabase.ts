import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Client Supabase unique de l'app. Le throw au chargement est volontaire : si
 * les variables d'env sont manquantes, autant échouer fort plutôt que générer
 * des erreurs cryptiques au premier appel.
 */

const rawUrl = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!rawUrl || !anonKey) {
  throw new Error(
    'Variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY manquantes. Copie .env.example vers .env et remplis-les.'
  )
}

/**
 * Normalise l'URL Supabase. Le piège classique : l'utilisateur copie l'URL
 * REST complète (`.../rest/v1`) dans son .env, et supabase-js rajoute ce suffixe
 * lui-même → double `/rest/v1/rest/v1/` qui renvoie 404 sur tous les endpoints.
 */
function normalizeSupabaseUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, '')
  if (u.endsWith('/rest/v1')) {
    console.warn(
      '[supabase] VITE_SUPABASE_URL contient /rest/v1, je le retire. ' +
        "Préfère l'URL nue type https://xxx.supabase.co"
    )
    u = u.slice(0, -'/rest/v1'.length)
  }
  return u
}

export const supabase = createClient<Database>(normalizeSupabaseUrl(rawUrl), anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})
