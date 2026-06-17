import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useAuth } from '@/contexts/AuthContext'
import { USER_SEARCH_MIN_CHARS } from '@/lib/constants'
import type { PianoSearchResult } from '@/types/database'

/**
 * v7 — Recherche piano via RPC SECURITY DEFINER `search_pianos`.
 *
 * Fuzzy match accent-insensitive sur address + comment (pg_trgm + unaccent,
 * threshold 0.1). Auth required (anti-scraping). LIMIT 30. Filtre is_deleted
 * et exclut les pianos dont l'auteur est banni.
 *
 * Debounce via staleTime + min 2 chars. Pas de refetchInterval — un user qui
 * cherche relance manuellement.
 */
export function usePianoSearch(query: string) {
  const { user } = useAuth()
  const trimmed = query.trim()
  return useQuery({
    queryKey: ['piano-search', trimmed],
    enabled: !!user && trimmed.length >= USER_SEARCH_MIN_CHARS && trimmed.length <= 100,
    staleTime: 30_000,
    queryFn: async (): Promise<PianoSearchResult[]> => {
      const { data, error } = await supabase.rpc('search_pianos', { q: trimmed })
      if (error) {
        logger.error('search.pianos', 'rpc failed', error, { q: trimmed })
        throw error
      }
      return (data ?? []) as PianoSearchResult[]
    }
  })
}
