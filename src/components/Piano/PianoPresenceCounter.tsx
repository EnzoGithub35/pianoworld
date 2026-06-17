import { useState } from 'react'
import { Music } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { usePianoPresenceList } from '@/hooks/usePianoPresence'
import { isSessionActive } from '@/lib/session-status'
import { PRESENCE_AVATAR_STACK_LIMIT } from '@/lib/constants'
import { PresenceListDialog } from './PresenceListDialog'

/**
 * Compteur "X session(s) en cours" sur un piano.
 *
 * 2 variants :
 *  - 'popup' : juste le compteur compact (PianoMap popup, perf)
 *  - 'page'  : compteur + stack d'avatars + click → PresenceListDialog
 *
 * Wording "session(s) en cours" délibérément non ambigu : ne sous-entend pas
 * une présence physique vérifiée, juste les sessions déclarées et live.
 *
 * Render null si count = 0 (n'encombre pas l'UI).
 */
export function PianoPresenceCounter({
  pianoId,
  pianoAddress,
  variant = 'popup',
  className
}: {
  pianoId: string
  pianoAddress?: string
  variant?: 'popup' | 'page'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  // Le compteur popup fetch aussi la liste, mais staleTime 30s + refetchInterval
  // = 1 fetch/30s par piano popup ouvert, soutenable.
  const { data, isLoading } = usePianoPresenceList(pianoId)

  if (isLoading || !data) return null

  const live = data.filter((s) =>
    isSessionActive({
      starts_at: s.starts_at,
      duration_min: s.duration_min,
      cancelled_at: null
    })
  )

  if (live.length === 0) return null

  const stack = live.slice(0, PRESENCE_AVATAR_STACK_LIMIT - 1)
  const overflow = live.length - stack.length
  // Wording côté newcomer : "pianiste" vs "session" technique.
  // Le mot "session" est réservé à l'UI de création (SessionDialog "J'y vais").
  const label = `${live.length} pianiste${live.length > 1 ? 's' : ''} ${live.length > 1 ? 'jouent' : 'joue'} en ce moment`

  if (variant === 'popup') {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20',
          className
        )}
      >
        <Music className="h-3.5 w-3.5" />
        {label}
        <PresenceListDialog
          open={open}
          onClose={() => setOpen(false)}
          pianoId={pianoId}
          pianoAddress={pianoAddress}
        />
      </button>
    )
  }

  // variant === 'page' : compteur + stack avatars cliquable
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left hover:bg-accent',
          className
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Music className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">Voir qui joue</p>
        </div>
        <div className="flex -space-x-2">
          {stack.map((s) => (
            <Avatar
              key={s.session_id}
              pseudo={s.pseudo}
              size="sm"
              ring
              className="border-2 border-card"
            />
          ))}
          {overflow > 0 && (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background">
              +{overflow}
            </span>
          )}
        </div>
      </button>
      <PresenceListDialog
        open={open}
        onClose={() => setOpen(false)}
        pianoId={pianoId}
        pianoAddress={pianoAddress}
      />
    </>
  )
}
