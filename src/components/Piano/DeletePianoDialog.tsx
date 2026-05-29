import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { deletePianoPhoto } from '@/lib/photo'
import type { Piano } from '@/types/database'

export function DeletePianoDialog({
  open,
  piano,
  onClose
}: {
  open: boolean
  piano: Piano
  onClose: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)

  const handleDelete = async () => {
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('pianos')
        .update({ is_deleted: true })
        .eq('id', piano.id)
      if (error) {
        logger.error('piano.delete', 'soft delete failed', error, { pianoId: piano.id })
        throw error
      }
      if (piano.photo_url) await deletePianoPhoto(piano.photo_url)
      logger.info('piano.delete', 'success', { pianoId: piano.id })
      toast.success('Piano supprimé')
      await queryClient.invalidateQueries({ queryKey: ['pianos'] })
      onClose()
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erreur de suppression'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Supprimer ce piano ?">
      <p className="mb-4 text-sm text-muted-foreground">
        Cette action est irréversible. La photo et les mises à jour seront effacées.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
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
    </Dialog>
  )
}
