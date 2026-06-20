import { cn } from '@/lib/utils'

/**
 * Avatar généré : initiale du pseudo + fond coloré déterministe.
 *
 * La teinte est dérivée d'un hash du pseudo → même pseudo = même couleur,
 * cross-pages. Pas besoin de stocker quoi que ce soit en DB.
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

function hueFromPseudo(pseudo: string): number {
  // FNV-1a 32 bits modulo 360 → teinte HSL déterministe et bien répartie
  let hash = 2166136261
  for (let i = 0; i < pseudo.length; i++) {
    hash ^= pseudo.charCodeAt(i)
    hash = (hash * 16777619) >>> 0
  }
  return hash % 360
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
  const hue = hueFromPseudo(label.toLowerCase())
  return (
    <span
      aria-hidden="true"
      className={cn(
        'font-display inline-flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white',
        SIZE_CLASSES[size],
        ring && 'ring-2 ring-background',
        className
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(${hue} 60% 42%), hsl(${(hue + 30) % 360} 60% 32%))`
      }}
    >
      {initial}
    </span>
  )
}
