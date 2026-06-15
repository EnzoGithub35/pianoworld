import { useState } from 'react'
import toast from 'react-hot-toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { useFriendActions } from '@/hooks/useFriends'
import { getErrorMessage } from '@/lib/errors'

/**
 * Dialog de confirmation pour retirer un ami.
 *
 * Convention de sécurité user : confirmation textuelle (taper "retirer")
 * — empêche un clic accidentel + ralentit un éventuel attaquant ayant
 * volé une session courte. Audit log côté SQL (remove_friendship).
 */
export function RemoveFriendDialog({
  open,
  onClose,
  friendId,
  friendPseudo
}: {
  open: boolean
  onClose: () => void
  friendId: string
  friendPseudo: string
}) {
  const { removeFriend } = useFriendActions()
  const [confirm, setConfirm] = useState('')

  const canSubmit = confirm.trim().toLowerCase() === 'retirer'

  const handleConfirm = async () => {
    if (!canSubmit) return
    try {
      await removeFriend.mutateAsync(friendId)
      toast.success(`@${friendPseudo} n'est plus dans tes amis`)
      setConfirm('')
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erreur lors du retrait'))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        setConfirm('')
        onClose()
      }}
      title={`Retirer @${friendPseudo} ?`}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Tu ne verras plus ses sessions privées et il ne verra plus les tiennes. Aucune
          notification ne lui sera envoyée. Tu pourras lui envoyer une nouvelle demande à
          tout moment.
        </p>
        <div className="space-y-2">
          <Label htmlFor="confirm-remove">
            Tape <strong>retirer</strong> pour confirmer
          </Label>
          <Input
            id="confirm-remove"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoFocus
            autoComplete="off"
            placeholder="retirer"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setConfirm('')
              onClose()
            }}
          >
            Annuler
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={!canSubmit}
            loading={removeFriend.isPending}
            onClick={handleConfirm}
          >
            Retirer
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
