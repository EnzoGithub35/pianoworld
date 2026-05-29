import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { ACTIVE_SESSIONS_STALE_MS } from '@/lib/constants'
import {
  isSessionActive,
  isSessionPast,
  isSessionUpcoming
} from '@/lib/session-status'
import type { PianoSession, Profile } from '@/types/database'

export type PianoSessionWithAuthor = PianoSession & {
  author: Pick<Profile, 'id' | 'pseudo'> | null
}

/**
 * Sessions d'un piano. Filtre les annulées (cancelled_at IS NULL) côté SQL.
 * Le tri par status (active / upcoming / past) se fait côté composant via les
 * helpers de `session-status.ts`.
 */
export function usePianoSessions(pianoId: string | undefined) {
  return useQuery({
    queryKey: ['piano-sessions', pianoId],
    enabled: !!pianoId,
    staleTime: ACTIVE_SESSIONS_STALE_MS,
    queryFn: async (): Promise<PianoSessionWithAuthor[]> => {
      if (!pianoId) return []
      const { data, error } = await supabase
        .from('piano_sessions')
        .select('*, author:profiles!piano_sessions_user_id_fkey(id, pseudo)')
        .eq('piano_id', pianoId)
        .is('cancelled_at', null)
        .order('starts_at', { ascending: true })
      if (error) {
        logger.error('sessions.fetch', 'select failed', error, { pianoId })
        throw error
      }
      return (data as unknown as PianoSessionWithAuthor[]) ?? []
    }
  })
}

/**
 * Set des piano_id pour lesquels au moins une session est active maintenant.
 * Utilisé par PianoMap pour décider quel marker faire pulser. Refetch fréquent
 * (stale 30s) pour rester réactif.
 */
export function useActivePianoIds() {
  return useQuery({
    queryKey: ['active-piano-ids'],
    staleTime: ACTIVE_SESSIONS_STALE_MS,
    refetchInterval: ACTIVE_SESSIONS_STALE_MS,
    queryFn: async (): Promise<Set<string>> => {
      const nowIso = new Date().toISOString()
      // On ne peut pas calculer "starts_at + duration_min" en RLS-public sans
      // RPC ; donc on récupère les sessions récentes (24h glissantes) et on
      // filtre client-side via isSessionActive.
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('piano_sessions')
        .select('piano_id, starts_at, duration_min, cancelled_at')
        .is('cancelled_at', null)
        .gte('starts_at', since)
        .lte('starts_at', nowIso)
      if (error) {
        logger.error('sessions.active', 'select failed', error)
        throw error
      }
      const now = new Date()
      const ids = new Set<string>()
      for (const s of data ?? []) {
        if (isSessionActive(s as PianoSession, now)) ids.add(s.piano_id)
      }
      return ids
    }
  })
}

/** Re-export utilitaires pour les composants. */
export { isSessionActive, isSessionUpcoming, isSessionPast }
