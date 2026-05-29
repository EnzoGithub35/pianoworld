import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useAuth } from '@/contexts/AuthContext'
import type { Profile, UserRequest } from '@/types/database'

export type UserRequestWithUser = UserRequest & {
  author: Pick<Profile, 'id' | 'pseudo'> | null
}

/** Mes propres demandes (RLS : SELECT own). */
export function useMyRequests() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-requests', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<UserRequest[]> => {
      if (!user) return []
      const { data, error } = await supabase
        .from('user_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) {
        logger.error('requests.my', 'select failed', error)
        throw error
      }
      return data ?? []
    }
  })
}

/** Toutes les demandes pour l'admin, filtrées par statut. */
export function useAdminRequests(status: 'open' | 'answered') {
  return useQuery({
    queryKey: ['admin-requests', status],
    staleTime: 30_000,
    queryFn: async (): Promise<UserRequestWithUser[]> => {
      const { data, error } = await supabase
        .from('user_requests')
        .select('*, author:profiles!user_requests_user_id_fkey(id, pseudo)')
        .eq('status', status)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) {
        logger.error('admin.requests', 'select failed', error, { status })
        throw error
      }
      return (data as unknown as UserRequestWithUser[]) ?? []
    }
  })
}
