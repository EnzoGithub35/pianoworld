import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, Music, Pencil, Trash2, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePiano } from '@/hooks/usePiano'
import { QualityBadge } from '@/components/Piano/QualityBadge'
import { PianoHistory } from '@/components/Piano/PianoHistory'
import { PianoUpdateForm } from '@/components/Piano/PianoUpdateForm'
import { EditPianoForm } from '@/components/Piano/EditPianoForm'
import { DeletePianoDialog } from '@/components/Piano/DeletePianoDialog'
import { PianoNavigateButton } from '@/components/Piano/PianoNavigateButton'
import { PianoShareButton } from '@/components/Piano/PianoShareButton'
import { PianoReportButton } from '@/components/Piano/PianoReportButton'
import { PianoActivity } from '@/components/Piano/PianoActivity'
import { PianoPresenceCounter } from '@/components/Piano/PianoPresenceCounter'
import { FavoriteButton } from '@/components/Piano/FavoriteButton'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { fromNow, formatDate } from '@/lib/date'

export function PianoPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: piano, isLoading } = usePiano(id)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showUpdate, setShowUpdate] = useState(false)

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="aspect-video w-full rounded-xl" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    )
  }
  if (!piano) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={<Music className="h-6 w-6" />}
          title="Piano introuvable"
          description="Il a peut-être été supprimé."
          action={
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              Retour à la carte
            </Button>
          }
        />
      </div>
    )
  }

  const isOwner = user?.id === piano.created_by

  // Fallback "Retour" si on est arrivé par deep-link partagé (history.length <= 1)
  // → on évite que `navigate(-1)` sorte de l'app.
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <button
          onClick={handleBack}
          aria-label="Retour"
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 truncate text-sm font-medium text-muted-foreground">
          {piano.address}
        </h1>
        {isOwner && (
          <>
            <button
              onClick={() => setEditing(true)}
              aria-label="Modifier"
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-accent"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDeleting(true)}
              aria-label="Supprimer"
              className="flex h-11 w-11 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </header>

      <main className="space-y-6 p-4 pb-24">
        {/* Hero photo + overlay badge qualité */}
        <div className="relative overflow-hidden rounded-xl bg-muted">
          {piano.photo_url ? (
            <img
              src={piano.photo_url}
              alt="piano"
              className="aspect-video w-full object-cover"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
              <Music className="h-16 w-16 opacity-60" />
            </div>
          )}
          <div className="absolute right-3 top-3">
            <QualityBadge quality={piano.quality} />
          </div>
        </div>

        {/* Adresse + meta */}
        <section className="space-y-2">
          <h2 className="font-display text-xl font-bold leading-snug">{piano.address}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              {piano.author?.pseudo ? (
                <Link
                  to={`/user/${piano.author.pseudo}`}
                  className="text-primary hover:underline"
                >
                  @{piano.author.pseudo}
                </Link>
              ) : (
                'utilisateur supprimé'
              )}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(piano.created_at)} · {fromNow(piano.created_at)}
            </span>
          </div>
        </section>

        {/* Compteur présence en cours */}
        <PianoPresenceCounter
          pianoId={piano.id}
          pianoAddress={piano.address}
          variant="page"
        />

        {/* Commentaire */}
        <section className="rounded-xl border border-border bg-card p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{piano.comment}</p>
        </section>

        {/* Actions */}
        <div className="flex gap-2">
          <PianoNavigateButton lat={piano.lat} lng={piano.lng} />
          <PianoShareButton pianoId={piano.id} address={piano.address} />
        </div>
        {user && (
          <div className="flex gap-2">
            <FavoriteButton pianoId={piano.id} />
          </div>
        )}

        {user && user.id !== piano.created_by && (
          <div className="flex justify-end">
            <PianoReportButton pianoId={piano.id} />
          </div>
        )}

        <PianoActivity pianoId={piano.id} />

        {/* Mise à jour */}
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Mise à jour</h2>
            </div>
            <Button
              size="sm"
              variant={showUpdate ? 'outline' : 'default'}
              onClick={() => setShowUpdate((v) => !v)}
            >
              {showUpdate ? 'Annuler' : 'Mettre à jour'}
            </Button>
          </div>
          {!showUpdate && (
            <p className="text-xs text-muted-foreground">
              Tu es passé devant ? Indique si le piano est encore là, et son état.
            </p>
          )}
          {showUpdate && (
            <div className="animate-slide-up">
              <PianoUpdateForm pianoId={piano.id} onDone={() => setShowUpdate(false)} />
            </div>
          )}
        </section>

        {/* Historique */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Historique
          </h2>
          <PianoHistory pianoId={piano.id} />
        </section>
      </main>

      {editing && <EditPianoForm piano={piano} onClose={() => setEditing(false)} />}
      <DeletePianoDialog
        open={deleting}
        piano={piano}
        onClose={() => setDeleting(false)}
      />
    </div>
  )
}
