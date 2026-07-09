import { Link } from 'react-router-dom'
import { Bookmark, Music, MapIcon } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { QualityBadge } from '@/components/Piano/QualityBadge'
import { useFavorites } from '@/hooks/useFavorites'
import { FAVORITES_DISPLAY_LIMIT } from '@/lib/constants'
import { fromNow } from '@/lib/date'

/**
 * v7 — Tab "Favoris" du Dashboard.
 *
 * Liste enrichie des pianos favoris du caller (RPC get_my_favorites).
 * Inclut `last_update_at` calculé serveur-side via LATERAL → bandeau
 * "Mis à jour il y a X" sur chaque card.
 *
 * LIMIT 200 côté SQL (FAVORITES_DISPLAY_LIMIT côté UI = hint pour le user).
 */
export function FavoritesTab() {
  const { data, isLoading } = useFavorites()

  return (
    <div className="space-y-4 p-4 pb-24">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Mes pianos favoris
      </h2>

      {isLoading && (
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex gap-3 rounded-xl border border-border p-3">
              <Skeleton className="h-16 w-16 flex-shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && data && data.length === 0 && (
        <EmptyState
          icon={<Bookmark className="h-6 w-6" />}
          title="Pas encore de favori"
          description="Mets un piano en favori pour le retrouver vite et être notifié de ses mises à jour."
          action={
            <Link
              to="/map"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <MapIcon className="h-4 w-4" />
              Découvrir des pianos
            </Link>
          }
        />
      )}

      <ul className="space-y-2">
        {data?.map((f) => (
          <li key={f.piano_id}>
            <Link
              to={`/piano/${f.piano_id}`}
              className="card-hover flex gap-3 rounded-xl border border-border bg-card p-3"
            >
              {f.photo_url ? (
                <img
                  src={f.photo_url}
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
                <p className="truncate text-sm font-medium">{f.address}</p>
                <div className="mt-1">
                  <QualityBadge quality={f.quality} />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Favori depuis {fromNow(f.favorited_at)}
                  {f.last_update_at && ` · MAJ ${fromNow(f.last_update_at)}`}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {data && data.length >= FAVORITES_DISPLAY_LIMIT && (
        <p className="px-1 text-[11px] text-muted-foreground">
          {FAVORITES_DISPLAY_LIMIT} favoris affichés (maximum). Retire-en pour en ajouter
          d'autres.
        </p>
      )}
    </div>
  )
}
