import {
  AlertTriangle,
  Flag,
  Footprints,
  Inbox,
  Music,
  ShieldCheck,
  Sparkles,
  UserMinus,
  UserPlus,
  Users
} from 'lucide-react'
import type { ComponentType } from 'react'
import { useAdminKpis } from '@/hooks/useAdminKpis'
import { Skeleton } from '@/components/ui/Skeleton'
import { getErrorMessage } from '@/lib/errors'

type Tone = 'neutral' | 'primary' | 'warning' | 'destructive'

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
  destructive: 'bg-destructive/10 text-destructive'
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral'
}: {
  label: string
  value: number | string
  hint?: string
  icon: ComponentType<{ className?: string }>
  tone?: Tone
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <span
        className={
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ' +
          TONE_CLASSES[tone]
        }
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-display mt-0.5 text-xl font-bold tracking-tight">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}

export function KpisTab() {
  const { data, isLoading, isError, error } = useAdminKpis()

  if (isError) {
    return (
      <div className="p-4 text-sm text-destructive">
        Impossible de charger les statistiques :{' '}
        {getErrorMessage(error, 'Erreur inconnue')}
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 p-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px]" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 pb-24">
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Communauté
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Utilisateurs" value={data.users_total} icon={Users} />
          <KpiCard
            label="Admins"
            value={data.users_admin}
            icon={ShieldCheck}
            tone="primary"
          />
          <KpiCard
            label="Inscrits 7 derniers j."
            value={data.users_new_7d}
            icon={UserPlus}
            tone="primary"
          />
          <KpiCard
            label="Inscrits 30 derniers j."
            value={data.users_new_30d}
            icon={UserPlus}
          />
          <KpiCard
            label="Utilisateurs bannis"
            value={data.users_banned}
            icon={UserMinus}
            tone={data.users_banned > 0 ? 'destructive' : 'neutral'}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pianos & activité
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Pianos actifs" value={data.pianos_total} icon={Music} />
          <KpiCard
            label="Ajoutés 7j."
            value={data.pianos_new_7d}
            icon={Sparkles}
            tone="primary"
          />
          <KpiCard label="Passages totaux" value={data.visits_total} icon={Footprints} />
          <KpiCard
            label="Sessions récentes"
            value={data.sessions_active}
            icon={Music}
            tone="primary"
            hint="démarrées dans les dernières 24h"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          À traiter
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            label="Signalements ouverts"
            value={data.reports_open}
            icon={Flag}
            tone={data.reports_open > 0 ? 'warning' : 'neutral'}
          />
          <KpiCard
            label="Demandes ouvertes"
            value={data.requests_open}
            icon={Inbox}
            tone={data.requests_open > 0 ? 'warning' : 'neutral'}
          />
        </div>
        {data.reports_open === 0 && data.requests_open === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-center text-xs text-muted-foreground">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            Rien à traiter pour le moment.
          </p>
        )}
      </section>
    </div>
  )
}
