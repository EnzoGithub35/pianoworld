import { Calendar } from 'lucide-react'
import { useEvents, useMyParticipations } from '@/hooks/useEvents'
import { EventCard } from './EventCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'

/** Liste des évènements côté utilisateur, depuis le Dashboard. */
export function EventsTab() {
  const { data: events, isLoading } = useEvents(false)
  const { data: mine } = useMyParticipations()

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    )
  }

  if (!events || events.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="Aucun évènement prévu"
          description="L'équipe organisera bientôt quelque chose. Reviens vite !"
        />
      </div>
    )
  }

  return (
    <ul className="space-y-3 p-4 pb-24">
      {events.map((e) => (
        <li key={e.id}>
          <EventCard event={e} iAmJoined={mine?.has(e.id) ?? false} />
        </li>
      ))}
    </ul>
  )
}
