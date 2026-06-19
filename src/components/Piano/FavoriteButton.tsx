import { Bookmark } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { useIsFavorited, useToggleFavorite } from '@/hooks/useFavorites'
import { cn } from '@/lib/utils'
import { getErrorMessage } from '@/lib/errors'

/**
 * v7 — Bouton "Favori" (icône Bookmark, filled si déjà favoré).
 *
 * Variants :
 *  - `default` : full Button avec label "Favoris" / "Ajouter aux favoris"
 *    (utilisé dans la row d'actions PianoPage à côté de "Naviguer/Partager")
 *  - `compact` : icône seule en pill (utilisé dans PianoPopup carte)
 *
 * Logged-out → cache le bouton (l'action favori nécessite un compte).
 *
 * Optimistic + rollback via useToggleFavorite. Toast minimal.
 */
export function FavoriteButton({
  pianoId,
  variant = 'default',
  className
}: {
  pianoId: string
  variant?: 'default' | 'compact'
  className?: string
}) {
  const { user } = useAuth()
  const isFavorited = useIsFavorited(pianoId)
  const toggle = useToggleFavorite()

  if (!user) return null

  const handleClick = async () => {
    try {
      const nowFavorited = await toggle.mutateAsync(pianoId)
      toast.success(nowFavorited ? 'Ajouté à tes favoris' : 'Retiré de tes favoris', {
        duration: 2000
      })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erreur'))
    }
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={toggle.isPending}
        aria-label={isFavorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        aria-pressed={isFavorited}
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full transition-colors disabled:opacity-60',
          isFavorited
            ? 'bg-primary/15 text-primary hover:bg-primary/25'
            : 'bg-muted text-muted-foreground hover:bg-accent',
          className
        )}
      >
        <Bookmark className={cn('h-4 w-4', isFavorited && 'fill-current')} />
      </button>
    )
  }

  return (
    <Button
      type="button"
      variant={isFavorited ? 'default' : 'outline'}
      className={cn('flex-1 gap-2', className)}
      onClick={handleClick}
      disabled={toggle.isPending}
      aria-pressed={isFavorited}
    >
      <Bookmark className={cn('h-4 w-4', isFavorited && 'fill-current')} />
      {isFavorited ? 'Favori' : 'Favoris'}
    </Button>
  )
}
