import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { RECENT_FEED_LIMIT } from '@/lib/constants'
import type {
  Piano,
  PianoSession,
  PianoUpdate,
  PianoVisit,
  Profile
} from '@/types/database'

type NewPianoEvent = {
  kind: 'new'
  id: string
  created_at: string
  piano: Piano & { author: Pick<Profile, 'pseudo'> | null }
}

type UpdateEvent = {
  kind: 'update'
  id: string
  created_at: string
  update: PianoUpdate & {
    author: Pick<Profile, 'pseudo'> | null
    piano: Pick<Piano, 'id' | 'address' | 'photo_url'> | null
  }
}

type VisitEvent = {
  kind: 'visit'
  id: string
  created_at: string
  visit: PianoVisit & {
    author: Pick<Profile, 'pseudo'> | null
    piano: Pick<Piano, 'id' | 'address' | 'photo_url'> | null
  }
}

type SessionEvent = {
  kind: 'session'
  id: string
  created_at: string
  session: PianoSession & {
    author: Pick<Profile, 'pseudo'> | null
    piano: Pick<Piano, 'id' | 'address' | 'photo_url'> | null
  }
}

export type FeedEvent = NewPianoEvent | UpdateEvent | VisitEvent | SessionEvent

type RawPianoRow = Piano & { author: Pick<Profile, 'pseudo'> | null }
type RawUpdateRow = PianoUpdate & {
  author: Pick<Profile, 'pseudo'> | null
  piano: Pick<Piano, 'id' | 'address' | 'photo_url'> | null
}
type RawVisitRow = PianoVisit & {
  author: Pick<Profile, 'pseudo'> | null
  piano: Pick<Piano, 'id' | 'address' | 'photo_url'> | null
}
type RawSessionRow = PianoSession & {
  author: Pick<Profile, 'pseudo'> | null
  piano: Pick<Piano, 'id' | 'address' | 'photo_url'> | null
}

/**
 * Feed unifié des derniers événements (ajouts + MAJ + passages + sessions).
 *
 * Stratégie : fetch chaque source en parallèle (toutes triées DESC), merge par
 * date décroissante côté client, slice au `limit` global. Suffisant tant qu'on
 * a peu d'activité ; à reconsidérer en cas de fort trafic (RPC ou view SQL).
 *
 * Filtre côté session : on n'affiche dans le feed que les sessions démarrant
 * dans les 36h (passé proche ou futur proche) pour éviter le bruit "Marie joue
 * dans 6 jours" dans le flux d'activité.
 */
export function useRecentFeed(limit = RECENT_FEED_LIMIT) {
  return useQuery({
    queryKey: ['recent-feed', limit],
    queryFn: async (): Promise<FeedEvent[]> => {
      const since36hPast = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
      const until36hFuture = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString()

      const [pianosRes, updatesRes, visitsRes, sessionsRes] = await Promise.all([
        supabase
          .from('pianos')
          .select('*, author:profiles!pianos_created_by_fkey(pseudo)')
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('piano_updates')
          .select(
            '*, author:profiles!piano_updates_updated_by_fkey(pseudo), piano:pianos!piano_updates_piano_id_fkey(id, address, photo_url)'
          )
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('piano_visits')
          .select(
            '*, author:profiles!piano_visits_user_id_fkey(pseudo), piano:pianos!piano_visits_piano_id_fkey(id, address, photo_url)'
          )
          .order('visited_at', { ascending: false })
          .limit(limit),
        supabase
          .from('piano_sessions')
          .select(
            '*, author:profiles!piano_sessions_user_id_fkey(pseudo), piano:pianos!piano_sessions_piano_id_fkey(id, address, photo_url)'
          )
          .is('cancelled_at', null)
          .gte('starts_at', since36hPast)
          .lte('starts_at', until36hFuture)
          .order('starts_at', { ascending: false })
          .limit(limit)
      ])

      if (pianosRes.error) {
        logger.error('feed.recent', 'pianos select failed', pianosRes.error)
        throw pianosRes.error
      }
      if (updatesRes.error) {
        logger.error('feed.recent', 'updates select failed', updatesRes.error)
        throw updatesRes.error
      }
      if (visitsRes.error) {
        logger.error('feed.recent', 'visits select failed', visitsRes.error)
        throw visitsRes.error
      }
      if (sessionsRes.error) {
        logger.error('feed.recent', 'sessions select failed', sessionsRes.error)
        throw sessionsRes.error
      }

      const events: FeedEvent[] = []
      for (const p of (pianosRes.data ?? []) as unknown as RawPianoRow[]) {
        events.push({ kind: 'new', id: `new-${p.id}`, created_at: p.created_at, piano: p })
      }
      for (const u of (updatesRes.data ?? []) as unknown as RawUpdateRow[]) {
        events.push({ kind: 'update', id: `upd-${u.id}`, created_at: u.created_at, update: u })
      }
      for (const v of (visitsRes.data ?? []) as unknown as RawVisitRow[]) {
        events.push({
          kind: 'visit',
          id: `vis-${v.id}`,
          created_at: v.visited_at,
          visit: v
        })
      }
      for (const s of (sessionsRes.data ?? []) as unknown as RawSessionRow[]) {
        events.push({
          kind: 'session',
          id: `ses-${s.id}`,
          created_at: s.created_at,
          session: s
        })
      }
      return events
        .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
        .slice(0, limit)
    }
  })
}
