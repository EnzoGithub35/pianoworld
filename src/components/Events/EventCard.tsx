import { useState } from 'react'
import { Calendar, MapPin, Users, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { formatDateTime, fromNow } from '@/lib/date'
import type { EventWithCounts } from '@/hooks/useEvents'

/**
 * Card unique pour les évènements, utilisée par EventsTab (user) et
 * EventsAdminTab. La logique "admin actions" (annuler) est activée via le
 * prop `adminMode`.
 */
export function EventCard({
  event,
  iAmJoined,
  adminMode = false
}: {
  event: EventWithCounts
  iAmJoined: boolean
  adminMode?: boolean
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  const isFull =
    event.max_participants !== null && event.participants_count >= event.max_participants
  const startMs = new Date(event.starts_at).getTime()
  const endMs = event.ends_at ? new Date(event.ends_at).getTime() : null
  const nowMs = Date.now()
  const isLive = startMs <= nowMs && (!endMs || endMs > nowMs)

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['events'] })
    await queryClient.invalidateQueries({ queryKey: ['my-participations'] })
  }

  const handleJoin = async () => {
    if (!user || busy) return
    setBusy(true)
    try {
      const { error } = await supabase
        .from('event_participants')
        .insert({ event_id: event.id, user_id: user.id })
      if (error) {
        logger.error('event.join', 'insert failed', error, { eventId: event.id })
        throw error
      }
      logger.info('event.join', 'success', { eventId: event.id })
      toast.success('Inscrit !')
      await refresh()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Inscription échouée'))
    } finally {
      setBusy(false)
    }
  }

  const handleLeave = async () => {
    if (!user || busy) return
    setBusy(true)
    try {
      const { error } = await supabase
        .from('event_participants')
        .delete()
        .eq('event_id', event.id)
        .eq('user_id', user.id)
      if (error) {
        logger.error('event.leave', 'delete failed', error, { eventId: event.id })
        throw error
      }
      toast.success('Désinscrit')
      await refresh()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Désinscription échouée'))
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = async () => {
    if (busy) return
    if (!window.confirm('Annuler cet évènement pour tout le monde ?')) return
    setBusy(true)
    try {
      const { error } = await supabase
        .from('events')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('id', event.id)
      if (error) {
        logger.error('admin.eventCancel', 'update failed', error, { eventId: event.id })
        throw error
      }
      logger.warn('admin.eventCancel', 'cancelled by admin', { eventId: event.id })
      toast.success('Évènement annulé')
      await refresh()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Annulation échouée'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-4">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-bold tracking-tight">
              {event.title}
            </h3>
            {isLive && <Badge variant="success">en cours</Badge>}
            {isFull && !isLive && <Badge variant="warning">complet</Badge>}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDateTime(event.starts_at)}
            {endMs && <span> — {formatDateTime(event.ends_at!)}</span>}
            <span className="ml-1">· {fromNow(event.starts_at)}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {event.location}
          </p>
        </div>
        {adminMode && (
          <button
            onClick={handleCancel}
            disabled={busy}
            aria-label="Annuler l'évènement"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
        {event.description}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <div className="flex">
            {event.participants_preview.map((p, i) => (
              <div key={p.id} className={i === 0 ? undefined : '-ml-2'}>
                <Avatar pseudo={p.pseudo} size="sm" ring />
              </div>
            ))}
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {event.participants_count}
            {event.max_participants && ` / ${event.max_participants}`}
          </span>
        </div>

        {!adminMode &&
          (iAmJoined ? (
            <Button size="sm" variant="outline" loading={busy} onClick={handleLeave}>
              Je ne viens plus
            </Button>
          ) : (
            <Button size="sm" loading={busy} disabled={isFull} onClick={handleJoin}>
              {isFull ? 'Complet' : 'Je viens'}
            </Button>
          ))}
      </div>
    </article>
  )
}
