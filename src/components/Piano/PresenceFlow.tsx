import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CalendarPlus, Footprints, Music } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getFriendlyErrorMessage } from '@/lib/errors'
import { RATE_LIMITS } from '@/lib/constants'
import { SessionDialog } from './SessionDialog'

/**
 * v7 — Sprint 3 audit P1/M : flow unifié "Signaler ma présence" sur PianoPage.
 *
 * Mental model explicite côté newcomer mobile-first :
 *  1. Un seul bouton primaire "Signaler ma présence" (vs 2 boutons séparés
 *     dont la différence n'était pas évidente).
 *  2. Dialog avec 2 cards distinctes : Passé (visit) / Futur (session).
 *  3. Choix "Passé" → INSERT visite immédiat + toast (logique VisitButton).
 *  4. Choix "Futur" → ouvre SessionDialog avec le scheduler classique.
 *
 * Préserve les composants VisitButton + SessionButton + SessionDialog
 * existants (back-compat). Seul PianoActivity bascule sur ce flow unifié.
 */
export function PresenceFlow({ pianoId }: { pianoId: string }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [chooseOpen, setChooseOpen] = useState(false)
  const [sessionOpen, setSessionOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleVisit = async () => {
    if (!user || submitting) return
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('piano_visits')
        .insert({ piano_id: pianoId, user_id: user.id })
      if (error) {
        logger.error('visit.add', 'insert failed', error, { pianoId })
        throw error
      }
      logger.info('visit.add', 'success', { pianoId })
      toast.success('Passage enregistré')
      await qc.invalidateQueries({ queryKey: ['piano-visits', pianoId] })
      await qc.invalidateQueries({ queryKey: ['recent-feed'] })
      setChooseOpen(false)
    } catch (err) {
      toast.error(
        getFriendlyErrorMessage(err, { fallback: 'Erreur', rateLimitLabels: RATE_LIMITS })
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handlePickFuture = () => {
    setChooseOpen(false)
    setSessionOpen(true)
  }

  return (
    <>
      <Button className="w-full gap-2" onClick={() => setChooseOpen(true)}>
        <Music className="h-4 w-4" />
        Signaler ma présence
      </Button>

      <Dialog
        open={chooseOpen}
        onClose={() => setChooseOpen(false)}
        title="Tu y es passé ou tu y vas ?"
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleVisit}
            disabled={submitting}
            className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent disabled:opacity-60"
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200">
              <Footprints className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">
                J&apos;y suis allé jouer
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Enregistre un passage récent — visible dans les passages du piano.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={handlePickFuture}
            className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent"
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <CalendarPlus className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">
                Je prévois d&apos;y jouer
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Planifie un créneau — tes amis pourront te rejoindre.
              </span>
            </span>
          </button>
        </div>
      </Dialog>

      <SessionDialog
        open={sessionOpen}
        pianoId={pianoId}
        onClose={() => setSessionOpen(false)}
      />
    </>
  )
}
