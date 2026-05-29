import { useEffect, useState } from 'react'
import { Inbox, MessageSquarePlus, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMyRequests } from '@/hooks/useUserRequests'
import { fromNow } from '@/lib/date'
import { REQUESTS_LAST_SEEN_KEY } from '@/lib/constants'
import { NewRequestDialog } from './NewRequestDialog'

function readLastSeen(): number {
  const raw = localStorage.getItem(REQUESTS_LAST_SEEN_KEY)
  return raw ? Number(raw) : 0
}

export function MyRequestsTab() {
  const { data: requests, isLoading } = useMyRequests()
  const [creating, setCreating] = useState(false)

  /** Au montage, on marque comme "vues" toutes les réponses actuelles. */
  useEffect(() => {
    if (!requests) return
    const latest = requests
      .map((r) => (r.replied_at ? new Date(r.replied_at).getTime() : 0))
      .reduce((a, b) => Math.max(a, b), 0)
    if (latest > 0) {
      localStorage.setItem(REQUESTS_LAST_SEEN_KEY, String(latest))
    }
  }, [requests])

  return (
    <div className="space-y-4 p-4 pb-24">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)} className="gap-1.5">
          <MessageSquarePlus className="h-4 w-4" /> Nouvelle demande
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && requests && requests.length === 0 && (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title="Aucune demande pour l'instant"
          description="Pose une question, signale un bug, propose une idée — toutes les réponses arrivent ici."
        />
      )}

      <ul className="space-y-3">
        {requests?.map((r) => {
          const replyTime = r.replied_at ? new Date(r.replied_at).getTime() : 0
          const isFresh = replyTime > 0 && replyTime > readLastSeen()
          return (
            <li
              key={r.id}
              className="space-y-3 rounded-xl border border-border bg-card p-4"
            >
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.subject}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Envoyée {fromNow(r.created_at)}
                  </p>
                </div>
                {r.status === 'open' ? (
                  <Badge>En attente</Badge>
                ) : isFresh ? (
                  <Badge variant="primary">Nouvelle réponse</Badge>
                ) : (
                  <Badge variant="success">Répondue</Badge>
                )}
              </header>
              <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2 text-sm">
                {r.message}
              </p>
              {r.admin_reply && (
                <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                    <ShieldCheck className="h-3 w-3" />
                    Réponse admin · {r.replied_at ? fromNow(r.replied_at) : ''}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{r.admin_reply}</p>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <NewRequestDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
