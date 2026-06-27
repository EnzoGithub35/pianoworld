import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search as SearchIcon, Music, MapIcon } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { QualityBadge } from '@/components/Piano/QualityBadge'
import { usePianoSearch } from '@/hooks/usePianoSearch'
import { USER_SEARCH_MIN_CHARS } from '@/lib/constants'

/**
 * v7 — Tab "Pianos" de la SearchPage.
 *
 * Texte libre full-text sur address + comment via RPC search_pianos.
 * Accent-insensitive (pg_trgm + unaccent), threshold 0.1, LIMIT 30.
 */
export function PianoSearchTab() {
  const [query, setQuery] = useState('')
  const { data: pianos, isLoading } = usePianoSearch(query)

  const trimmed = query.trim()
  const showHint = trimmed.length > 0 && trimmed.length < USER_SEARCH_MIN_CHARS

  return (
    <div className="space-y-4">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Adresse, lieu, commentaire..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      {showHint && (
        <p className="px-1 text-xs text-muted-foreground">
          Tape au moins {USER_SEARCH_MIN_CHARS} caractères pour chercher.
        </p>
      )}

      {isLoading && (
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex gap-3 rounded-xl border border-border p-3">
              <Skeleton className="h-16 w-16 flex-shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {!isLoading &&
        trimmed.length >= USER_SEARCH_MIN_CHARS &&
        pianos &&
        pianos.length === 0 && (
          <EmptyState
            icon={<SearchIcon className="h-6 w-6" />}
            title="Aucun piano trouvé"
            description="Essaye avec un autre mot-clé ou explore la carte."
            action={
              <Link
                to="/map"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <MapIcon className="h-4 w-4" />
                Voir la carte
              </Link>
            }
          />
        )}

      {trimmed.length < USER_SEARCH_MIN_CHARS && !showHint && (
        <EmptyState
          icon={<Music className="h-6 w-6" />}
          title="Trouve un piano"
          description="Cherche par adresse, lieu ou mot-clé du commentaire."
        />
      )}

      <ul className="space-y-2">
        {pianos?.map((p) => (
          <li key={p.id}>
            <Link
              to={`/piano/${p.id}`}
              className="card-hover flex gap-3 rounded-xl border border-border bg-card p-3"
            >
              {p.photo_url ? (
                <img
                  src={p.photo_url}
                  alt="piano"
                  className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Music className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.address}</p>
                <div className="mt-1">
                  <QualityBadge quality={p.quality} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {p.comment}
                </p>
                {p.author_pseudo && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Ajouté par @{p.author_pseudo}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
