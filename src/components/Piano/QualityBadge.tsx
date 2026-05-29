import { QUALITY_COLORS, QUALITY_LABELS, type PianoQuality } from '@/types/database'

export function QualityBadge({ quality }: { quality: PianoQuality }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: QUALITY_COLORS[quality] }}
    >
      {QUALITY_LABELS[quality]}
    </span>
  )
}
