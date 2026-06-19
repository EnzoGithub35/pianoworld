import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  CalendarDays,
  Footprints,
  List,
  Map as MapIcon,
  MapPin,
  Music,
  Sparkles
} from 'lucide-react'
import { useCommunityFeed, type CommunityEvent } from '@/hooks/useCommunityFeed'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { fromNow } from '@/lib/date'

type ViewMode = 'list' | 'calendar'

const PEEK_DAYS = 14 // 14 jours glissants pour le calendrier

/**
 * v7 — Contenu "Communauté" sans wrapper d'espacement.
 *
 *  - Vue Liste : sessions live en haut, puis à venir, puis passages récents.
 *  - Vue Calendrier : timeline horizontale 14 jours, dot par jour, panneau
 *    détaillé du jour sélectionné en dessous.
 *
 * Choix : calendrier 14j glissants (et pas mois complet) car en pratique
 * personne ne planifie à 3 semaines, et un mois complet sur mobile prend toute
 * la hauteur. 14j tient sur 2 lignes ou défilable horizontalement.
 *
 * Composant réutilisable : utilisé inline dans ActivityTab (Dashboard) via
 * un toggle Récent/Communauté (audit P1/M : fusion des 2 tabs pour réduire
 * le débordement 5 onglets sur 360px).
 */
export function CommunityContent() {
  const [view, setView] = useState<ViewMode>('list')
  const { data, isLoading } = useCommunityFeed()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Qui passe ou joue sur les pianos de la communauté.
        </p>
        <div className="flex overflow-hidden rounded-md border border-border bg-card">
          <button
            type="button"
            onClick={() => setView('list')}
            aria-pressed={view === 'list'}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors',
              view === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent'
            )}
          >
            <List className="h-3.5 w-3.5" /> Liste
          </button>
          <button
            type="button"
            onClick={() => setView('calendar')}
            aria-pressed={view === 'calendar'}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors',
              view === 'calendar'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent'
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" /> Calendrier
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="Pas encore d'activité"
          description="Quand un membre déclare 'je passe' ou 'j'y vais', son créneau apparaît ici. En attendant, va voir ce qu'il y a autour de toi."
          action={
            <Link
              to="/"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <MapIcon className="h-4 w-4" />
              Ouvrir la carte
            </Link>
          }
        />
      )}

      {!isLoading && data && data.length > 0 && (
        <>
          {view === 'list' ? <ListView events={data} /> : <CalendarView events={data} />}
        </>
      )}
    </div>
  )
}

/** Conservé pour back-compat éventuelle (usage standalone). */
export function CommunityTab() {
  return (
    <div className="p-4 pb-24">
      <CommunityContent />
    </div>
  )
}

/* ------------------------- Liste ------------------------- */

function ListView({ events }: { events: CommunityEvent[] }) {
  const now = Date.now()
  const live: CommunityEvent[] = []
  const upcoming: CommunityEvent[] = []
  const past: CommunityEvent[] = []

  for (const ev of events) {
    if (ev.kind === 'session') {
      const start = new Date(ev.session.starts_at).getTime()
      const end = start + ev.session.duration_min * 60_000
      if (start <= now && end > now) live.push(ev)
      else if (start > now) upcoming.push(ev)
      else past.push(ev)
    } else {
      past.push(ev)
    }
  }

  upcoming.sort((a, b) => (a.date_at > b.date_at ? 1 : -1))
  past.sort((a, b) => (a.date_at > b.date_at ? -1 : 1))

  return (
    <div className="space-y-5">
      {live.length > 0 && <Bucket title="🟢 En ce moment" events={live} />}
      {upcoming.length > 0 && <Bucket title="À venir" events={upcoming.slice(0, 30)} />}
      {past.length > 0 && <Bucket title="Récemment" events={past.slice(0, 30)} />}
    </div>
  )
}

function Bucket({ title, events }: { title: string; events: CommunityEvent[] }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <ul className="space-y-2">
        {events.map((ev) => (
          <li key={ev.id}>
            <EventRow event={ev} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function EventRow({ event }: { event: CommunityEvent }) {
  const piano = event.kind === 'session' ? event.session.piano : event.visit.piano
  const author = event.kind === 'session' ? event.session.author : event.visit.author
  if (!piano) return null

  const now = Date.now()
  const time =
    event.kind === 'session'
      ? (() => {
          const start = new Date(event.session.starts_at).getTime()
          const end = start + event.session.duration_min * 60_000
          if (start <= now && end > now)
            return `joue · encore ~${Math.round((end - now) / 60_000)} min`
          if (start > now) return `prévu ${fromNow(event.session.starts_at)}`
          return `a joué ${fromNow(event.session.starts_at)}`
        })()
      : `passé ${fromNow(event.visit.visited_at)}`

  return (
    <Link
      to={`/piano/${piano.id}`}
      className="card-hover flex items-center gap-3 rounded-xl border border-border bg-card p-3"
    >
      <div className="relative">
        <Avatar pseudo={author?.pseudo} size="sm" />
        {event.kind === 'session' ? (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
            <Music className="h-2 w-2" />
          </span>
        ) : (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-background bg-amber-500 text-white">
            <Footprints className="h-2 w-2" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold">@{author?.pseudo ?? 'inconnu'}</span>{' '}
          <span className="text-muted-foreground">{time}</span>
        </p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          {piano.address}
        </p>
      </div>
    </Link>
  )
}

/* ------------------------- Calendrier ------------------------- */

function CalendarView({ events }: { events: CommunityEvent[] }) {
  const days = useMemo(() => {
    const start = dayjs().startOf('day').subtract(2, 'day')
    return Array.from({ length: PEEK_DAYS }, (_, i) => start.add(i, 'day'))
  }, [])
  const [selected, setSelected] = useState(dayjs().format('YYYY-MM-DD'))

  const byDay = useMemo(() => {
    const map = new Map<string, CommunityEvent[]>()
    for (const ev of events) {
      const k = dayjs(ev.date_at).format('YYYY-MM-DD')
      const arr = map.get(k) ?? []
      arr.push(ev)
      map.set(k, arr)
    }
    return map
  }, [events])

  const selectedEvents = (byDay.get(selected) ?? []).sort((a, b) =>
    a.date_at > b.date_at ? 1 : -1
  )
  const today = dayjs().format('YYYY-MM-DD')

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto pb-2">
        {days.map((d) => {
          const k = d.format('YYYY-MM-DD')
          const count = byDay.get(k)?.length ?? 0
          const isSelected = selected === k
          const isToday = k === today
          return (
            <button
              key={k}
              type="button"
              onClick={() => setSelected(k)}
              className={cn(
                'flex min-w-[52px] flex-col items-center gap-0.5 rounded-xl border px-2 py-2 transition-colors',
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : isToday
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-card hover:bg-accent'
              )}
            >
              <span className="text-[10px] uppercase tracking-wider">
                {d.format('ddd')}
              </span>
              <span className="text-base font-semibold tabular-nums">
                {d.format('D')}
              </span>
              {count > 0 ? (
                <Badge
                  variant={isSelected ? 'primary' : 'primary'}
                  className="h-4 px-1 text-[9px]"
                >
                  {count}
                </Badge>
              ) : (
                <span className="h-4 w-1 rounded-full bg-transparent" />
              )}
            </button>
          )
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {dayjs(selected).format('dddd D MMMM')}
        </h3>
        {selectedEvents.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Rien de prévu ce jour-là.
          </p>
        ) : (
          <ul className="space-y-2">
            {selectedEvents.map((ev) => (
              <li key={ev.id}>
                <EventRow event={ev} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
