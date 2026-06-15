import { useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { Link } from 'react-router-dom'
import { Filter as FilterIcon, Music } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { useTheme } from '@/contexts/ThemeContext'
import { usePianos, type PianoWithAuthor } from '@/hooks/usePianos'
import { usePianoActiveCounts } from '@/hooks/usePianoPresence'
import { createPianoIcon } from './PianoMarker'
import { QualityBadge } from '@/components/Piano/QualityBadge'
import { LocateMeButton } from './LocateMeButton'
import { MapFilters, DEFAULT_FILTERS, type MapFiltersValue } from './MapFilters'
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '@/lib/constants'

// Light + Dark : tuiles servies par CartoDB (CDN robuste, cohérent entre
// les deux thèmes, hot-cached via cartocdn.com qu'on whitelist déjà en CSP).
// On a tenté `tile.openstreetmap.org` mais sa fragilité (rate-limit + CDN
// régional inégal) causait un fond gris en preview Vercel.
const LIGHT_TILES = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
}
const DARK_TILES = {
  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
}

/**
 * Tuile placeholder transparente 1x1 (data URI). Affichée à la place d'un
 * carré gris vide quand une tuile fail à charger. Le DevTools Network reste
 * la source de vérité pour debug. Cf. PianoMap TileLayer ci-dessous.
 */
const ERROR_TILE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

function PianoPopup({
  piano,
  activeCount
}: {
  piano: PianoWithAuthor
  activeCount: number
}) {
  return (
    <div className="min-w-[200px] space-y-2">
      {piano.photo_url && (
        <img
          src={piano.photo_url}
          alt="piano"
          className="h-32 w-full rounded object-cover"
          loading="lazy"
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{piano.address}</p>
        <QualityBadge quality={piano.quality} />
      </div>
      <p className="text-sm">{piano.comment}</p>
      {activeCount > 0 && (
        <Link
          to={`/piano/${piano.id}#sessions`}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20"
        >
          <Music className="h-3 w-3" />
          {activeCount} session{activeCount > 1 ? 's' : ''} en cours
        </Link>
      )}
      <p className="text-xs text-muted-foreground">
        Ajouté par{' '}
        {piano.author?.pseudo ? (
          <Link to={`/user/${piano.author.pseudo}`} className="font-medium text-primary">
            @{piano.author.pseudo}
          </Link>
        ) : (
          'utilisateur supprimé'
        )}
      </p>
      <Link
        to={`/piano/${piano.id}`}
        className="block rounded bg-primary px-3 py-1.5 text-center text-xs font-medium text-primary-foreground"
      >
        Voir le détail
      </Link>
    </div>
  )
}

function applyFilters(
  pianos: PianoWithAuthor[],
  filters: MapFiltersValue
): PianoWithAuthor[] {
  const sinceMs = (() => {
    if (filters.since === 'all') return 0
    const days = filters.since === '7d' ? 7 : filters.since === '30d' ? 30 : 90
    return Date.now() - days * 86_400_000
  })()
  return pianos.filter((p) => {
    if (!filters.qualities.includes(p.quality)) return false
    if (filters.stillThere === 'present' && !p.still_there) return false
    if (filters.stillThere === 'gone' && p.still_there) return false
    if (sinceMs > 0 && new Date(p.created_at).getTime() < sinceMs) return false
    return true
  })
}

export function PianoMap() {
  const { theme } = useTheme()
  const { data: pianos } = usePianos()
  const [filters, setFilters] = useState<MapFiltersValue>(DEFAULT_FILTERS)
  const tiles = theme === 'dark' ? DARK_TILES : LIGHT_TILES

  const filtered = useMemo(
    () => (pianos ? applyFilters(pianos, filters) : []),
    [pianos, filters]
  )

  // Batch RPC v6 : 1 query/30s pour tous les pianos visibles. Remplace l'ancien
  // useActivePianoIds (qui faisait un SELECT direct sur piano_sessions, lequel
  // est maintenant filtré par RLS visibility-aware → leaks count vs anon).
  // get_active_piano_counts bypass la RLS via SECURITY DEFINER mais applique
  // le MÊME filtre visibility côté SQL → pas de delta cardinalité.
  const pianoIds = useMemo(() => filtered.map((p) => p.id), [filtered])
  const { data: countsMap } = usePianoActiveCounts(pianoIds)

  const markers = useMemo(
    () =>
      filtered.map((p) => {
        const activeCount = countsMap?.get(p.id) ?? 0
        const isActive = activeCount > 0
        // La key inclut tout ce qui modifie le rendu visuel du divIcon
        // (quality → couleur de bordure, photo_url → fond image vs icône).
        // Sans ça, après edit d'un piano, react-leaflet réutilise le même
        // Marker et n'appelle pas Leaflet.setIcon de manière fiable —
        // la vignette reste à l'ancienne couleur. Re-mount forcé via key.
        return (
          <Marker
            key={`${p.id}-${p.quality}-${p.photo_url ?? 'no-photo'}-${isActive ? 'a' : 'i'}`}
            position={[p.lat, p.lng]}
            icon={createPianoIcon({
              photoUrl: p.photo_url,
              quality: p.quality,
              active: isActive
            })}
            opacity={p.still_there ? 1 : 0.5}
          >
            <Popup>
              <PianoPopup piano={p} activeCount={activeCount} />
            </Popup>
          </Marker>
        )
      }),
    [filtered, countsMap]
  )

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={DEFAULT_MAP_CENTER as [number, number]}
        zoom={DEFAULT_MAP_ZOOM}
        scrollWheelZoom
        zoomControl={false}
        className="h-full w-full"
      >
        <TileLayer
          key={theme}
          url={tiles.url}
          attribution={tiles.attribution}
          maxZoom={19}
          errorTileUrl={ERROR_TILE}
        />
        <MarkerClusterGroup chunkedLoading showCoverageOnHover={false}>
          {markers}
        </MarkerClusterGroup>
        <LocateMeButton />
      </MapContainer>
      <MapFilters value={filters} onChange={setFilters} />

      {pianos && pianos.length > 0 && filtered.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[400] flex justify-center px-4">
          <div className="animate-fade-in pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-background/95 px-4 py-2 text-xs shadow-md backdrop-blur">
            <FilterIcon className="h-3.5 w-3.5 text-primary" />
            <span>Aucun piano ne correspond aux filtres</span>
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="font-medium text-primary hover:underline"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
