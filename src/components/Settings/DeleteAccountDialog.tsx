import { useState } from 'react'
import toast from 'react-hot-toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { useAuth } from '@/contexts/AuthContext'

export function DeleteAccountDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}) {
  const { profile, signOut } = useAuth()
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canDelete = profile && confirmText === profile.pseudo

  const handleDelete = async () => {
    if (!canDelete) return
    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('delete_my_account')
      if (error) {
        logger.error('settings.deleteAccount', 'rpc failed', error)
        throw error
      }
      logger.info('settings.deleteAccount', 'success')
      toast.success('Compte supprimé')
      await signOut()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Suppression échouée'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Supprimer mon compte ?">
      <p className="mb-3 text-sm text-muted-foreground">
        Ton compte, tes pianos, tes photos et tes mises à jour seront définitivement supprimés.
        Cette action est irréversible.
      </p>
      <div className="space-y-2">
        <Label htmlFor="confirm-pseudo">
          Tape <strong>@{profile?.pseudo}</strong> pour confirmer :
        </Label>
        <Input
          id="confirm-pseudo"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={profile?.pseudo}
        />
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Annuler
        </Button>
        <Button
          variant="destructive"
          className="flex-1"
          disabled={!canDelete}
          loading={submitting}
          onClick={handleDelete}
        >
          Supprimer
        </Button>
      </div>
    </Dialog>
  )
}
