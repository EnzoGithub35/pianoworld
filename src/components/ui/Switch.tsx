import { cn } from '@/lib/utils'

/**
 * Toggle switch accessible (role="switch"). Composant non contrôlé techniquement
 * — c'est l'appelant qui gère l'état. Optimistic updates côté hook.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  description,
  id
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  disabled?: boolean
  label: string
  description?: string
  id?: string
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left last:border-b-0',
        disabled ? 'opacity-60' : 'cursor-pointer hover:bg-accent'
      )}
    >
      <div className="flex-1 space-y-0.5">
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <div className="text-[11px] leading-tight text-muted-foreground">
            {description}
          </div>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'mt-0.5 inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </button>
    </label>
  )
}
