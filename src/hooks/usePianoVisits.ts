import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { PianoVisit, Profile } from '@/types/database'

export type PianoVisitWithAuthor = PianoVisit & {
  author: Pick<Profile, 'id' | 'pseudo'> | null
}

/**
 * Liste les passages d'un piano, du plus récent au plus ancien.
 * Aucune dédup côté serveur : on garde tout l'historique. La dédup par
 * visiteur (pour le VisitorStack) se fait côté composant.
 */
export function usePianoVisits(pianoId: string | undefined) {
  return useQuery({
    queryKey: ['piano-visits', pianoId],
    enabled: !!pianoId,
    queryFn: async (): Promise<PianoVisitWithAuthor[]> => {
      if (!pianoId) return []
      const { data, error } = await supabase
        .from('piano_visits')
        .select('*, author:profiles!piano_visits_user_id_fkey(id, pseudo)')
        .eq('piano_id', pianoId)
        .order('visited_at', { ascending: false })
        .limit(100)
      if (error) {
        logger.error('visits.fetch', 'select failed', error, { pianoId })
        throw error
      }
      return (data as unknown as PianoVisitWithAuthor[]) ?? []
    }
  })
}
