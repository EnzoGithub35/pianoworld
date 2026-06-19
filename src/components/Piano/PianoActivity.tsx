import { Users } from 'lucide-react'
import { SessionList } from './SessionList'
import { PresenceFlow } from './PresenceFlow'
import { VisitorStack } from './VisitorStack'

/**
 * Section "Activité" sur PianoPage : sessions (live + à venir) + passages
 * récents + un CTA unifié "Signaler ma présence" (audit Sprint 3 P1/M —
 * remplace les 2 boutons VisitButton + SessionButton par un flow dialog
 * passé/futur pour rendre le mental model explicite côté newcomer).
 *
 * Embarquée par PianoPage entre les boutons d'action (Naviguer / Partager)
 * et la section "Mise à jour".
 */
export function PianoActivity({ pianoId }: { pianoId: string }) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Activité</h2>

      <SessionList pianoId={pianoId} />

      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Users className="h-3.5 w-3.5 text-primary" />
          Passages récents
        </div>
        <VisitorStack pianoId={pianoId} />
      </div>

      <div className="border-t border-border pt-4">
        <PresenceFlow pianoId={pianoId} />
      </div>
    </section>
  )
}
