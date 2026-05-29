import { useState } from 'react'
import { Footprints } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'

/**
 * Bouton "J'y suis passé". Insère une visite et invalide le cache.
 * Désactivé 3 s après clic pour éviter les doubles soumissions involontaires
 * (anti-spam soft choisi par l'utilisateur).
 */
export function VisitButton({ pianoId }: { pianoId: string }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(false)

  const handleClick = async () => {
    if (!user || submitting || cooldown) return
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
      await queryClient.invalidateQueries({ queryKey: ['piano-visits', pianoId] })
      await queryClient.invalidateQueries({ queryKey: ['recent-feed'] })
      setCooldown(true)
      window.setTimeout(() => setCooldown(false), 3000)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erreur'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Button
      variant="outline"
      className="flex-1 gap-2"
      loading={submitting}
      disabled={cooldown}
      onClick={handleClick}
    >
      <Footprints className="h-4 w-4" />
      {cooldown ? 'Enregistré' : "J'y suis passé"}
    </Button>
  )
}
