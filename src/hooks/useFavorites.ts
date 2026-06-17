import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useAuth } from '@/contexts/AuthContext'
import type { FavoriteWithPiano } from '@/types/database'

/**
 * v7 — Pianos favoris (RPCs `get_my_favorites` + `toggle_piano_favorite`).
 *
 * Pattern symétrique de useFriends : optimistic update sur 2 queryKeys
 * (`favorites` + `favorite-status`), rollback sur error, invalidation cascade
 * en onSettled.
 *
 * Cache invalidation : la mutation toggle invalide `favorites` ET le statut
 * du piano touché. Note : on N'invalide PAS `recent-feed` ni `community-feed`
 * — ajouter un favori n'apparaît pas dans le feed (différent de visit/session).
 */

function favoritesKey(uid: string | undefined) {
  return ['favorites', uid] as const
}

/** Liste enrichie des favoris du caller pour Dashboard FavoritesTab. */
export function useFavorites() {
  const { user } = useAuth()
  return useQuery({
    queryKey: favoritesKey(user?.id),
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<FavoriteWithPiano[]> => {
      const { data, error } = await supabase.rpc('get_my_favorites')
      if (error) {
        logger.error('favorites.fetch', 'rpc failed', error)
        throw error
      }
      return (data ?? []) as FavoriteWithPiano[]
    }
  })
}

/**
 * Statut "ce piano est-il dans mes favoris ?" — dérivé de la liste favoris.
 * Évite une N+1 query par piano : on lit le cache `favorites` au lieu d'un
 * RPC dédié `is_favorited`.
 */
export function useIsFavorited(pianoId: string | undefined): boolean {
  const favorites = useFavorites()
  if (!pianoId || !favorites.data) return false
  return favorites.data.some((f) => f.piano_id === pianoId)
}

/**
 * Toggle favori (RPC `toggle_piano_favorite`). Idempotent, advisory_xact_lock
 * anti double-click côté DB. Retour boolean : true = ajouté, false = retiré.
 *
 * Optimistic : on update immédiatement `favorites` (ajout/retrait du piano).
 * Si la RPC échoue, on rollback. Si succès, on invalide en onSettled.
 */
export function useToggleFavorite() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (pianoId: string): Promise<boolean> => {
      if (!user?.id) throw new Error('not authenticated')
      const { data, error } = await supabase.rpc('toggle_piano_favorite', {
        p_piano: pianoId
      })
      if (error) {
        logger.error('favorites.toggle', 'rpc failed', error, { pianoId })
        throw error
      }
      logger.info('favorites.toggle', 'success', { pianoId, now: data })
      return Boolean(data)
    },
    onMutate: async (pianoId) => {
      await qc.cancelQueries({ queryKey: favoritesKey(user?.id) })
      const prev = qc.getQueryData<FavoriteWithPiano[]>(favoritesKey(user?.id))
      if (prev) {
        const isFavorited = prev.some((f) => f.piano_id === pianoId)
        if (isFavorited) {
          // Optimistic remove
          qc.setQueryData<FavoriteWithPiano[]>(
            favoritesKey(user?.id),
            prev.filter((f) => f.piano_id !== pianoId)
          )
        } else {
          // Optimistic add (placeholder — sera remplacé par invalidation)
          qc.setQueryData<FavoriteWithPiano[]>(favoritesKey(user?.id), [
            {
              piano_id: pianoId,
              address: '',
              quality: 'autre',
              photo_url: null,
              lat: 0,
              lng: 0,
              favorited_at: new Date().toISOString(),
              last_update_at: null
            },
            ...prev
          ])
        }
      }
      return { prev, pianoId }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(favoritesKey(user?.id), ctx.prev)
      }
    },
    onSettled: async () => {
      // Refetch authoritatif (la version optimistic avait des champs vides).
      await qc.invalidateQueries({ queryKey: favoritesKey(user?.id) })
    }
  })
}

/** Compteur favoris pour Badge UI (Dashboard tab, NavBar, etc.). */
export function useFavoritesCount(): number {
  return useFavorites().data?.length ?? 0
}
