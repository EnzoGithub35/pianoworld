import { useState } from 'react'
import { ChevronDown, ChevronUp, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PIANO_QUALITIES,
  QUALITY_COLORS,
  QUALITY_LABELS,
  type PianoQuality
} from '@/types/database'

export type MapFiltersValue = {
  qualities: PianoQuality[]
  stillThere: 'all' | 'present' | 'gone'
  since: 'all' | '7d' | '30d' | '90d'
}

export const DEFAULT_FILTERS: MapFiltersValue = {
  qualities: [...PIANO_QUALITIES],
  stillThere: 'all',
  since: 'all'
}

export function MapFilters({
  value,
  onChange
}: {
  value: MapFiltersValue
  onChange: (next: MapFiltersValue) => void
}) {
  const [open, setOpen] = useState(false)

  const toggleQuality = (q: PianoQuality) => {
    onChange({
      ...value,
      qualities: value.qualities.includes(q)
        ? value.qualities.filter((x) => x !== q)
        : [...value.qualities, q]
    })
  }

  const isActive =
    value.qualities.length !== PIANO_QUALITIES.length ||
    value.stillThere !== 'all' ||
    value.since !== 'all'

  return (
    <div className="absolute left-3 top-3 z-[400] max-w-[calc(100%-1.5rem)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={isActive ? 'Filtres (actifs)' : 'Filtres'}
        className={cn(
          'flex items-center gap-1.5 rounded-full bg-background px-3 py-2 text-xs font-medium shadow-md ring-1 ring-border hover:bg-accent',
          isActive && 'ring-2 ring-primary'
        )}
      >
        <Filter aria-hidden="true" className="h-4 w-4" /> Filtres
        {open ? (
          <ChevronUp aria-hidden="true" className="h-3 w-3" />
        ) : (
          <ChevronDown aria-hidden="true" className="h-3 w-3" />
        )}
      </button>

      {open && (
        <div className="mt-2 w-72 max-w-full space-y-3 rounded-lg border border-border bg-background p-3 shadow-md">
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Qualité</p>
            <div className="flex flex-wrap gap-1.5">
              {PIANO_QUALITIES.map((q) => {
                const checked = value.qualities.includes(q)
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => toggleQuality(q)}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-xs',
                      checked
                        ? 'border-transparent text-white'
                        : 'border-border bg-background text-muted-foreground'
                    )}
                    style={checked ? { backgroundColor: QUALITY_COLORS[q] } : undefined}
                  >
                    {QUALITY_LABELS[q]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">Présence</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { v: 'all', label: 'Tous' },
                  { v: 'present', label: 'Encore là' },
                  { v: 'gone', label: 'Disparus' }
                ] as const
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => onChange({ ...value, stillThere: opt.v })}
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs',
                    value.stillThere === opt.v
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">Date d'ajout</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  { v: 'all', label: 'Tous' },
                  { v: '7d', label: '7j' },
                  { v: '30d', label: '30j' },
                  { v: '90d', label: '90j' }
                ] as const
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => onChange({ ...value, since: opt.v })}
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs',
                    value.since === opt.v
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {isActive && (
            <button
              type="button"
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="text-xs text-primary"
            >
              Réinitialiser
            </button>
          )}
        </div>
      )}
    </div>
  )
}
