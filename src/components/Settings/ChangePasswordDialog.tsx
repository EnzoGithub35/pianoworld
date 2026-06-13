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
import { changePasswordSchema } from '@/lib/schemas'

/**
 * Changement de mot de passe pour un utilisateur connecté.
 *
 * Flow :
 *  1. RPC `verify_my_password(p)` : compare le mot de passe actuel au hash
 *     bcrypt de `auth.users` côté SQL. Ne rotate PAS le refresh token (vs
 *     signInWithPassword qui déconnecterait les autres onglets/devices).
 *  2. `supabase.auth.updateUser({ password: next })`.
 *
 * Bonne pratique : on N'envoie JAMAIS le nouveau mot de passe par mail.
 * Le user le tape lui-même, et reçoit un mail de confirmation Supabase.
 */
export function ChangePasswordDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}) {
  const { user } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setCurrent('')
    setNext('')
    setConfirm('')
  }

  const handleClose = () => {
    if (submitting) return
    reset()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.email) {
      toast.error('Session invalide, reconnecte-toi')
      return
    }

    const parsed = changePasswordSchema.safeParse({ current, next, confirm })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Champs invalides')
      return
    }

    setSubmitting(true)
    try {
      const { data: verifyOk, error: verifyError } = await supabase.rpc(
        'verify_my_password',
        { p: parsed.data.current }
      )
      if (verifyError) {
        logger.error('settings.changePassword', 'verify rpc failed', verifyError)
        throw verifyError
      }
      if (!verifyOk) {
        logger.warn('settings.changePassword', 'wrong current password')
        toast.error('Mot de passe actuel incorrect')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: parsed.data.next
      })
      if (updateError) {
        logger.error('settings.changePassword', 'update failed', updateError)
        throw updateError
      }

      logger.info('settings.changePassword', 'success', { userId: user.id })
      toast.success('Mot de passe mis à jour')
      reset()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Changement échoué'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Changer mon mot de passe">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="current">Mot de passe actuel</Label>
          <Input
            id="current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="next">Nouveau mot de passe</Label>
          <Input
            id="next"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirmer le nouveau mot de passe</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={handleClose}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button type="submit" className="flex-1" loading={submitting}>
            Mettre à jour
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
