import { Link } from 'react-router-dom'
import {
  CalendarPlus,
  Footprints,
  Map as MapIcon,
  MapPin,
  Music,
  Plus,
  RefreshCw,
  Sparkles
} from 'lucide-react'
import { useGlobalStats } from '@/hooks/useStats'
import { useRecentFeed } from '@/hooks/useRecentFeed'
import { QualityBadge } from '@/components/Piano/QualityBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { fromNow } from '@/lib/date'

/**
 * Onglet "Activité" du Dashboard : stats globales + feed récent.
 * Extrait pour permettre d'autres tabs (Évènements, Mes demandes) à côté.
 */

function StatCard({
  label,
  value,
  icon: Icon,
  hint
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="font-display mt-1.5 text-2xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

function FeedSkeleton() {
  return (
    <ul className="space-y-2">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex gap-3 rounded-xl border border-border p-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function ActivityTab() {
  const { data: stats, isLoading: statsLoading } = useGlobalStats()
  const { data: feed, isLoading: feedLoading } = useRecentFeed(15)

  return (
    <div className="space-y-6 p-4 pb-24">
      <section className="grid grid-cols-2 gap-3">
        {statsLoading ? (
          <>
            <Skeleton className="h-[88px]" />
            <Skeleton className="h-[88px]" />
          </>
        ) : (
          <>
            <StatCard
              label="Pianos cartographiés"
              value={String(stats?.total ?? 0)}
              icon={Music}
            />
            <StatCard
              label="En bon état"
              value={`${stats?.goodPercent ?? 0}%`}
              icon={MapPin}
              hint="Neuf, bon état ou potable"
            />
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Activité récente
        </h2>

        {feedLoading && <FeedSkeleton />}

        {!feedLoading && feed && feed.length === 0 && (
          <EmptyState
            icon={<Sparkles className="h-6 w-6" />}
            title="Aucune activité pour l'instant"
            description={
              stats?.total === 0
                ? 'Sois le premier à cartographier un piano près de chez toi !'
                : 'Ouvre la carte et participe à la communauté.'
            }
            action={
              <Link
                to="/"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <MapIcon className="h-4 w-4" />
                {stats?.total === 0 ? 'Ajouter le premier piano' : 'Ouvrir la carte'}
              </Link>
            }
          />
        )}

        <ul className="space-y-2">
          {feed?.map((event) => {
            if (event.kind === 'new') {
              const p = event.piano
              return (
                <li key={event.id}>
                  <Link
                    to={`/piano/${p.id}`}
                    className="card-hover flex gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <Plus className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-semibold">
                          @{p.author?.pseudo ?? 'inconnu'}
                        </span>{' '}
                        <span className="text-muted-foreground">a ajouté un piano</span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {p.address}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <QualityBadge quality={p.quality} />
                        <span className="text-[11px] text-muted-foreground">
                          {fromNow(event.created_at)}
                        </span>
                      </div>
                    </div>
                    {p.photo_url && (
                      <img
                        src={p.photo_url}
                        alt=""
                        className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    )}
                  </Link>
                </li>
              )
            }
            if (event.kind === 'update') {
              const u = event.update
              if (!u.piano) return null
              return (
                <li key={event.id}>
                  <Link
                    to={`/piano/${u.piano.id}`}
                    className="card-hover flex gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200">
                      <RefreshCw className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-semibold">
                          @{u.author?.pseudo ?? 'inconnu'}
                        </span>{' '}
                        <span className="text-muted-foreground">a mis à jour</span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {u.piano.address}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        {u.new_quality && <QualityBadge quality={u.new_quality} />}
                        <span className="text-[11px] text-muted-foreground">
                          {u.still_there ? 'Encore là' : 'Disparu'} ·{' '}
                          {fromNow(event.created_at)}
                        </span>
                      </div>
                    </div>
                    {u.piano.photo_url && (
                      <img
                        src={u.piano.photo_url}
                        alt=""
                        className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    )}
                  </Link>
                </li>
              )
            }
            if (event.kind === 'visit') {
              const v = event.visit
              if (!v.piano) return null
              return (
                <li key={event.id}>
                  <Link
                    to={`/piano/${v.piano.id}`}
                    className="card-hover flex gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200">
                      <Footprints className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-semibold">
                          @{v.author?.pseudo ?? 'inconnu'}
                        </span>{' '}
                        <span className="text-muted-foreground">y est passé</span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {v.piano.address}
                      </p>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {fromNow(event.created_at)}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            }
            // event.kind === 'session'
            const s = event.session
            if (!s.piano) return null
            const startMs = new Date(s.starts_at).getTime()
            const nowMs = Date.now()
            const endMs = startMs + s.duration_min * 60_000
            const isLive = startMs <= nowMs && endMs > nowMs
            const isUpcoming = startMs > nowMs
            const subline = isLive
              ? 'joue en ce moment'
              : isUpcoming
                ? `prévu ${fromNow(s.starts_at)}`
                : 'a joué récemment'
            return (
              <li key={event.id}>
                <Link
                  to={`/piano/${s.piano.id}`}
                  className="card-hover flex gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <CalendarPlus className="h-5 w-5" />
                    {isLive && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-semibold">
                        @{s.author?.pseudo ?? 'inconnu'}
                      </span>{' '}
                      <span className="text-muted-foreground">{subline}</span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {s.piano.address}
                    </p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {fromNow(event.created_at)}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
