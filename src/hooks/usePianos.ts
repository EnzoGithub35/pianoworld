import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { Piano, Profile } from '@/types/database'

export type PianoWithAuthor = Piano & {
  author: Pick<Profile, 'pseudo'> | null
  /** Vrai si aucune MAJ "disparu" récente — calculé client-side depuis piano_updates. */
  still_there: boolean
}

type RawPiano = Piano & { author: Pick<Profile, 'pseudo'> | null }
type LatestUpdate = { piano_id: string; still_there: boolean }

/**
 * Liste tous les pianos non supprimés + leur auteur + calcule l'état "encore là"
 * depuis la dernière MAJ. Un seul Promise.all pour minimiser les RTT.
 */
export function usePianos() {
  return useQuery({
    queryKey: ['pianos'],
    queryFn: async (): Promise<PianoWithAuthor[]> => {
      const [pianosRes, updatesRes] = await Promise.all([
        supabase
          .from('pianos')
          .select('*, author:profiles!pianos_created_by_fkey(pseudo)')
          .eq('is_deleted', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('piano_updates')
          .select('piano_id, still_there, created_at')
          .order('created_at', { ascending: false })
      ])

      if (pianosRes.error) {
        logger.error('pianos.fetch', 'select failed', pianosRes.error)
        throw pianosRes.error
      }
      if (updatesRes.error) {
        logger.error('pianos.fetch', 'updates select failed', updatesRes.error)
        throw updatesRes.error
      }

      const latest = new Map<string, boolean>()
      for (const u of (updatesRes.data ?? []) as LatestUpdate[]) {
        if (!latest.has(u.piano_id)) latest.set(u.piano_id, u.still_there)
      }

      const rows = (pianosRes.data ?? []) as unknown as RawPiano[]
      logger.debug('pianos.fetch', 'success', {
        count: rows.length,
        withUpdates: latest.size
      })
      return rows.map((p) => ({ ...p, still_there: latest.get(p.id) ?? true }))
    }
  })
}
