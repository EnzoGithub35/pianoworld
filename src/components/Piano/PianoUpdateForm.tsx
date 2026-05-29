import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, X as XIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { PIANO_COMMENT_MAX } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import {
  PIANO_QUALITIES,
  QUALITY_LABELS,
  type PianoQuality
} from '@/types/database'

export function PianoUpdateForm({
  pianoId,
  onDone
}: {
  pianoId: string
  onDone?: () => void
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [stillThere, setStillThere] = useState<boolean | null>(null)
  const [newQuality, setNewQuality] = useState<PianoQuality | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!user) return
    if (stillThere === null) {
      toast.error('Indique si le piano est encore là')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('piano_updates').insert({
        piano_id: pianoId,
        updated_by: user.id,
        still_there: stillThere,
        new_quality: newQuality,
        comment: comment.trim() || null
      })
      if (error) {
        logger.error('piano.update', 'insert failed', error, { pianoId })
        throw error
      }
      logger.info('piano.update', 'success', { pianoId, stillThere })
      toast.success('Mise à jour enregistrée')
      await queryClient.invalidateQueries({ queryKey: ['piano-updates', pianoId] })
      await queryClient.invalidateQueries({ queryKey: ['pianos'] })
      setStillThere(null)
      setNewQuality(null)
      setComment('')
      onDone?.()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Échec de la MAJ'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Le piano est-il toujours là ?</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setStillThere(true)}
            className={
              'flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm ' +
              (stillThere === true
                ? 'border-green-600 bg-green-600 text-white'
                : 'border-border bg-background hover:bg-accent')
            }
          >
            <Check className="h-4 w-4" /> Oui
          </button>
          <button
            type="button"
            onClick={() => setStillThere(false)}
            className={
              'flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm ' +
              (stillThere === false
                ? 'border-red-600 bg-red-600 text-white'
                : 'border-border bg-background hover:bg-accent')
            }
          >
            <XIcon className="h-4 w-4" /> Non
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Nouvelle qualité (optionnel)</Label>
        <div className="grid grid-cols-2 gap-2">
          {PIANO_QUALITIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setNewQuality(newQuality === q ? null : q)}
              className={
                'rounded-md border px-3 py-2 text-sm ' +
                (q === newQuality
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-accent')
              }
            >
              {QUALITY_LABELS[q]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="update-comment">Commentaire (optionnel)</Label>
        <Textarea
          id="update-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={PIANO_COMMENT_MAX}
          placeholder="Précisions sur l'état actuel…"
        />
        <p className="text-right text-xs text-muted-foreground">
          {comment.length}/{PIANO_COMMENT_MAX}
        </p>
      </div>

      <Button onClick={handleSubmit} loading={submitting} className="w-full">
        Enregistrer la mise à jour
      </Button>
    </div>
  )
}
