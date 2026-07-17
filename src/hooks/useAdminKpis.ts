import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export type AdminKpis = {
  users_total: number
  users_new_7d: number
  users_new_30d: number
  users_banned: number
  users_admin: number
  pianos_total: number
  pianos_new_7d: number
  visits_total: number
  sessions_active: number
  reports_open: number
  requests_open: number
}

export function useAdminKpis() {
  return useQuery({
    queryKey: ['admin-kpis'],
    staleTime: 60_000,
    queryFn: async (): Promise<AdminKpis> => {
      const { data, error } = await supabase.rpc('admin_kpis').single()
      if (error) {
        logger.error('admin.kpis', 'admin_kpis rpc failed', error)
        throw error
      }
      return data as AdminKpis
    }
  })
}
