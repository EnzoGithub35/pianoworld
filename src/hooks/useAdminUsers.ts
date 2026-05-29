import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { Profile } from '@/types/database'

export type AdminUserFilter = 'all' | 'banned' | 'admin'

export type AdminUserRow = Profile & { email: string | null }

/**
 * Liste des utilisateurs avec filtres. L'email n'est PAS exposé côté RLS
 * publique : on n'y accède que via les profils enrichis quand l'admin appelle
 * une fonction dédiée. Ici on se contente du profil (sans email) — l'email
 * sensible n'est affiché que dans l'auth dashboard Supabase.
 */
export function useAdminUsers(query: string, filter: AdminUserFilter = 'all') {
  const trimmed = query.trim()
  return useQuery({
    queryKey: ['admin-users', trimmed, filter],
    staleTime: 30_000,
    queryFn: async (): Promise<AdminUserRow[]> => {
      let q = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (trimmed.length >= 2) q = q.ilike('pseudo', `%${trimmed}%`)
      if (filter === 'banned') q = q.not('banned_at', 'is', null)
      if (filter === 'admin') q = q.in('role', ['admin', 'superadmin'])
      const { data, error } = await q
      if (error) {
        logger.error('admin.users', 'list failed', error, { query: trimmed, filter })
        throw error
      }
      return (data ?? []).map((p) => ({ ...p, email: null }))
    }
  })
}
