import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Music, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/contexts/AuthContext'
import { usePianoSessions, type PianoSessionWithAuthor } from '@/hooks/usePianoSessions'
import {
  isSessionActive,
  isSessionUpcoming,
  sessionRemainingMinutes
} from '@/lib/session-status'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'

function formatTimeShort(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = new Date()
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  const time = `${pad(d.getHours())}h${pad(d.getMinutes())}`
  if (sameDay) return time
  const dayLabel = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
  return `${dayLabel} ${time}`
}

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `${h}h` : `${h}h${rest}`
}

function ActiveCard({
  session,
  isOwner,
  onCancel
}: {
  session: PianoSessionWithAuthor
  isOwner: boolean
  onCancel: (id: string) => void
}) {
  const remaining = sessionRemainingMinutes(session)
  return (
    <li className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <span className="relative">
        <Avatar pseudo={session.author?.pseudo} size="md" />
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {session.author?.pseudo ? (
            <Link
              to={`/user/${session.author.pseudo}`}
              className="font-semibold text-primary"
            >
              @{session.author.pseudo}
            </Link>
          ) : (
            <span className="font-semibold">utilisateur</span>
          )}{' '}
          <span className="text-muted-foreground">joue ici</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">Encore ~{remaining} min</p>
      </div>
      {isOwner && (
        <button
          onClick={() => onCancel(session.id)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          aria-label="Annuler mon créneau"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </li>
  )
}

function UpcomingCard({
  session,
  isOwner,
  onCancel
}: {
  session: PianoSessionWithAuthor
  isOwner: boolean
  onCancel: (id: string) => void
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <Avatar pseudo={session.author?.pseudo} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {session.author?.pseudo ? (
            <Link
              to={`/user/${session.author.pseudo}`}
              className="font-medium text-foreground"
            >
              @{session.author.pseudo}
            </Link>
          ) : (
            <span className="font-medium">utilisateur</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatTimeShort(session.starts_at)} · {formatDuration(session.duration_min)}
        </p>
      </div>
      {isOwner && (
        <button
          onClick={() => onCancel(session.id)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          aria-label="Annuler mon créneau"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </li>
  )
}

export function SessionList({ pianoId }: { pianoId: string }) {
  const { user } = useAuth()
  const { data: sessions, isLoading } = usePianoSessions(pianoId)
  const queryClient = useQueryClient()
  const [cancelling, setCancelling] = useState<string | null>(null)

  const { active, upcoming } = useMemo(() => {
    const now = new Date()
    const active: PianoSessionWithAuthor[] = []
    const upcoming: PianoSessionWithAuthor[] = []
    for (const s of sessions ?? []) {
      if (isSessionActive(s, now)) active.push(s)
      else if (isSessionUpcoming(s, now)) upcoming.push(s)
    }
    return { active, upcoming }
  }, [sessions])

  const handleCancel = async (sessionId: string) => {
    setCancelling(sessionId)
    try {
      const { error } = await supabase
        .from('piano_sessions')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('id', sessionId)
      if (error) {
        logger.error('session.cancel', 'update failed', error, { sessionId })
        throw error
      }
      logger.info('session.cancel', 'success', { sessionId })
      toast.success('Créneau annulé')
      await queryClient.invalidateQueries({ queryKey: ['piano-sessions', pianoId] })
      await queryClient.invalidateQueries({ queryKey: ['active-piano-ids'] })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Annulation échouée'))
    } finally {
      setCancelling(null)
    }
  }

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Chargement des créneaux…</p>
  }

  if (active.length === 0 && upcoming.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Personne ne s'est annoncé. Lance-toi !
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {active.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Music className="h-3.5 w-3.5 text-primary" />
            En ce moment
          </h3>
          <ul className="space-y-2">
            {active.map((s) => (
              <ActiveCard
                key={s.id}
                session={s}
                isOwner={user?.id === s.user_id && cancelling !== s.id}
                onCancel={handleCancel}
              />
            ))}
          </ul>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 text-primary" />À venir
          </h3>
          <ul className="space-y-2">
            {upcoming.map((s) => (
              <UpcomingCard
                key={s.id}
                session={s}
                isOwner={user?.id === s.user_id && cancelling !== s.id}
                onCancel={handleCancel}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
