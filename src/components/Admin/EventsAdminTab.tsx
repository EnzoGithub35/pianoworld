import { useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useEvents, useMyParticipations } from '@/hooks/useEvents'
import { EventCard } from '@/components/Events/EventCard'
import { NewEventDialog } from './NewEventDialog'

export function EventsAdminTab() {
  const [creating, setCreating] = useState(false)
  const { data: events, isLoading } = useEvents(true)
  const { data: mine } = useMyParticipations()

  return (
    <div className="space-y-4 p-4 pb-24">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)} className="gap-1.5">
          <CalendarPlus className="h-4 w-4" /> Nouvel évènement
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && events && events.length === 0 && (
        <EmptyState
          icon={<CalendarPlus className="h-6 w-6" />}
          title="Aucun évènement"
          description="Crée le premier évènement de la communauté."
        />
      )}

      <ul className="space-y-3">
        {events?.map((e) => (
          <li key={e.id}>
            <EventCard event={e} iAmJoined={mine?.has(e.id) ?? false} adminMode />
          </li>
        ))}
      </ul>

      <NewEventDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
