import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { USER_SEARCH_MIN_CHARS, USER_SEARCH_MAX_RESULTS } from '@/lib/constants'
import type { Piano, Profile } from '@/types/database'

/**
 * Représentation publique d'un profil : ce que tout utilisateur peut voir
 * d'un autre user. Volontairement amputée de `role` et `banned_at` qui sont
 * filtrés au niveau des grants colonne sur public.profiles (cf. schema.sql
 * section 11.a). Pour la version complète d'un profil (self), passer par
 * `supabase.rpc('get_my_profile')` ; pour la version admin, par
 * `supabase.rpc('admin_list_users')`.
 */
export type PublicProfile = Pick<Profile, 'id' | 'pseudo' | 'created_at'>

export function useUserSearch(query: string) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: ['users-search', trimmed],
    enabled: trimmed.length >= USER_SEARCH_MIN_CHARS,
    queryFn: async (): Promise<PublicProfile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, pseudo, created_at')
        .ilike('pseudo', `%${trimmed}%`)
        .order('pseudo', { ascending: true })
        .limit(USER_SEARCH_MAX_RESULTS)
      if (error) {
        logger.error('users.search', 'failed', error, { query: trimmed })
        throw error
      }
      return data ?? []
    }
  })
}

export function useProfileByPseudo(pseudo: string | undefined) {
  return useQuery({
    queryKey: ['profile', pseudo],
    enabled: !!pseudo,
    queryFn: async (): Promise<PublicProfile | null> => {
      if (!pseudo) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('id, pseudo, created_at')
        .ilike('pseudo', pseudo)
        .maybeSingle()
      if (error) {
        logger.error('users.profile', 'failed', error, { pseudo })
        throw error
      }
      return data
    }
  })
}

export function useUserPianos(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-pianos', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Piano[]> => {
      if (!userId) return []
      const { data, error } = await supabase
        .from('pianos')
        .select('*')
        .eq('created_by', userId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
      if (error) {
        logger.error('users.pianos', 'failed', error, { userId })
        throw error
      }
      return data ?? []
    }
  })
}
