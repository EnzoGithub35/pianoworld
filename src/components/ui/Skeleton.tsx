import { cn } from '@/lib/utils'

/** Bloc gris animé (shimmer) pour les états de chargement. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}
