import { Link } from 'react-router-dom'
import { Music, Lock } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { usePianoPresenceList } from '@/hooks/usePianoPresence'
import { formatDateTime } from '@/lib/date'
import { sessionRemainingMinutes } from '@/lib/session-status'

/**
 * Dialog listant les sessions actives + upcoming visibles sur un piano.
 *
 * Visibilité : appelle list_piano_presence côté RPC, qui filtre déjà
 * selon (public OR self OR ami). Le caller ne voit que ce à quoi il a droit.
 */
export function PresenceListDialog({
  open,
  onClose,
  pianoId,
  pianoAddress
}: {
  open: boolean
  onClose: () => void
  pianoId: string
  pianoAddress?: string
}) {
  const { data, isLoading } = usePianoPresenceList(open ? pianoId : undefined)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={pianoAddress ? `Présence — ${pianoAddress}` : 'Présence'}
    >
      <div className="max-h-[60vh] space-y-2 overflow-y-auto">
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Chargement…
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={<Music className="h-5 w-5" />}
            title="Personne pour l'instant"
            description="Pas de session en cours ni à venir visible."
          />
        ) : (
          data.map((entry) => {
            const remaining = sessionRemainingMinutes({
              starts_at: entry.starts_at,
              duration_min: entry.duration_min,
              cancelled_at: null
            })
            const isLive = remaining > 0
            return (
              <Link
                key={entry.session_id}
                to={`/user/${encodeURIComponent(entry.pseudo)}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-accent"
              >
                <Avatar pseudo={entry.pseudo} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    @{entry.pseudo}
                    {entry.visibility === 'friends' && (
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isLive
                      ? `Joue actuellement · encore ${remaining} min`
                      : `Arrive ${formatDateTime(entry.starts_at)} · ${entry.duration_min} min`}
                  </p>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </Dialog>
  )
}
