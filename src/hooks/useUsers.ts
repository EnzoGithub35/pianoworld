import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { USER_SEARCH_MIN_CHARS } from '@/lib/constants'
import type { Piano, Profile, UserSearchResult } from '@/types/database'

/**
 * Représentation publique d'un profil : ce que tout utilisateur peut voir
 * d'un autre user. Volontairement amputée de `role` et `banned_at` qui sont
 * filtrés au niveau des grants colonne sur public.profiles (cf. schema.sql
 * section 11.a). Pour la version complète d'un profil (self), passer par
 * `supabase.rpc('get_my_profile')` ; pour la version admin, par
 * `supabase.rpc('admin_list_users')`.
 *
 * v7 : étendu avec `first_name` / `last_name` opt-in. Ces colonnes sont
 * exclues des column-grants → invisibles via PostgREST direct, lecture
 * uniquement via RPCs SECURITY DEFINER (`search_users`, `find_user_by_email`).
 */
export type PublicProfile = Pick<Profile, 'id' | 'pseudo' | 'created_at'> & {
  first_name?: string | null
  last_name?: string | null
}

/**
 * v7 — Recherche utilisateur via RPC `search_users` (fuzzy 3 colonnes :
 * pseudo + first_name + last_name, accent-insensitive, threshold 0.1).
 * Remplace l'ancien ILIKE pseudo-only.
 *
 * LIMIT 20 côté RPC. Auth required.
 */
export function useUserSearch(query: string) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: ['users-search', trimmed],
    enabled: trimmed.length >= USER_SEARCH_MIN_CHARS,
    staleTime: 30_000,
    queryFn: async (): Promise<UserSearchResult[]> => {
      const { data, error } = await supabase.rpc('search_users', { q: trimmed })
      if (error) {
        logger.error('users.search', 'rpc failed', error, { q: trimmed })
        throw error
      }
      return (data ?? []) as UserSearchResult[]
    }
  })
}

export function useProfileByPseudo(pseudo: string | undefined) {
  return useQuery({
    queryKey: ['profile', pseudo],
    enabled: !!pseudo,
    queryFn: async (): Promise<PublicProfile | null> => {
      if (!pseudo) return null
      // On chercher d'abord par pseudo (column-grant disponible). Si first_name
      // ou last_name sont opt-in, ils ne sont pas accessibles via cette query
      // (column-grants excluent) — pour les afficher sur UserPage, il faut
      // utiliser search_users(pseudo) ci-dessus qui passe par RPC.
      const { data, error } = await supabase
        .from('profiles')
        .select('id, pseudo, created_at')
        .ilike('pseudo', pseudo)
        .maybeSingle()
      if (error) {
        logger.error('users.profile', 'failed', error, { pseudo })
        throw error
      }
      if (!data) return null
      // Enrichit via search_users(pseudo) pour récupérer first_name / last_name
      // si opt-in. Best-effort : si la RPC échoue, on garde les champs publics.
      try {
        const { data: enriched } = await supabase.rpc('search_users', {
          q: data.pseudo
        })
        const match = ((enriched ?? []) as UserSearchResult[]).find(
          (u) => u.id === data.id
        )
        if (match) {
          return {
            ...data,
            first_name: match.first_name,
            last_name: match.last_name
          }
        }
      } catch {
        // RPC indisponible : on tombe sur les champs publics seulement.
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
