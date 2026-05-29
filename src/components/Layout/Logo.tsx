import { cn } from '@/lib/utils'

/**
 * Logo PianoWorld : un piano stylisé dans un cercle ambre.
 * Taille contrôlée par les classes Tailwind (h-x w-x).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg',
        className
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        fill="none"
        className="h-1/2 w-1/2"
        aria-hidden="true"
      >
        <rect x="4" y="9" width="24" height="16" rx="2" fill="currentColor" opacity="0.15" />
        <rect
          x="4"
          y="9"
          width="24"
          height="16"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="white"
        />
        <line x1="11" y1="9" x2="11" y2="25" stroke="currentColor" strokeWidth="1.4" />
        <line x1="21" y1="9" x2="21" y2="25" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9" y="9" width="3" height="8" fill="currentColor" />
        <rect x="20" y="9" width="3" height="8" fill="currentColor" />
        <rect x="14.5" y="9" width="3" height="8" fill="currentColor" />
      </svg>
    </div>
  )
}
