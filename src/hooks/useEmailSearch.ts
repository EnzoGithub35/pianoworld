import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { UserSearchResult } from '@/types/database'

/**
 * v7 — Recherche utilisateur par email exact-match (RPC `find_user_by_email`).
 *
 * Pourquoi une mutation et pas une query ? Le RPC est **rate-limité 5/24h
 * côté serveur** (anti account-enumeration). On veut un submit explicite
 * pour ne pas cramer la quota au moindre keypress.
 *
 * La RPC retourne 0 ou 1 row :
 *  - 0 : email inexistant OU compte banni (pas de leak d'existence)
 *  - 1 : profile correspondant (sans l'email — le caller le connaît déjà)
 *
 * Erreur P0001 `rate_limit_exceeded` à intercepter via `isRateLimitError`.
 */
export function useEmailSearch() {
  return useMutation({
    mutationFn: async (email: string): Promise<UserSearchResult | null> => {
      const { data, error } = await supabase.rpc('find_user_by_email', {
        p_email: email
      })
      if (error) {
        logger.error('search.email', 'rpc failed', error)
        throw error
      }
      const list = (data ?? []) as UserSearchResult[]
      return list[0] ?? null
    }
  })
}
