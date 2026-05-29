import { useState } from 'react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage, isUniqueViolation } from '@/lib/errors'
import {
  PSEUDO_MAX_LENGTH,
  PSEUDO_MIN_LENGTH,
  PSEUDO_REGEX
} from '@/lib/constants'

export function EditPseudoDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}) {
  const { user, profile, refreshProfile } = useAuth()
  const queryClient = useQueryClient()
  const [pseudo, setPseudo] = useState(profile?.pseudo ?? '')
  const [submitting, setSubmitting] = useState(false)

  const handleSave = async () => {
    if (!user) return
    const trimmed = pseudo.trim()
    if (trimmed.length < PSEUDO_MIN_LENGTH || trimmed.length > PSEUDO_MAX_LENGTH) {
      toast.error(`Entre ${PSEUDO_MIN_LENGTH} et ${PSEUDO_MAX_LENGTH} caractères`)
      return
    }
    if (!PSEUDO_REGEX.test(trimmed)) {
      toast.error('Caractères autorisés : lettres, chiffres, _ - .')
      return
    }
    if (trimmed === profile?.pseudo) {
      onClose()
      return
    }
    setSubmitting(true)
    try {
      const { data: existing, error: lookupError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('pseudo', trimmed)
        .neq('id', user.id)
        .maybeSingle()
      if (lookupError) {
        logger.error('settings.pseudo', 'lookup failed', lookupError, { trimmed })
        throw lookupError
      }
      if (existing) {
        toast.error('Ce pseudo est déjà pris')
        setSubmitting(false)
        return
      }
      const { error } = await supabase
        .from('profiles')
        .update({ pseudo: trimmed })
        .eq('id', user.id)
      if (error) {
        if (isUniqueViolation(error)) {
          toast.error('Ce pseudo est déjà pris')
          setSubmitting(false)
          return
        }
        logger.error('settings.pseudo', 'update failed', error, { userId: user.id })
        throw error
      }
      await refreshProfile()
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
      logger.info('settings.pseudo', 'updated', { userId: user.id })
      toast.success('Pseudo mis à jour')
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Échec'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Modifier mon pseudo">
      <div className="space-y-2">
        <Label htmlFor="pseudo-input">Nouveau pseudo</Label>
        <Input
          id="pseudo-input"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          autoFocus
        />
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Annuler
        </Button>
        <Button className="flex-1" loading={submitting} onClick={handleSave}>
          Enregistrer
        </Button>
      </div>
    </Dialog>
  )
}
