import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage, isInvalidPassword } from '@/lib/errors'
import { deletePianoPhoto } from '@/lib/photo'
import type { Piano } from '@/types/database'

export function DeletePianoDialog({
  open,
  piano,
  mode,
  onClose
}: {
  open: boolean
  piano: Piano
  /** 'owner' : suppression directe par le créateur (pas de mot de passe,
   *  couvert par la policy RLS pianos_update_owner). 'admin' : suppression
   *  forcée d'un piano qui n'est pas le sien, via la RPC force_delete_piano
   *  (SECURITY DEFINER, garde is_admin() + re-auth mot de passe, auditée). */
  mode: 'owner' | 'admin'
  onClose: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)
  const [password, setPassword] = useState('')

  const afterSuccess = async () => {
    if (piano.photo_url) await deletePianoPhoto(piano.photo_url)
    toast.success('Piano supprimé')
    await queryClient.invalidateQueries({ queryKey: ['pianos'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-kpis'] })
    setPassword('')
    onClose()
    navigate('/map', { replace: true })
  }

  const handleOwnerDelete = async (): Promise<boolean> => {
    // RPC plutôt qu'un update direct : `pianos_select` (is_deleted = false)
    // rendrait la ligne résultante invisible pour son propre auteur, ce que
    // Postgres refuse sous RLS (cf. delete_my_piano dans schema.sql).
    const { error } = await supabase.rpc('delete_my_piano', { target: piano.id })
    if (error) {
      logger.error('piano.delete', 'soft delete failed', error, { pianoId: piano.id })
      throw error
    }
    logger.info('piano.delete', 'success', { pianoId: piano.id })
    return true
  }

  const handleAdminForceDelete = async (): Promise<boolean> => {
    if (!password) {
      toast.error('Mot de passe requis')
      return false
    }
    const { error } = await supabase.rpc('force_delete_piano', {
      target: piano.id,
      p_password: password
    })
    if (error) {
      if (isInvalidPassword(error)) {
        toast.error('Mot de passe incorrect')
        return false
      }
      logger.error('admin.forceDelete', 'rpc failed', error, { pianoId: piano.id })
      throw error
    }
    logger.warn('admin.forceDelete', 'piano removed by admin', { pianoId: piano.id })
    return true
  }

  const handleDelete = async () => {
    setSubmitting(true)
    try {
      const success =
        mode === 'admin' ? await handleAdminForceDelete() : await handleOwnerDelete()
      if (success) await afterSuccess()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erreur de suppression'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (submitting) return
    setPassword('')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Supprimer ce piano ?">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {mode === 'admin'
            ? 'Suppression administrateur : le piano sera marqué comme supprimé et disparaîtra de la carte. La photo et les mises à jour seront effacées.'
            : 'Cette action est irréversible. La photo et les mises à jour seront effacées.'}
        </p>
        {mode === 'admin' && (
          <div className="space-y-1.5">
            <Label htmlFor="admin-delete-password">Confirme avec ton mot de passe</Label>
            <Input
              id="admin-delete-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ton mot de passe"
              autoFocus
            />
          </div>
        )}
        <div className="flex gap-2 pt-1">
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
            loading={submitting}
            onClick={handleDelete}
          >
            Supprimer
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
