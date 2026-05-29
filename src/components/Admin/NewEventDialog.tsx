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
import { getErrorMessage } from '@/lib/errors'
import { eventFormSchema } from '@/lib/schemas'
import {
  EVENT_DESCRIPTION_MAX,
  EVENT_LOCATION_MAX,
  EVENT_TITLE_MAX
} from '@/lib/constants'

function defaultStart(): string {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000)
  d.setMinutes(0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function NewEventDialog({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [startsAt, setStartsAt] = useState<string>(defaultStart)
  const [endsAt, setEndsAt] = useState<string>('')
  const [maxParticipants, setMaxParticipants] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setTitle('')
    setDescription('')
    setLocation('')
    setStartsAt(defaultStart())
    setEndsAt('')
    setMaxParticipants('')
  }

  const handleSubmit = async () => {
    if (!user) return
    const parsed = eventFormSchema.safeParse({
      title,
      description,
      location,
      starts_at: new Date(startsAt),
      ends_at: endsAt ? new Date(endsAt) : null,
      max_participants: maxParticipants ? parseInt(maxParticipants, 10) : null
    })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Formulaire invalide')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('events').insert({
        title: parsed.data.title,
        description: parsed.data.description,
        location: parsed.data.location,
        starts_at: parsed.data.starts_at.toISOString(),
        ends_at: parsed.data.ends_at ? parsed.data.ends_at.toISOString() : null,
        max_participants: parsed.data.max_participants ?? null,
        created_by: user.id
      })
      if (error) {
        logger.error('admin.eventCreate', 'insert failed', error)
        throw error
      }
      logger.info('admin.eventCreate', 'success')
      toast.success('Évènement créé')
      await queryClient.invalidateQueries({ queryKey: ['events'] })
      reset()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Création échouée'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nouvel évènement">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="event-title">Titre</Label>
          <Input
            id="event-title"
            value={title}
            maxLength={EVENT_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Rencontre piano dimanche"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="event-location">Lieu</Label>
          <Input
            id="event-location"
            value={location}
            maxLength={EVENT_LOCATION_MAX}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Parc du Thabor, Rennes"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="event-start">Début</Label>
            <Input
              id="event-start"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-end">Fin (opt.)</Label>
            <Input
              id="event-end"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="event-max">Limite de participants (optionnel)</Label>
          <Input
            id="event-max"
            type="number"
            min={1}
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
            placeholder="Aucune limite si vide"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="event-desc">Description</Label>
          <Textarea
            id="event-desc"
            value={description}
            maxLength={EVENT_DESCRIPTION_MAX}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Programme, matos, ambiance…"
            rows={4}
          />
          <p className="text-right text-xs text-muted-foreground">
            {description.length}/{EVENT_DESCRIPTION_MAX}
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Annuler
          </Button>
          <Button className="flex-1" loading={submitting} onClick={handleSubmit}>
            Créer
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
