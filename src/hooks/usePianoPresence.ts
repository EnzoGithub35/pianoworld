import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useAuth } from '@/contexts/AuthContext'
import { PRESENCE_STALE_MS } from '@/lib/constants'
import type { PianoPresenceCount, PresenceEntry } from '@/types/database'

/**
 * Hooks de présence (v6).
 *
 * - `usePianoActiveCounts(pianoIds)` : batch RPC pour PianoMap (1 query au lieu
 *   de N). Retourne une Map<piano_id, count>. Remplace useActivePianoIds.
 * - `usePianoPresenceList(pianoId)` : sessions actives + upcoming visibles
 *   au caller (filtrage visibility côté SQL). Pour PianoPage + PresenceListDialog.
 *
 * Convention privacy : les 2 RPCs côté DB appliquent le MÊME filtre visibility
 * (cf. PR-A). Le compteur reflète ce que le caller VOIT, donc pas de delta
 * cardinalité exploitable pour deviner les friends-only invisibles.
 */

/** Count batch pour PianoMap (drive le pulse marker + compteur popup). */
export function usePianoActiveCounts(pianoIds: string[]) {
  const { user } = useAuth()
  // Stable key = pianoIds sorted (TanStack hash sur tableau).
  const sortedIds = [...pianoIds].sort()
  return useQuery({
    queryKey: ['piano-active-counts', user?.id ?? 'anon', sortedIds],
    enabled: pianoIds.length > 0,
    staleTime: PRESENCE_STALE_MS,
    refetchInterval: PRESENCE_STALE_MS,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase.rpc('get_active_piano_counts', {
        piano_ids: sortedIds
      })
      if (error) {
        logger.error('piano.presence.counts', 'rpc failed', error, {
          n: sortedIds.length
        })
        throw error
      }
      const rows = (data ?? []) as PianoPresenceCount[]
      return new Map(rows.map((r) => [r.piano_id, r.count]))
    }
  })
}

/** Liste détaillée des sessions live + upcoming sur un piano. */
export function usePianoPresenceList(pianoId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['piano-presence-list', pianoId, user?.id ?? 'anon'],
    enabled: !!pianoId,
    staleTime: PRESENCE_STALE_MS,
    refetchInterval: PRESENCE_STALE_MS,
    queryFn: async (): Promise<PresenceEntry[]> => {
      const { data, error } = await supabase.rpc('list_piano_presence', {
        p_piano: pianoId!
      })
      if (error) {
        logger.error('piano.presence.list', 'rpc failed', error, { pianoId })
        throw error
      }
      return (data ?? []) as PresenceEntry[]
    }
  })
}

/** Count "live" pour un seul piano (PianoPage + popup carte).
 *  Filtre les sessions actuellement actives parmi la liste retournée par
 *  usePianoPresenceList. Évite un 2e roundtrip pour la simple cardinalité. */
export function usePianoActiveCount(pianoId: string | undefined): {
  count: number
  isLoading: boolean
} {
  const { data, isLoading } = usePianoPresenceList(pianoId)
  if (!data) return { count: 0, isLoading }
  const now = Date.now()
  const live = data.filter((s) => {
    const startMs = Date.parse(s.starts_at)
    return startMs <= now && now <= startMs + s.duration_min * 60_000
  })
  return { count: live.length, isLoading }
}
