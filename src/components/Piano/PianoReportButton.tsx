import { useState } from 'react'
import { Flag } from 'lucide-react'
import toast from 'react-hot-toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { REPORT_REASON_MAX } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'

export function PianoReportButton({ pianoId }: { pianoId: string }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!user) return
    if (!reason.trim()) {
      toast.error('Précise une raison')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('piano_reports').insert({
        piano_id: pianoId,
        reported_by: user.id,
        reason: reason.trim()
      })
      if (error) {
        logger.error('piano.report', 'insert failed', error, { pianoId })
        throw error
      }
      logger.info('piano.report', 'success', { pianoId })
      toast.success('Signalement envoyé, merci')
      setReason('')
      setOpen(false)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Échec du signalement'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"
      >
        <Flag className="h-3 w-3" /> Signaler
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Signaler ce piano">
        <p className="mb-3 text-xs text-muted-foreground">
          Photo inappropriée, fausse information, doublon… Explique le problème.
        </p>
        <div className="space-y-2">
          <Label htmlFor="report-reason">Raison</Label>
          <Textarea
            id="report-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={REPORT_REASON_MAX}
            placeholder="Décris le problème…"
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button className="flex-1" loading={submitting} onClick={handleSubmit}>
            Envoyer
          </Button>
        </div>
      </Dialog>
    </>
  )
}
