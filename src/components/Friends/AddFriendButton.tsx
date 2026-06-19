import { useState } from 'react'
import toast from 'react-hot-toast'
import { UserPlus, UserCheck, Check, X, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useFriendStatus, useFriendActions, useFriendRequests } from '@/hooks/useFriends'
import { useAuth } from '@/contexts/AuthContext'
import { getErrorMessage, getFriendlyErrorMessage, isRateLimitError } from '@/lib/errors'
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

  // On charge les demandes reçues uniquement quand on en a besoin (status
  // 'pending_received'). useFriendRequests partage le cache → si Dashboard
  // l'a déjà fetché, on hit le cache sans réseau supplémentaire.
  const receivedRequests = useFriendRequests('received')

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

  // Résout l'id de la friendship pending pour ce target via le cache
  // useFriendRequests('received'). Si la query n'a pas encore chargé, on
  // attend qu'elle finisse (refetchOnWindowFocus fait le rattrapage).
  const findPendingId = (): string | null => {
    const list = receivedRequests.data
    if (!list) return null
    const match = list.find((r) => r.user_id === targetUserId)
    return match?.request_id ?? null
  }

  const handleSend = async () => {
    try {
      await sendRequest.mutateAsync(targetUserId)
      toast.success(`Demande envoyée à @${targetPseudo}`)
    } catch (err) {
      // Intercepte spécifiquement le cooldown 30j post-reject (raise
      // 'forbidden' silencieux côté DB). On affiche un message neutre
      // pour ne pas révéler qu'il s'agit d'un refus (ghost-reject contract).
      const msg = getErrorMessage(err, '')
      if (msg.includes('forbidden')) {
        toast.error(
          `@${targetPseudo} n'est pas joignable pour le moment. Reprends contact plus tard.`,
          { duration: 6000 }
        )
        return
      }
      if (isRateLimitError(err)) {
        toast.error('Tu as envoyé trop de demandes aujourd’hui. Réessaie demain.')
        return
      }
      toast.error(
        getFriendlyErrorMessage(err, { fallback: "Impossible d'envoyer la demande" })
      )
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
    // Note : on n'expose pas de bouton "Annuler" inline (le user peut le faire
    // depuis Dashboard → Amis → Envoyées). Garde l'UX ciblée vu qu'annuler
    // est rare et le cooldown ghost-reject anti-stalking est protecteur.
  }

  if (value === 'pending_received') {
    const pendingId = findPendingId()
    // Si la query n'est pas encore chargée → loading discret. Si chargée
    // mais aucun match (race rare) → fallback vers Dashboard.
    if (receivedRequests.isLoading) {
      return <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
    }
    if (!pendingId) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            toast('Réponds à la demande depuis Dashboard → Amis → Reçues', {
              icon: '💡'
            })
          }}
        >
          Voir la demande
        </Button>
      )
    }
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={isBusy}
          loading={acceptRequest.isPending}
          onClick={async () => {
            try {
              await acceptRequest.mutateAsync(pendingId)
              toast.success(`Tu es maintenant ami avec @${targetPseudo}`)
            } catch (err) {
              toast.error(
                getFriendlyErrorMessage(err, { fallback: "Erreur lors de l'acceptation" })
              )
            }
          }}
        >
          <Check className="mr-1 h-3.5 w-3.5" />
          Accepter
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isBusy}
          loading={rejectRequest.isPending}
          onClick={async () => {
            try {
              await rejectRequest.mutateAsync(pendingId)
              toast.success('Demande refusée')
            } catch (err) {
              toast.error(
                getFriendlyErrorMessage(err, { fallback: 'Erreur lors du refus' })
              )
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
