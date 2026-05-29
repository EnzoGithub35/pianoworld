import { Link } from 'react-router-dom'
import { Check, X as XIcon } from 'lucide-react'
import { usePianoUpdates } from '@/hooks/usePiano'
import { QualityBadge } from './QualityBadge'
import { fromNow } from '@/lib/date'

export function PianoHistory({ pianoId }: { pianoId: string }) {
  const { data: updates, isLoading } = usePianoUpdates(pianoId)

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Chargement de l'historique…</p>
  }
  if (!updates || updates.length === 0) {
    return <p className="text-xs text-muted-foreground">Aucune mise à jour pour l'instant.</p>
  }

  return (
    <ul className="space-y-3">
      {updates.map((u) => (
        <li key={u.id} className="rounded-md border border-border p-3 text-sm">
          <div className="flex items-center gap-2">
            {u.still_there ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900 dark:bg-green-950 dark:text-green-200">
                <Check className="h-3 w-3" /> Encore là
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900 dark:bg-red-950 dark:text-red-200">
                <XIcon className="h-3 w-3" /> Disparu
              </span>
            )}
            {u.new_quality && <QualityBadge quality={u.new_quality} />}
          </div>
          {u.comment && <p className="mt-2 text-sm">{u.comment}</p>}
          <p className="mt-2 text-xs text-muted-foreground">
            {u.author?.pseudo ? (
              <Link to={`/user/${u.author.pseudo}`} className="text-primary">
                @{u.author.pseudo}
              </Link>
            ) : (
              'utilisateur supprimé'
            )}
            {' · '}
            {fromNow(u.created_at)}
          </p>
        </li>
      ))}
    </ul>
  )
}
