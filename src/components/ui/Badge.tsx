import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Petit pavé pour compteurs numériques ou statuts courts.
 * Variants alignés avec les couleurs sémantiques du design system.
 */

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'outline'

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary text-primary-foreground',
  success: 'bg-green-600 text-white dark:bg-green-500 dark:text-green-950',
  warning: 'bg-amber-500 text-white',
  destructive: 'bg-destructive text-destructive-foreground',
  outline: 'border border-border text-foreground'
}

export function Badge({
  children,
  variant = 'default',
  className
}: {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none',
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
