import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useAuth } from '@/contexts/AuthContext'
import type { FriendProfile, FriendRequest, FriendStatus } from '@/types/database'

/**
 * Hooks TanStack Query pour le système d'amitié (v6).
 *
 * Architecture (cf. plan PR-A backend) :
 * - Toutes les lectures passent par les RPCs SECURITY DEFINER côté DB
 *   (get_my_friends, get_my_friend_requests, get_friend_status). La table
 *   `friendships` est totalement invisible via PostgREST.
 * - Les mutations passent par 5 RPCs (send/accept/reject/cancel/remove).
 *   Optimistic updates avec snapshot triplet (friends + requests + status)
 *   et rollback en cascade sur erreur.
 *
 * Cache invalidation : chaque mutation invalide les 3 query keys liées
 * (friends, friend-requests, friend-status). accept invalide aussi
 * `piano-presence-*` car de nouvelles sessions friends-only deviennent visibles.
 */

type FriendRequestDirection = 'received' | 'sent'

/** Query key triplet pour invalidation atomique post-mutation. */
function friendsKey(uid: string | undefined) {
  return ['friends', uid] as const
}
function requestsKey(uid: string | undefined, direction: FriendRequestDirection) {
  return ['friend-requests', uid, direction] as const
}
function statusKey(uid: string | undefined, targetId: string) {
  return ['friend-status', uid, targetId] as const
}

/** Liste de mes amis acceptés (LIMIT 500 SQL-side). */
export function useFriends() {
  const { user } = useAuth()
  return useQuery({
    queryKey: friendsKey(user?.id),
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<FriendProfile[]> => {
      const { data, error } = await supabase.rpc('get_my_friends')
      if (error) {
        logger.error('friends.fetch', 'rpc failed', error)
        throw error
      }
      return (data ?? []) as FriendProfile[]
    }
  })
}

/** Demandes d'amitié pending dans une direction. */
export function useFriendRequests(direction: FriendRequestDirection) {
  const { user } = useAuth()
  return useQuery({
    queryKey: requestsKey(user?.id, direction),
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<FriendRequest[]> => {
      const { data, error } = await supabase.rpc('get_my_friend_requests', {
        direction
      })
      if (error) {
        logger.error('friends.requests.fetch', 'rpc failed', error, { direction })
        throw error
      }
      return (data ?? []) as FriendRequest[]
    }
  })
}

/** Statut bilatéral avec un user. Skip si self ou pas authentifié. */
export function useFriendStatus(targetId: string | undefined) {
  const { user } = useAuth()
  const enabled = !!user?.id && !!targetId && targetId !== user.id
  return useQuery({
    queryKey: statusKey(user?.id, targetId ?? ''),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<FriendStatus> => {
      const { data, error } = await supabase.rpc('get_friend_status', {
        target: targetId!
      })
      if (error) {
        logger.error('friends.status.fetch', 'rpc failed', error, { targetId })
        throw error
      }
      return (data ?? 'none') as FriendStatus
    }
  })
}

/** Count helper pour les badges (Dashboard tab "Amis"). */
export function usePendingReceivedCount() {
  const received = useFriendRequests('received')
  return received.data?.length ?? 0
}

/**
 * Toutes les mutations d'amitié exposées en un seul hook pour partager
 * l'invalidation cascade des 3 query keys.
 *
 * Convention : onMutate snapshot la query courante pour rollback en onError.
 * onSettled invalide systématiquement les 3 keys + predicate piano-presence-*.
 */
export function useFriendActions() {
  const { user } = useAuth()
  const qc = useQueryClient()

  /** Invalidation cascade : à appeler après chaque mutation friend-related. */
  const invalidateAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['friends'] }),
      qc.invalidateQueries({ queryKey: ['friend-requests'] }),
      qc.invalidateQueries({ queryKey: ['friend-status'] }),
      // Sur accept, de nouvelles sessions friends-only deviennent visibles.
      qc.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === 'piano-presence-count' ||
          q.queryKey[0] === 'piano-presence-list' ||
          q.queryKey[0] === 'piano-active-counts'
      })
    ])
  }

  const sendRequest = useMutation({
    mutationFn: async (targetId: string) => {
      if (!user?.id) throw new Error('not authenticated')
      const { data, error } = await supabase.rpc('send_friend_request', {
        target: targetId
      })
      if (error) {
        logger.error('friends.send', 'rpc failed', error, { targetId })
        throw error
      }
      logger.info('friends.send', 'success', { targetId })
      return data as string // friendship id
    },
    onMutate: async (targetId) => {
      await qc.cancelQueries({ queryKey: statusKey(user?.id, targetId) })
      const prevStatus = qc.getQueryData<FriendStatus>(statusKey(user?.id, targetId))
      qc.setQueryData<FriendStatus>(statusKey(user?.id, targetId), 'pending_sent')
      return { prevStatus, targetId }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevStatus !== undefined) {
        qc.setQueryData(statusKey(user?.id, ctx.targetId), ctx.prevStatus)
      }
    },
    onSettled: () => {
      void invalidateAll()
    }
  })

  const acceptRequest = useMutation({
    mutationFn: async (requestId: string) => {
      if (!user?.id) throw new Error('not authenticated')
      const { error } = await supabase.rpc('accept_friend_request', {
        request_id: requestId
      })
      if (error) {
        logger.error('friends.accept', 'rpc failed', error, { requestId })
        throw error
      }
      logger.info('friends.accept', 'success', { requestId })
    },
    onMutate: async (requestId) => {
      await qc.cancelQueries({ queryKey: requestsKey(user?.id, 'received') })
      const prev = qc.getQueryData<FriendRequest[]>(requestsKey(user?.id, 'received'))
      // Retire la demande de la liste reçues (optimistic).
      if (prev) {
        qc.setQueryData<FriendRequest[]>(
          requestsKey(user?.id, 'received'),
          prev.filter((r) => r.request_id !== requestId)
        )
      }
      return { prev, requestId }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(requestsKey(user?.id, 'received'), ctx.prev)
      }
    },
    onSettled: () => {
      void invalidateAll()
    }
  })

  const rejectRequest = useMutation({
    mutationFn: async (requestId: string) => {
      if (!user?.id) throw new Error('not authenticated')
      const { error } = await supabase.rpc('reject_friend_request', {
        request_id: requestId
      })
      if (error) {
        logger.error('friends.reject', 'rpc failed', error, { requestId })
        throw error
      }
      logger.info('friends.reject', 'success', { requestId })
    },
    onMutate: async (requestId) => {
      await qc.cancelQueries({ queryKey: requestsKey(user?.id, 'received') })
      const prev = qc.getQueryData<FriendRequest[]>(requestsKey(user?.id, 'received'))
      if (prev) {
        qc.setQueryData<FriendRequest[]>(
          requestsKey(user?.id, 'received'),
          prev.filter((r) => r.request_id !== requestId)
        )
      }
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(requestsKey(user?.id, 'received'), ctx.prev)
      }
    },
    onSettled: () => {
      void invalidateAll()
    }
  })

  const cancelRequest = useMutation({
    mutationFn: async (requestId: string) => {
      if (!user?.id) throw new Error('not authenticated')
      const { error } = await supabase.rpc('cancel_friend_request', {
        request_id: requestId
      })
      if (error) {
        logger.error('friends.cancel', 'rpc failed', error, { requestId })
        throw error
      }
      logger.info('friends.cancel', 'success', { requestId })
    },
    onMutate: async (requestId) => {
      await qc.cancelQueries({ queryKey: requestsKey(user?.id, 'sent') })
      const prev = qc.getQueryData<FriendRequest[]>(requestsKey(user?.id, 'sent'))
      if (prev) {
        qc.setQueryData<FriendRequest[]>(
          requestsKey(user?.id, 'sent'),
          prev.filter((r) => r.request_id !== requestId)
        )
      }
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(requestsKey(user?.id, 'sent'), ctx.prev)
      }
    },
    onSettled: () => {
      void invalidateAll()
    }
  })

  const removeFriend = useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!user?.id) throw new Error('not authenticated')
      const { error } = await supabase.rpc('remove_friendship', {
        other_user: otherUserId
      })
      if (error) {
        logger.error('friends.remove', 'rpc failed', error, { otherUserId })
        throw error
      }
      logger.info('friends.remove', 'success', { otherUserId })
    },
    onMutate: async (otherUserId) => {
      await qc.cancelQueries({ queryKey: friendsKey(user?.id) })
      const prev = qc.getQueryData<FriendProfile[]>(friendsKey(user?.id))
      if (prev) {
        qc.setQueryData<FriendProfile[]>(
          friendsKey(user?.id),
          prev.filter((f) => f.id !== otherUserId)
        )
      }
      // Reset status optimistically
      qc.setQueryData<FriendStatus>(statusKey(user?.id, otherUserId), 'none')
      return { prev, otherUserId }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(friendsKey(user?.id), ctx.prev)
      }
    },
    onSettled: () => {
      void invalidateAll()
    }
  })

  return {
    sendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    removeFriend
  }
}
