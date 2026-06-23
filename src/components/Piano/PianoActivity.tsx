import { Users } from 'lucide-react'
import { SessionList } from './SessionList'
import { VisitorStack } from './VisitorStack'

/**
 * Section "Activité" sur PianoPage : sessions (live + à venir) + passages
 * récents.
 *
 * Sprint UX : le CTA "Signaler ma présence" (PresenceFlow) a été déplacé
 * dans les actions du haut de PianoPage (visible above-the-fold mobile).
 * La section reste consultative — listes uniquement, pas de CTA.
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
    </section>
  )
}
