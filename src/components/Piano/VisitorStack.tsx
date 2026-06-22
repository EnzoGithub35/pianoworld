import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { usePianoVisits, type PianoVisitWithAuthor } from '@/hooks/usePianoVisits'
import { fromNow } from '@/lib/date'
import { VISITORS_HEADLINE_ROTATION_MS, VISITS_DISPLAY_LIMIT } from '@/lib/constants'

/**
 * Stack d'avatars des derniers visiteurs uniques + headline rotatif au-dessus.
 *
 * Dédup : on garde la visite la plus récente par utilisateur. Headline change
 * toutes les 4 s, en pause au survol pour laisser le temps de lire.
 */

function uniqueLatestVisitors(visits: PianoVisitWithAuthor[]): PianoVisitWithAuthor[] {
  const seen = new Set<string>()
  const out: PianoVisitWithAuthor[] = []
  for (const v of visits) {
    if (!v.author) continue
    if (seen.has(v.author.id)) continue
    seen.add(v.author.id)
    out.push(v)
  }
  return out
}

function countLastMonth(visits: PianoVisitWithAuthor[]): number {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  return visits.filter((v) => new Date(v.visited_at).getTime() >= cutoff).length
}

function RotatingHeadline({ items }: { items: PianoVisitWithAuthor[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused || items.length <= 1) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % items.length)
    }, VISITORS_HEADLINE_ROTATION_MS)
    return () => window.clearInterval(id)
  }, [items.length, paused])

  if (items.length === 0) return null
  const current = items[index]
  if (!current?.author) return null

  return (
    <p
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="text-sm transition-opacity duration-200"
      key={current.id}
    >
      <Link to={`/user/${current.author.pseudo}`} className="font-semibold text-primary">
        @{current.author.pseudo}
      </Link>{' '}
      <span className="text-muted-foreground">y était {fromNow(current.visited_at)}</span>
    </p>
  )
}

export function VisitorStack({ pianoId }: { pianoId: string }) {
  const { data: visits, isLoading } = usePianoVisits(pianoId)

  const uniqueVisitors = useMemo(
    () => (visits ? uniqueLatestVisitors(visits) : []),
    [visits]
  )
  const monthCount = useMemo(() => (visits ? countLastMonth(visits) : 0), [visits])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" /> Chargement des passages…
      </div>
    )
  }

  if (uniqueVisitors.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4 text-primary" />
        Personne n'est encore passé. Sois le premier !
      </div>
    )
  }

  const visible = uniqueVisitors.slice(0, VISITS_DISPLAY_LIMIT)
  const extra = uniqueVisitors.length - visible.length

  return (
    <div className="space-y-2">
      <RotatingHeadline items={uniqueVisitors.slice(0, 10)} />
      <div className="flex items-center gap-3">
        <div className="flex">
          {visible.map((v, i) => (
            <div key={v.id} className={i === 0 ? undefined : '-ml-2'}>
              {v.author && <Avatar pseudo={v.author.pseudo} size="sm" ring />}
            </div>
          ))}
          {extra > 0 && (
            <div className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background">
              +{extra}
            </div>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {monthCount} passage{monthCount > 1 ? 's' : ''} ce mois
        </span>
      </div>
    </div>
  )
}
