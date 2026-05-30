import { useState } from 'react'
import toast from 'react-hot-toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage, isInvalidPassword } from '@/lib/errors'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Suppression de compte irréversible. Double confirmation :
 *  1. Tape le pseudo (anti-clic accidentel)
 *  2. Re-saisis le mot de passe (anti-session-volée — la RPC vérifie via
 *     verify_my_password côté serveur).
 *
 * RPC `delete_my_account(p_password)` SECURITY DEFINER cascade-supprime
 * auth.users + profiles + tout le reste via foreign keys.
 */
export function DeleteAccountDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}) {
  const { profile, signOut } = useAuth()
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setConfirmText('')
    setPassword('')
  }

  const handleClose = () => {
    if (submitting) return
    reset()
    onClose()
  }

  const canDelete = profile && confirmText === profile.pseudo && password.length > 0

  const handleDelete = async () => {
    if (!canDelete) return
    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('delete_my_account', { p_password: password })
      if (error) {
        if (isInvalidPassword(error)) {
          toast.error('Mot de passe incorrect')
          return
        }
        logger.error('settings.deleteAccount', 'rpc failed', error)
        throw error
      }
      logger.info('settings.deleteAccount', 'success')
      toast.success('Compte supprimé')
      reset()
      await signOut()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Suppression échouée'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Supprimer mon compte ?">
      <p className="mb-3 text-sm text-muted-foreground">
        Ton compte, tes pianos, tes photos et tes mises à jour seront définitivement
        supprimés. Cette action est irréversible.
      </p>
      <div className="space-y-3">
        <div className="space-y-1.5">
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
        <div className="space-y-1.5">
          <Label htmlFor="delete-password">Ton mot de passe</Label>
          <Input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
          />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleClose}
          disabled={submitting}
        >
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
