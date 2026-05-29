import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { replyFormSchema } from '@/lib/schemas'
import { REQUEST_MESSAGE_MAX } from '@/lib/constants'
import type { UserRequestWithUser } from '@/hooks/useUserRequests'

export function ReplyDialog({
  open,
  request,
  onClose
}: {
  open: boolean
  request: UserRequestWithUser | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [reply, setReply] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!request) return
    const parsed = replyFormSchema.safeParse({ reply })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Réponse invalide')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('reply_to_request', {
        request_id: request.id,
        reply: parsed.data.reply
      })
      if (error) {
        logger.error('admin.reply', 'rpc failed', error, { requestId: request.id })
        throw error
      }
      logger.info('admin.reply', 'success', { requestId: request.id })
      toast.success('Réponse envoyée')
      await queryClient.invalidateQueries({ queryKey: ['admin-requests'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-kpis'] })
      setReply('')
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Envoi échoué'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={request ? `Répondre — ${request.subject}` : 'Répondre'}>
      {request && (
        <div className="space-y-3">
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              @{request.author?.pseudo ?? 'inconnu'}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{request.message}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reply">Ta réponse</Label>
            <Textarea
              id="reply"
              value={reply}
              maxLength={REQUEST_MESSAGE_MAX}
              onChange={(e) => setReply(e.target.value)}
              rows={5}
              placeholder="Ta réponse sera visible par l'utilisateur dans son dashboard."
            />
            <p className="text-right text-xs text-muted-foreground">
              {reply.length}/{REQUEST_MESSAGE_MAX}
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
      )}
    </Dialog>
  )
}
