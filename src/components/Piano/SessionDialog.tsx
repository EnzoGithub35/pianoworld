import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Users, Globe2, UserPlus } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import { HelpTooltip } from '@/components/ui/HelpTooltip'
import { useAuth } from '@/contexts/AuthContext'
import { useFriends } from '@/hooks/useFriends'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getFriendlyErrorMessage } from '@/lib/errors'
import { sessionFormSchema } from '@/lib/schemas'
import {
  RATE_LIMITS,
  SESSION_DURATION_OPTIONS,
  SESSION_FUTURE_DAYS_MAX
} from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { PianoSessionVisibility } from '@/types/database'

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
  const friends = useFriends()
  const friendsCount = friends.data?.length ?? 0
  const [preset, setPreset] = useState<StartPreset>('now')
  const [customStart, setCustomStart] = useState<string>(() =>
    localIsoForInput(new Date(Date.now() + 60 * 60 * 1000))
  )
  const [duration, setDuration] = useState<number>(30)
  const [visibility, setVisibility] = useState<PianoSessionVisibility>('public')
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
    if (submitting) return
    if (!user) return
    // Safeguard friends-only sans ami : le radio devrait être désactivé,
    // mais cache stale possible (user vient d'ajouter un ami dans un autre tab).
    if (visibility === 'friends' && friendsCount === 0) {
      toast.error("Tu n'as pas encore d'amis pour limiter la visibilité.")
      return
    }
    const startsAt = resolveStartDate()
    const parsed = sessionFormSchema.safeParse({
      starts_at: startsAt,
      duration_min: duration,
      visibility
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
        duration_min: parsed.data.duration_min,
        visibility: parsed.data.visibility
      })
      if (error) {
        logger.error('session.create', 'insert failed', error, { pianoId })
        throw error
      }
      logger.info('session.create', 'success', {
        pianoId,
        durationMin: parsed.data.duration_min,
        visibility: parsed.data.visibility
      })
      toast.success("C'est noté, à tout de suite")
      await queryClient.invalidateQueries({ queryKey: ['piano-sessions', pianoId] })
      await queryClient.invalidateQueries({ queryKey: ['active-piano-ids'] })
      await queryClient.invalidateQueries({ queryKey: ['recent-feed'] })
      await queryClient.invalidateQueries({
        queryKey: ['piano-presence-list', pianoId]
      })
      await queryClient.invalidateQueries({ queryKey: ['piano-active-counts'] })
      onClose()
    } catch (err) {
      toast.error(
        getFriendlyErrorMessage(err, {
          fallback: 'Création échouée',
          rateLimitLabels: RATE_LIMITS
        })
      )
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

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label>Qui peut voir ?</Label>
            <HelpTooltip label="En savoir plus sur la visibilité">
              <strong className="block text-foreground">Tout le monde</strong> : ton
              créneau est public sur la fiche du piano.
              <br />
              <strong className="mt-1.5 block text-foreground">Mes amis</strong> : seuls
              tes amis voient ton créneau et reçoivent une notification quand tu arrives.
            </HelpTooltip>
          </div>
          {friendsCount === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
              <p className="mb-1.5">
                Ta session sera <strong>publique</strong> (tout le monde).
              </p>
              <Link
                to="/search"
                onClick={onClose}
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <UserPlus className="h-3 w-3" />
                Pour la limiter à tes amis, ajoute-en d'abord
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-md border px-3 py-2.5 text-xs font-medium transition-colors',
                  visibility === 'public'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-accent'
                )}
              >
                <Globe2 className="h-4 w-4" />
                Tout le monde
              </button>
              <button
                type="button"
                onClick={() => setVisibility('friends')}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-md border px-3 py-2.5 text-xs font-medium transition-colors',
                  visibility === 'friends'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-accent'
                )}
              >
                <Users className="h-4 w-4" />
                Mes amis ({friendsCount})
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {visibility === 'friends'
            ? 'Seuls tes amis verront ton créneau et recevront une notification.'
            : friendsCount === 0
              ? 'Les autres pianistes verront ton créneau. Ajoute des amis pour qu’ils soient notifiés la prochaine fois.'
              : 'Les autres pianistes verront ton créneau. Tes amis recevront une notification.'}
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
