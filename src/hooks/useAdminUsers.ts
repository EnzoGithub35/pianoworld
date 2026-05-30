import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { Profile } from '@/types/database'

export type AdminUserFilter = 'all' | 'banned' | 'admin'

export type AdminUserRow = Profile & { email: string | null }

/**
 * Liste paginée des utilisateurs côté admin. Passe par la RPC
 * `admin_list_users` SECURITY DEFINER qui (a) refuse l'appel si l'appelant
 * n'est pas admin, (b) contourne le revoke colonne-level sur public.profiles
 * pour exposer `role` et `banned_at`.
 *
 * L'email reste à null ici — il vit dans auth.users, accessible uniquement
 * via supabase.auth.admin côté Edge Function. Affiché dans le dashboard
 * Supabase si besoin.
 */
export function useAdminUsers(query: string, filter: AdminUserFilter = 'all') {
  const trimmed = query.trim()
  return useQuery({
    queryKey: ['admin-users', trimmed, filter],
    staleTime: 30_000,
    queryFn: async (): Promise<AdminUserRow[]> => {
      const { data, error } = await supabase.rpc('admin_list_users', {
        q: trimmed,
        filter,
        lim: 50
      })
      if (error) {
        logger.error('admin.users', 'list failed', error, { query: trimmed, filter })
        throw error
      }
      return (data ?? []).map((p) => ({ ...p, email: null }))
    }
  })
}
