import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { Piano, PianoReport, Profile } from '@/types/database'

export type ReportWithContext = PianoReport & {
  reporter: Pick<Profile, 'id' | 'pseudo'> | null
  piano: Pick<Piano, 'id' | 'address' | 'photo_url' | 'is_deleted'> | null
}

/**
 * Liste les signalements non résolus + auteur + piano joints. Utilisé par
 * ReportsTab. La policy `piano_reports_select_admin` permet ce SELECT côté RLS.
 */
export function useAdminReports() {
  return useQuery({
    queryKey: ['admin-reports'],
    staleTime: 30_000,
    queryFn: async (): Promise<ReportWithContext[]> => {
      const { data, error } = await supabase
        .from('piano_reports')
        .select(
          '*, reporter:profiles!piano_reports_reported_by_fkey(id, pseudo), piano:pianos!piano_reports_piano_id_fkey(id, address, photo_url, is_deleted)'
        )
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) {
        logger.error('admin.reports', 'select failed', error)
        throw error
      }
      return (data as unknown as ReportWithContext[]) ?? []
    }
  })
}
