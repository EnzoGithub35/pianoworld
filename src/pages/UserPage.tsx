import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Music } from 'lucide-react'
import { useProfileByPseudo, useUserPianos } from '@/hooks/useUsers'
import { QualityBadge } from '@/components/Piano/QualityBadge'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { fromNow } from '@/lib/date'

export function UserPage() {
  const { pseudo } = useParams()
  const navigate = useNavigate()
  const { data: profile, isLoading: profileLoading } = useProfileByPseudo(pseudo)
  const { data: pianos, isLoading: pianosLoading } = useUserPianos(profile?.id)

  if (profileLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    )
  }
  if (!profile) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={<MapPin className="h-6 w-6" />}
          title="Utilisateur introuvable"
          description="Vérifie le pseudo dans l'URL."
        />
      </div>
    )
  }

  const count = pianos?.length ?? 0

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          onClick={() => navigate(-1)}
          aria-label="Retour"
          className="rounded-full p-1.5 hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-medium text-muted-foreground">@{profile.pseudo}</h1>
      </header>

      <div className="space-y-6 p-4 pb-24">
        <section className="flex items-center gap-4">
          <Avatar pseudo={profile.pseudo} size="xl" />
          <div>
            <p className="font-display text-2xl font-bold tracking-tight">@{profile.pseudo}</p>
            <p className="text-xs text-muted-foreground">
              Inscrit {fromNow(profile.created_at)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {count} piano{count > 1 ? 's' : ''} ajouté{count > 1 ? 's' : ''}
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pianos
          </h2>

          {pianosLoading && (
            <ul className="space-y-2">
              {[0, 1].map((i) => (
                <li key={i} className="flex gap-3 rounded-xl border border-border p-3">
                  <Skeleton className="h-16 w-16 flex-shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!pianosLoading && count === 0 && (
            <EmptyState
              icon={<Music className="h-6 w-6" />}
              title="Pas encore de piano"
              description="Cet utilisateur n'a rien ajouté pour l'instant."
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
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
