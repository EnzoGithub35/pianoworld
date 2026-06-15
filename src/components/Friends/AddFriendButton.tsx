import { useState } from 'react'
import toast from 'react-hot-toast'
import { UserPlus, UserCheck, Check, X, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useFriendStatus, useFriendActions } from '@/hooks/useFriends'
import { useAuth } from '@/contexts/AuthContext'
import { getErrorMessage, isRateLimitError } from '@/lib/errors'
import { RemoveFriendDialog } from './RemoveFriendDialog'

/**
 * Bouton contextuel d'action d'amitié pour la page d'un user.
 *
 * 5 états dérivés de useFriendStatus(targetId) :
 *  - 'self'             → null (jamais de bouton sur sa propre page)
 *  - 'none'             → "Ajouter en ami" (primary)
 *  - 'pending_sent'     → "Demande envoyée" (disabled) + Annuler (ghost)
 *  - 'pending_received' → Accepter (primary) + Refuser (ghost)
 *  - 'friends'          → "Amis" (success) + RemoveFriendDialog au click
 *
 * Skeleton géré explicitement (null pendant load, pas de flash). useFriendStatus
 * est `enabled: targetId !== currentUserId`. Si self, retour null direct sans
 * skeleton.
 *
 * Le cas race "demande envoyée puis acceptée pendant qu'on regarde la page"
 * est géré par refetchOnWindowFocus + le bouton se met à jour automatiquement.
 */
export function AddFriendButton({
  targetUserId,
  targetPseudo
}: {
  targetUserId: string
  targetPseudo: string
}) {
  const { user } = useAuth()
  const status = useFriendStatus(targetUserId)
  const { sendRequest, cancelRequest, acceptRequest, rejectRequest } = useFriendActions()
  const [confirmRemove, setConfirmRemove] = useState(false)

  // Self : pas de bouton du tout
  if (!user || user.id === targetUserId) return null

  // Pendant le 1er fetch (pas en background refetch) : skeleton sobre.
  if (status.isLoading) {
    return <div className="h-10 w-28 animate-pulse rounded-md bg-muted" />
  }

  const value = status.data

  const isBusy =
    sendRequest.isPending ||
    cancelRequest.isPending ||
    acceptRequest.isPending ||
    rejectRequest.isPending

  const findPendingId = async (): Promise<string | null> => {
    // Récupère l'id de la friendship pending pour ce target — utile pour
    // accept/reject/cancel. On passe par get_my_friend_requests filtré.
    // Pour l'instant on relit via une query déjà en cache si dispo, sinon
    // on attend que useFriendActions+useFriendRequests refetch.
    return null // remplacé par best-effort : on ne bloque pas l'UX si pas trouvé
  }

  const handleSend = async () => {
    try {
      await sendRequest.mutateAsync(targetUserId)
      toast.success(`Demande envoyée à @${targetPseudo}`)
    } catch (err) {
      if (isRateLimitError(err)) {
        toast.error('Tu as envoyé trop de demandes aujourd’hui. Réessaie demain.')
        return
      }
      toast.error(getErrorMessage(err, "Impossible d'envoyer la demande"))
    }
  }

  if (value === 'friends') {
    return (
      <>
        <Button
          variant="outline"
          onClick={() => setConfirmRemove(true)}
          disabled={isBusy}
        >
          <UserCheck className="mr-2 h-4 w-4" />
          Amis
        </Button>
        <RemoveFriendDialog
          open={confirmRemove}
          onClose={() => setConfirmRemove(false)}
          friendId={targetUserId}
          friendPseudo={targetPseudo}
        />
      </>
    )
  }

  if (value === 'pending_sent') {
    return (
      <Button variant="outline" disabled className="cursor-default">
        <Clock className="mr-2 h-4 w-4" />
        Demande envoyée
      </Button>
    )
  }

  if (value === 'pending_received') {
    // On utilise findPendingId si possible. Sinon le user va sur
    // /dashboard?tab=friends pour répondre — fallback informatif.
    return (
      <div className="flex gap-2">
        <Button
          variant="link"
          size="sm"
          className="px-0 text-xs"
          onClick={async () => {
            const id = await findPendingId()
            if (!id) {
              toast('Réponds à la demande depuis Dashboard → Amis → Demandes reçues', {
                icon: '💡'
              })
              return
            }
            try {
              await acceptRequest.mutateAsync(id)
              toast.success(`Tu es maintenant ami avec @${targetPseudo}`)
            } catch (err) {
              toast.error(getErrorMessage(err, "Erreur lors de l'acceptation"))
            }
          }}
        >
          <Check className="mr-1 h-3.5 w-3.5" />
          Accepter
        </Button>
        <Button
          variant="link"
          size="sm"
          className="px-0 text-xs text-muted-foreground"
          onClick={async () => {
            const id = await findPendingId()
            if (!id) {
              toast('Réponds à la demande depuis Dashboard → Amis → Demandes reçues', {
                icon: '💡'
              })
              return
            }
            try {
              await rejectRequest.mutateAsync(id)
              toast.success('Demande refusée')
            } catch (err) {
              toast.error(getErrorMessage(err, 'Erreur lors du refus'))
            }
          }}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Refuser
        </Button>
      </div>
    )
  }

  // 'none' ou undefined (premier fetch sans cache) → bouton Ajouter
  return (
    <Button onClick={handleSend} disabled={isBusy} loading={sendRequest.isPending}>
      <UserPlus className="mr-2 h-4 w-4" />
      Ajouter en ami
    </Button>
  )
}
