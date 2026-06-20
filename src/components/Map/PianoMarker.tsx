import L from 'leaflet'
import { type PianoQuality } from '@/types/database'

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/**
 * Icône piano SVG inline : 3 touches blanches + 2 noires, lisible jusqu'au zoom
 * du marker (32x32). Le `currentColor` permet d'hériter la teinte du parent
 * `.pm-icon` (CSS color: var(--pm)).
 */
const PIANO_KEYS_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="h-4 w-4">
    <rect x="3" y="6" width="18" height="12" rx="1.5" fill="#fff" stroke="currentColor" stroke-width="1.5"/>
    <line x1="9" y1="6" x2="9" y2="18" stroke="currentColor" stroke-width="1"/>
    <line x1="15" y1="6" x2="15" y2="18" stroke="currentColor" stroke-width="1"/>
    <rect x="7" y="6" width="2.5" height="6" fill="currentColor"/>
    <rect x="14.5" y="6" width="2.5" height="6" fill="currentColor"/>
  </svg>
`

/**
 * Crée un divIcon Leaflet pour un piano.
 * - Si photo : carré 40x40 photo avec bordure colorée selon qualité
 * - Sinon    : carré 40x40 fond crème + icône piano teintée par la qualité
 * Une petite "queue" en bas du marker (triangle) donne le sens "ancré sur le sol".
 *
 * Sprint 12 A.5 CSP — Les couleurs dynamiques sont appliquées via la classe
 * `.pm-<quality>` qui définit `--pm` (custom property), puis les enfants
 * `.pm-border`, `.pm-icon`, `.pm-tri` utilisent `var(--pm)` via stylesheet.
 * Plus de `style="..."` inline → compatible CSP `style-src 'self'`.
 */
export function createPianoIcon({
  photoUrl,
  quality,
  active = false
}: {
  photoUrl: string | null
  quality: PianoQuality
  /** Affiche un pulse autour du marker (cf. .pulse-ring dans index.css). */
  active?: boolean
}): L.DivIcon {
  const inner = photoUrl
    ? `<img src="${escapeAttr(photoUrl)}" alt="piano" class="h-full w-full object-cover" loading="lazy" />`
    : `<div class="pm-icon flex h-full w-full items-center justify-center">${PIANO_KEYS_SVG}</div>`
  const pulse = active ? '<div class="pulse-ring"></div>' : ''
  // Pas de transform CSS sur le wrapper : Leaflet positionne le DIV racine
  // selon iconAnchor (cf. L.divIcon ci-dessous).
  const html = `
    <div class="pm-${quality} relative">
      ${pulse}
      <div class="pm-border h-10 w-10 overflow-hidden rounded-lg border-2 bg-white shadow-lg">
        ${inner}
      </div>
      <div class="pm-tri absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 -translate-y-[2px] border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent"></div>
    </div>
  `
  return L.divIcon({
    className: 'piano-marker',
    html,
    iconSize: [40, 48],
    iconAnchor: [20, 48],
    popupAnchor: [0, -48]
  })
}
