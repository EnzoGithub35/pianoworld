import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { COMMUNITY_FUTURE_DAYS, COMMUNITY_PAST_DAYS } from '@/lib/constants'
import type { Piano, PianoSession, PianoVisit, Profile } from '@/types/database'

/**
 * Hook pour l'onglet "Communauté" du Dashboard.
 *
 * Récupère sur une fenêtre temporelle ±COMMUNITY_*_DAYS :
 *  - Les sessions de présence à venir et passées
 *  - Les passages déclarés
 *
 * Les deux sont sérialisés en un type unifié `CommunityEvent` avec un `date_at`
 * (date principale d'ancrage : visited_at pour les visites, starts_at pour les
 * sessions). Cela permet le tri unique et le bucketing par jour dans le calendrier.
 */

export type CommunityEvent =
  | {
      kind: 'visit'
      id: string
      date_at: string
      visit: PianoVisit & {
        author: Pick<Profile, 'pseudo'> | null
        piano: Pick<Piano, 'id' | 'address'> | null
      }
    }
  | {
      kind: 'session'
      id: string
      date_at: string
      session: PianoSession & {
        author: Pick<Profile, 'pseudo'> | null
        piano: Pick<Piano, 'id' | 'address'> | null
      }
    }

type RawVisitRow = PianoVisit & {
  author: Pick<Profile, 'pseudo'> | null
  piano: Pick<Piano, 'id' | 'address'> | null
}
type RawSessionRow = PianoSession & {
  author: Pick<Profile, 'pseudo'> | null
  piano: Pick<Piano, 'id' | 'address'> | null
}

export function useCommunityFeed() {
  return useQuery({
    queryKey: ['community-feed'],
    staleTime: 30_000,
    queryFn: async (): Promise<CommunityEvent[]> => {
      const since = new Date(
        Date.now() - COMMUNITY_PAST_DAYS * 24 * 60 * 60 * 1000
      ).toISOString()
      const until = new Date(
        Date.now() + COMMUNITY_FUTURE_DAYS * 24 * 60 * 60 * 1000
      ).toISOString()

      const [visitsRes, sessionsRes] = await Promise.all([
        supabase
          .from('piano_visits')
          .select(
            '*, author:profiles!piano_visits_user_id_fkey(pseudo), piano:pianos!piano_visits_piano_id_fkey(id, address)'
          )
          .gte('visited_at', since)
          .order('visited_at', { ascending: false })
          .limit(300),
        supabase
          .from('piano_sessions')
          .select(
            '*, author:profiles!piano_sessions_user_id_fkey(pseudo), piano:pianos!piano_sessions_piano_id_fkey(id, address)'
          )
          .is('cancelled_at', null)
          .gte('starts_at', since)
          .lte('starts_at', until)
          .order('starts_at', { ascending: true })
          .limit(300)
      ])

      if (visitsRes.error) {
        logger.error('community.visits', 'select failed', visitsRes.error)
        throw visitsRes.error
      }
      if (sessionsRes.error) {
        logger.error('community.sessions', 'select failed', sessionsRes.error)
        throw sessionsRes.error
      }

      const events: CommunityEvent[] = []
      for (const v of (visitsRes.data ?? []) as unknown as RawVisitRow[]) {
        if (!v.piano) continue
        events.push({
          kind: 'visit',
          id: `vis-${v.id}`,
          date_at: v.visited_at,
          visit: v
        })
      }
      for (const s of (sessionsRes.data ?? []) as unknown as RawSessionRow[]) {
        if (!s.piano) continue
        events.push({
          kind: 'session',
          id: `ses-${s.id}`,
          date_at: s.starts_at,
          session: s
        })
      }
      return events
    }
  })
}
