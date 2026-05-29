import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useAuth } from '@/contexts/AuthContext'
import type { EventRow, Profile } from '@/types/database'

export type EventWithCounts = EventRow & {
  author: Pick<Profile, 'pseudo'> | null
  participants_count: number
  participants_preview: Pick<Profile, 'id' | 'pseudo'>[]
}

/**
 * Liste les évènements non annulés à venir (ou en cours), triés par date.
 * Pour chaque event on récupère un count + les 5 premiers participants pour
 * la stack d'avatars dans la card.
 */
export function useEvents(includePast = false) {
  return useQuery({
    queryKey: ['events', includePast ? 'all' : 'upcoming'],
    staleTime: 30_000,
    queryFn: async (): Promise<EventWithCounts[]> => {
      let q = supabase
        .from('events')
        .select(
          '*, author:profiles!events_created_by_fkey(pseudo), participants:event_participants(user_id, joined_at, profile:profiles!event_participants_user_id_fkey(id, pseudo))'
        )
        .is('cancelled_at', null)
        .order('starts_at', { ascending: true })
      if (!includePast) {
        // tolerance 1h après le début pour garder les "live now"
        q = q.gte('starts_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      }
      const { data, error } = await q
      if (error) {
        logger.error('events.fetch', 'select failed', error)
        throw error
      }
      type Raw = EventRow & {
        author: Pick<Profile, 'pseudo'> | null
        participants: {
          user_id: string
          joined_at: string
          profile: Pick<Profile, 'id' | 'pseudo'> | null
        }[]
      }
      return ((data ?? []) as unknown as Raw[]).map((e) => ({
        ...e,
        participants_count: e.participants.length,
        participants_preview: e.participants
          .slice(0, 5)
          .map((p) => p.profile)
          .filter((p): p is Pick<Profile, 'id' | 'pseudo'> => !!p)
      }))
    }
  })
}

/**
 * Set des event IDs auxquels le user courant participe. Permet d'afficher
 * "Je viens" ou "Je ne viens plus" sur chaque card sans une query par event.
 */
export function useMyParticipations() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-participations', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<Set<string>> => {
      if (!user) return new Set()
      const { data, error } = await supabase
        .from('event_participants')
        .select('event_id')
        .eq('user_id', user.id)
      if (error) {
        logger.error('events.myParticipations', 'select failed', error)
        throw error
      }
      return new Set((data ?? []).map((r) => r.event_id))
    }
  })
}
