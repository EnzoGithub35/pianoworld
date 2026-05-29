import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { sessionFormSchema } from '@/lib/schemas'
import {
  SESSION_DURATION_OPTIONS,
  SESSION_FUTURE_DAYS_MAX
} from '@/lib/constants'
import { cn } from '@/lib/utils'

/**
 * Formulaire de création de session.
 * - Preset rapide pour le start (maintenant / +30min / +1h) + champ datetime
 *   pour aller chercher plus loin.
 * - Liste fermée de durées (cf. SESSION_DURATION_OPTIONS), évite la confusion
 *   "combien de minutes c'est raisonnable".
 */

type StartPreset = 'now' | 'plus30' | 'plus1h' | 'custom'

function localIsoForInput(d: Date): string {
  // datetime-local attend YYYY-MM-DDTHH:MM dans le fuseau LOCAL (sans Z)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function SessionDialog({
  open,
  pianoId,
  onClose
}: {
  open: boolean
  pianoId: string
  onClose: () => void
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [preset, setPreset] = useState<StartPreset>('now')
  const [customStart, setCustomStart] = useState<string>(() =>
    localIsoForInput(new Date(Date.now() + 60 * 60 * 1000))
  )
  const [duration, setDuration] = useState<number>(30)
  const [submitting, setSubmitting] = useState(false)

  const resolveStartDate = (): Date => {
    const now = Date.now()
    switch (preset) {
      case 'now':
        return new Date(now)
      case 'plus30':
        return new Date(now + 30 * 60 * 1000)
      case 'plus1h':
        return new Date(now + 60 * 60 * 1000)
      case 'custom':
        return new Date(customStart)
    }
  }

  const maxDateAttr = (() => {
    const d = new Date(Date.now() + SESSION_FUTURE_DAYS_MAX * 24 * 60 * 60 * 1000)
    return localIsoForInput(d)
  })()
  const minDateAttr = localIsoForInput(new Date())

  const handleSubmit = async () => {
    if (!user) return
    const startsAt = resolveStartDate()
    const parsed = sessionFormSchema.safeParse({
      starts_at: startsAt,
      duration_min: duration
    })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Formulaire invalide')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('piano_sessions').insert({
        piano_id: pianoId,
        user_id: user.id,
        starts_at: parsed.data.starts_at.toISOString(),
        duration_min: parsed.data.duration_min
      })
      if (error) {
        logger.error('session.create', 'insert failed', error, { pianoId })
        throw error
      }
      logger.info('session.create', 'success', {
        pianoId,
        durationMin: parsed.data.duration_min
      })
      toast.success("C'est noté, à tout de suite")
      await queryClient.invalidateQueries({ queryKey: ['piano-sessions', pianoId] })
      await queryClient.invalidateQueries({ queryKey: ['active-piano-ids'] })
      await queryClient.invalidateQueries({ queryKey: ['recent-feed'] })
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, "Création échouée"))
    } finally {
      setSubmitting(false)
    }
  }

  const presets: { id: StartPreset; label: string }[] = [
    { id: 'now', label: 'Maintenant' },
    { id: 'plus30', label: 'Dans 30 min' },
    { id: 'plus1h', label: 'Dans 1 h' },
    { id: 'custom', label: 'Plus tard…' }
  ]

  return (
    <Dialog open={open} onClose={onClose} title="J'y vais">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Quand ?</Label>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={cn(
                  'rounded-md border px-3 py-2 text-sm transition-colors',
                  preset === p.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-accent'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <Input
              type="datetime-local"
              value={customStart}
              min={minDateAttr}
              max={maxDateAttr}
              onChange={(e) => setCustomStart(e.target.value)}
              className="mt-2"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label>Combien de temps ?</Label>
          <div className="grid grid-cols-5 gap-2">
            {SESSION_DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={cn(
                  'rounded-md border py-2 text-xs font-medium transition-colors',
                  duration === d
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-accent'
                )}
              >
                {d < 60 ? `${d}min` : `${d / 60}h${d % 60 ? ` ${d % 60}` : ''}`}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Les autres pianistes verront ton créneau. Tu pourras l'annuler à tout moment.
        </p>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Annuler
          </Button>
          <Button className="flex-1" loading={submitting} onClick={handleSubmit}>
            Valider
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
