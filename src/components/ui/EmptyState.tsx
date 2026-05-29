import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Empty state cohérent pour les listes vides (recherche, feed, profil sans piano…).
 * - icon : composant Lucide ou SVG inline
 * - title / description : texte
 * - action : bouton ou lien optionnel
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center',
        className
      )}
    >
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}
