import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * KPIs admin : ~10 count queries lancées en parallèle. Pour l'instant on
 * accepte le coût réseau (1 RTT chacune en HTTP/2 = très peu). Si l'app grossit
 * fort, basculer sur une RPC SQL agrégée (`admin_kpis()`).
 */

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

async function countRows(
  table:
    | 'profiles'
    | 'pianos'
    | 'piano_visits'
    | 'piano_sessions'
    | 'piano_reports'
    | 'user_requests',
  build: (q: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from(table).select('*', { count: 'exact', head: true })
  q = build(q)
  const { count, error } = await q
  if (error) {
    logger.error('admin.kpis', `count ${table} failed`, error)
    throw error
  }
  return count ?? 0
}

export function useAdminKpis() {
  return useQuery({
    queryKey: ['admin-kpis'],
    staleTime: 60_000,
    queryFn: async (): Promise<AdminKpis> => {
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const nowIso = new Date().toISOString()

      const [
        users_total,
        users_new_7d,
        users_new_30d,
        users_banned,
        users_admin,
        pianos_total,
        pianos_new_7d,
        visits_total,
        sessionsRecent,
        reports_open,
        requests_open
      ] = await Promise.all([
        countRows('profiles', (q) => q),
        countRows('profiles', (q) => q.gte('created_at', since7d)),
        countRows('profiles', (q) => q.gte('created_at', since30d)),
        countRows('profiles', (q) => q.not('banned_at', 'is', null)),
        countRows('profiles', (q) => q.in('role', ['admin', 'superadmin'])),
        countRows('pianos', (q) => q.eq('is_deleted', false)),
        countRows('pianos', (q) =>
          q.eq('is_deleted', false).gte('created_at', since7d)
        ),
        countRows('piano_visits', (q) => q),
        // Sessions "potentiellement actives" : on filtre côté SQL sur les
        // dernières 24h non annulées, et on raffine côté client (fait dans
        // useActivePianoIds pour la carte, mais pour le KPI on prend une
        // approximation simple).
        countRows('piano_sessions', (q) =>
          q.is('cancelled_at', null).gte('starts_at', since24h).lte('starts_at', nowIso)
        ),
        countRows('piano_reports', (q) => q.eq('resolved', false)),
        countRows('user_requests', (q) => q.eq('status', 'open'))
      ])

      return {
        users_total,
        users_new_7d,
        users_new_30d,
        users_banned,
        users_admin,
        pianos_total,
        pianos_new_7d,
        visits_total,
        sessions_active: sessionsRecent,
        reports_open,
        requests_open
      }
    }
  })
}
