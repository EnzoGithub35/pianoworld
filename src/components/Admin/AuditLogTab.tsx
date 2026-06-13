import { useState } from 'react'
import {
  History,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserPlus,
  type LucideIcon
} from 'lucide-react'
import { useAuditLog } from '@/hooks/useAuditLog'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { fromNow } from '@/lib/date'
import { cn } from '@/lib/utils'

type ActionFilter =
  | 'all'
  | 'set_user_role'
  | 'set_user_banned'
  | 'resolve_report'
  | 'force_delete_piano'
  | 'reply_to_request'

const ACTION_META: Record<
  Exclude<ActionFilter, 'all'>,
  { label: string; icon: LucideIcon; color: string }
> = {
  set_user_role: {
    label: 'Changement de rôle',
    icon: ShieldCheck,
    color: 'text-primary'
  },
  set_user_banned: {
    label: 'Ban / Débannissement',
    icon: UserMinus,
    color: 'text-destructive'
  },
  resolve_report: {
    label: 'Signalement classé',
    icon: ShieldAlert,
    color: 'text-amber-600'
  },
  force_delete_piano: {
    label: 'Suppression forcée',
    icon: Trash2,
    color: 'text-destructive'
  },
  reply_to_request: { label: 'Réponse à demande', icon: UserPlus, color: 'text-sky-600' }
}

function formatPayload(action: string, payload: Record<string, unknown>): string {
  switch (action) {
    case 'set_user_role':
      return `→ ${String(payload.new_role ?? '')}`
    case 'set_user_banned':
      return payload.banned ? 'banni' : 'débanni'
    case 'reply_to_request':
      return `réponse (${payload.reply_len ?? '?'} chars)`
    default:
      return ''
  }
}

export function AuditLogTab() {
  const [filter, setFilter] = useState<ActionFilter>('all')
  const { data: entries, isLoading } = useAuditLog({
    action: filter === 'all' ? undefined : filter
  })

  const filters: { id: ActionFilter; label: string }[] = [
    { id: 'all', label: 'Tout' },
    { id: 'set_user_banned', label: 'Bans' },
    { id: 'set_user_role', label: 'Rôles' },
    { id: 'force_delete_piano', label: 'Suppressions' },
    { id: 'resolve_report', label: 'Signalements' },
    { id: 'reply_to_request', label: 'Réponses' }
  ]

  return (
    <div className="space-y-4 p-4 pb-24">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filter === f.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-accent'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex gap-3 rounded-xl border border-border p-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && entries && entries.length === 0 && (
        <EmptyState
          icon={<History className="h-6 w-6" />}
          title="Aucune entrée"
          description={
            filter === 'all'
              ? "Aucune action admin n'a été tracée pour l'instant."
              : 'Aucune entrée pour ce filtre.'
          }
        />
      )}

      <ul className="space-y-2">
        {entries?.map((e) => {
          const meta = ACTION_META[e.action as Exclude<ActionFilter, 'all'>]
          const Icon = meta?.icon ?? History
          return (
            <li
              key={e.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
            >
              <span
                className={cn(
                  'mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted',
                  meta?.color
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="font-medium">
                    {e.actor?.pseudo ? `@${e.actor.pseudo}` : 'inconnu'}
                  </span>
                  <Badge variant="outline" className="font-mono">
                    {meta?.label ?? e.action}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {fromNow(e.created_at)}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {e.target_id && (
                    <span className="font-mono">cible {e.target_id.slice(0, 8)}…</span>
                  )}
                  {formatPayload(e.action, e.payload) && (
                    <span> · {formatPayload(e.action, e.payload)}</span>
                  )}
                </p>
              </div>
              {e.actor && <Avatar pseudo={e.actor.pseudo} size="sm" />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
