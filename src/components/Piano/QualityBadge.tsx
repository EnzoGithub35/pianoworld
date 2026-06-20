import { QUALITY_LABELS, type PianoQuality } from '@/types/database'

/**
 * Sprint 12 A.5 CSP — utilise les classes statiques `quality-<enum>` définies
 * dans src/index.css au lieu d'un `style={{ backgroundColor }}` inline. Permet
 * de retirer `'unsafe-inline'` du CSP style-src. Safelist Tailwind dans
 * tailwind.config.js pour préserver les 6 classes au build.
 */
export function QualityBadge({ quality }: { quality: PianoQuality }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium quality-${quality}`}
    >
      {QUALITY_LABELS[quality]}
    </span>
  )
}
