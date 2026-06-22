import { cn } from '@/lib/utils'

/**
 * Avatar généré : initiale du pseudo + fond gradient déterministe.
 *
 * La teinte est dérivée d'un hash du pseudo, **bucketée en 12 hues** (toutes
 * les 30°) → même pseudo = même couleur, cross-pages. 12 buckets = bon
 * compromis entre diversité visuelle et set fini de classes CSS (requis
 * pour Sprint 12 A.5 CSP : permet de retirer `'unsafe-inline'` style-src).
 *
 * Les 12 classes `.avatar-hN` sont définies dans src/index.css.
 *
 * Tailles : "xs" (24), "sm" (32), "md" (40), "lg" (56), "xl" (64).
 */

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-16 w-16 text-2xl'
}

/** 12 buckets de teinte espacés de 30°. Index = floor(hue / 30). */
const HUE_BUCKETS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as const

function hueBucketFromPseudo(pseudo: string): number {
  // FNV-1a 32 bits modulo 12 → bucket index déterministe, bien réparti.
  let hash = 2166136261
  for (let i = 0; i < pseudo.length; i++) {
    hash ^= pseudo.charCodeAt(i)
    hash = (hash * 16777619) >>> 0
  }
  return HUE_BUCKETS[hash % HUE_BUCKETS.length]
}

export function Avatar({
  pseudo,
  size = 'md',
  className,
  ring = false
}: {
  pseudo: string | null | undefined
  size?: AvatarSize
  className?: string
  /** Petite bordure blanche autour, utile pour les stacks empilés. */
  ring?: boolean
}) {
  const label = pseudo?.trim() || '?'
  const initial = label.charAt(0).toUpperCase()
  const hue = hueBucketFromPseudo(label.toLowerCase())
  return (
    <span
      aria-hidden="true"
      className={cn(
        'font-display inline-flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white',
        SIZE_CLASSES[size],
        `avatar-h${hue}`,
        ring && 'ring-2 ring-background',
        className
      )}
    >
      {initial}
    </span>
  )
}
