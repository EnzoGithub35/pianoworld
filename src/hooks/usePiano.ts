import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { Piano, PianoUpdate, Profile } from '@/types/database'

export type PianoDetail = Piano & {
  author: Pick<Profile, 'id' | 'pseudo'> | null
}

export type PianoUpdateWithAuthor = PianoUpdate & {
  author: Pick<Profile, 'id' | 'pseudo'> | null
}

export function usePiano(id: string | undefined) {
  return useQuery({
    queryKey: ['piano', id],
    enabled: !!id,
    queryFn: async (): Promise<PianoDetail | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from('pianos')
        .select('*, author:profiles!pianos_created_by_fkey(id, pseudo)')
        .eq('id', id)
        .maybeSingle()
      if (error) {
        logger.error('piano.fetch', 'select failed', error, { pianoId: id })
        throw error
      }
      return (data as unknown as PianoDetail) ?? null
    }
  })
}

export function usePianoUpdates(pianoId: string | undefined) {
  return useQuery({
    queryKey: ['piano-updates', pianoId],
    enabled: !!pianoId,
    queryFn: async (): Promise<PianoUpdateWithAuthor[]> => {
      if (!pianoId) return []
      const { data, error } = await supabase
        .from('piano_updates')
        .select('*, author:profiles!piano_updates_updated_by_fkey(id, pseudo)')
        .eq('piano_id', pianoId)
        .order('created_at', { ascending: false })
      if (error) {
        logger.error('piano.updates.fetch', 'select failed', error, { pianoId })
        throw error
      }
      return (data as unknown as PianoUpdateWithAuthor[]) ?? []
    }
  })
}
