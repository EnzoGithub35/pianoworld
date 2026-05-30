import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { AuditLogEntry, Profile } from '@/types/database'

export type AuditLogWithActor = AuditLogEntry & {
  actor: Pick<Profile, 'id' | 'pseudo'> | null
}

/**
 * Lecture du journal des actions admin.
 *
 * Filtres : par action (string), par actor (uuid). Limite forte (200) — la
 * table grossit vite ; pour aller plus loin il faudra paginer via un curseur
 * sur `id` qui est bigserial monotone.
 */
export function useAuditLog(opts: { action?: string; actorId?: string } = {}) {
  return useQuery({
    queryKey: ['audit-log', opts.action ?? null, opts.actorId ?? null],
    staleTime: 10_000,
    queryFn: async (): Promise<AuditLogWithActor[]> => {
      let q = supabase
        .from('audit_log')
        .select('*, actor:profiles!audit_log_actor_id_fkey(id, pseudo)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (opts.action) q = q.eq('action', opts.action)
      if (opts.actorId) q = q.eq('actor_id', opts.actorId)
      const { data, error } = await q
      if (error) {
        logger.error('admin.auditLog', 'select failed', error, opts)
        throw error
      }
      return (data ?? []) as unknown as AuditLogWithActor[]
    }
  })
}
