import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Check, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { fromNow } from '@/lib/date'
import { useFriendActions } from '@/hooks/useFriends'
import { getErrorMessage } from '@/lib/errors'
import type { FriendRequest } from '@/types/database'

/**
 * Card affichée dans FriendsTab pour une demande d'amitié pending.
 *
 * - direction='received' : boutons Accepter (primary) + Refuser (ghost).
 * - direction='sent'     : bouton Annuler (ghost) + label "Envoyée".
 *
 * Le ghost-reject côté backend (cf. PR-A) fait qu'aucune notif n'est envoyée
 * sur reject, donc le requester ne sait pas qu'il a été refusé — il voit juste
 * que sa demande n'est plus dans "Envoyées" (si on lui dit) au refresh suivant.
 */
export function FriendRequestCard({
  request,
  direction
}: {
  request: FriendRequest
  direction: 'received' | 'sent'
}) {
  const { acceptRequest, rejectRequest, cancelRequest } = useFriendActions()

  const isBusy =
    acceptRequest.isPending || rejectRequest.isPending || cancelRequest.isPending

  const handleAccept = async () => {
    try {
      await acceptRequest.mutateAsync(request.request_id)
      toast.success(`Tu es maintenant ami avec @${request.pseudo}`)
    } catch (err) {
      toast.error(getErrorMessage(err, "Erreur lors de l'acceptation"))
    }
  }

  const handleReject = async () => {
    try {
      await rejectRequest.mutateAsync(request.request_id)
      toast.success('Demande refusée')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erreur lors du refus'))
    }
  }

  const handleCancel = async () => {
    try {
      await cancelRequest.mutateAsync(request.request_id)
      toast.success('Demande annulée')
    } catch (err) {
      toast.error(getErrorMessage(err, "Erreur lors de l'annulation"))
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <Link
        to={`/user/${encodeURIComponent(request.pseudo)}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <Avatar pseudo={request.pseudo} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">@{request.pseudo}</p>
          <p className="truncate text-xs text-muted-foreground">
            {direction === 'received' ? 'Veut être ton ami' : 'Demande envoyée'} ·{' '}
            {fromNow(request.created_at)}
          </p>
        </div>
      </Link>
      {direction === 'received' ? (
        <div className="flex gap-1.5">
          <Button
            size="sm"
            onClick={handleAccept}
            disabled={isBusy}
            loading={acceptRequest.isPending}
            aria-label="Accepter"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReject}
            disabled={isBusy}
            loading={rejectRequest.isPending}
            aria-label="Refuser"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={isBusy}
          loading={cancelRequest.isPending}
        >
          Annuler
        </Button>
      )}
    </div>
  )
}
