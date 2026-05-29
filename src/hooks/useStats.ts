import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { PIANO_QUALITIES, type PianoQuality } from '@/types/database'

export type GlobalStats = {
  total: number
  byQuality: Record<PianoQuality, number>
  goodPercent: number
}

const GOOD_QUALITIES: readonly PianoQuality[] = ['neuf', 'bon_etat', 'potable']

function emptyByQuality(): Record<PianoQuality, number> {
  return PIANO_QUALITIES.reduce(
    (acc, q) => {
      acc[q] = 0
      return acc
    },
    {} as Record<PianoQuality, number>
  )
}

export function useGlobalStats() {
  return useQuery({
    queryKey: ['global-stats'],
    queryFn: async (): Promise<GlobalStats> => {
      const { data, error } = await supabase
        .from('pianos')
        .select('quality')
        .eq('is_deleted', false)
      if (error) {
        logger.error('stats.global', 'failed', error)
        throw error
      }
      const rows = data ?? []
      const byQuality = emptyByQuality()
      for (const row of rows) byQuality[row.quality as PianoQuality]++
      const good = GOOD_QUALITIES.reduce((acc, q) => acc + byQuality[q], 0)
      const goodPercent = rows.length === 0 ? 0 : Math.round((good / rows.length) * 100)
      return { total: rows.length, byQuality, goodPercent }
    }
  })
}
