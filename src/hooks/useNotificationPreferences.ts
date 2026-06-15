import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useAuth } from '@/contexts/AuthContext'
import type { NotificationPreferences } from '@/types/database'

/**
 * Fetch et mise à jour des préférences de notification de l'utilisateur courant.
 *
 * La ligne est créée automatiquement à l'inscription via le trigger DB
 * `profiles_ensure_notif_prefs`. Si elle manque (legacy), on retourne les
 * valeurs par défaut côté client.
 */

const DEFAULTS: Omit<NotificationPreferences, 'user_id' | 'updated_at'> = {
  notify_comments: true,
  notify_session_conflict: true,
  notify_request_reply: true,
  notify_events: true,
  notify_piano_updates: true,
  notify_friend_arriving: true,
  notify_friend_request_received: true,
  notify_friend_request_accepted: true,
  push_enabled: false
}

export function useNotificationPreferences() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['notification-preferences', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) {
        logger.error('notif.prefs.fetch', 'failed', error)
        throw error
      }
      if (!data) {
        // Backfill côté client si le trigger n'a jamais tourné pour ce user
        const { error: upsertError } = await supabase
          .from('notification_preferences')
          .insert({ user_id: user!.id })
        if (upsertError) {
          logger.warn('notif.prefs.backfill', 'insert failed', {
            message: upsertError.message
          })
        }
        return { user_id: user!.id, updated_at: new Date().toISOString(), ...DEFAULTS }
      }
      return data
    }
  })

  const mutate = useMutation({
    mutationFn: async (patch: Partial<typeof DEFAULTS>) => {
      if (!user?.id) throw new Error('not authenticated')
      const { error } = await supabase
        .from('notification_preferences')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
      if (error) {
        logger.error('notif.prefs.update', 'failed', error, { patch })
        throw error
      }
      logger.info('notif.prefs.update', 'success', { patch })
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({
        queryKey: ['notification-preferences', user?.id]
      })
      const prev = queryClient.getQueryData<NotificationPreferences>([
        'notification-preferences',
        user?.id
      ])
      if (prev) {
        queryClient.setQueryData(['notification-preferences', user?.id], {
          ...prev,
          ...patch
        })
      }
      return { prev }
    },
    onError: (_err, _patch, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['notification-preferences', user?.id], context.prev)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['notification-preferences', user?.id]
      })
    }
  })

  return {
    preferences: query.data,
    isLoading: query.isLoading,
    update: mutate.mutate,
    updating: mutate.isPending
  }
}
