import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getFriendlyErrorMessage } from '@/lib/errors'
import { requestFormSchema } from '@/lib/schemas'
import { RATE_LIMITS, REQUEST_MESSAGE_MAX, REQUEST_SUBJECT_MAX } from '@/lib/constants'

export function NewRequestDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!user) return
    const parsed = requestFormSchema.safeParse({ subject, message })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Formulaire invalide')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('user_requests').insert({
        user_id: user.id,
        subject: parsed.data.subject,
        message: parsed.data.message
      })
      if (error) {
        logger.error('request.create', 'insert failed', error)
        throw error
      }
      logger.info('request.create', 'success')
      toast.success('Demande envoyée')
      await queryClient.invalidateQueries({ queryKey: ['my-requests'] })
      setSubject('')
      setMessage('')
      onClose()
    } catch (err) {
      toast.error(
        getFriendlyErrorMessage(err, {
          fallback: 'Envoi échoué',
          rateLimitLabels: RATE_LIMITS
        })
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nouvelle demande">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Question, bug, suggestion, demande de modification… L'admin te répondra ici dans
          l'app.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="req-subject">Sujet</Label>
          <Input
            id="req-subject"
            value={subject}
            maxLength={REQUEST_SUBJECT_MAX}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ex : bug à l'inscription"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="req-message">Message</Label>
          <Textarea
            id="req-message"
            value={message}
            maxLength={REQUEST_MESSAGE_MAX}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Décris ta demande…"
          />
          <p className="text-right text-xs text-muted-foreground">
            {message.length}/{REQUEST_MESSAGE_MAX}
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Annuler
          </Button>
          <Button className="flex-1" loading={submitting} onClick={handleSubmit}>
            Envoyer
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
