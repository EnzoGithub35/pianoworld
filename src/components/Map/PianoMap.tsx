import { useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { Link } from 'react-router-dom'
import { Filter as FilterIcon } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { useTheme } from '@/contexts/ThemeContext'
import { usePianos, type PianoWithAuthor } from '@/hooks/usePianos'
import { useActivePianoIds } from '@/hooks/usePianoSessions'
import { createPianoIcon } from './PianoMarker'
import { QualityBadge } from '@/components/Piano/QualityBadge'
import { LocateMeButton } from './LocateMeButton'
import { MapFilters, DEFAULT_FILTERS, type MapFiltersValue } from './MapFilters'
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '@/lib/constants'

const LIGHT_TILES = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}
const DARK_TILES = {
  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
}

function PianoPopup({ piano }: { piano: PianoWithAuthor }) {
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
  const { data: activeIds } = useActivePianoIds()
  const [filters, setFilters] = useState<MapFiltersValue>(DEFAULT_FILTERS)
  const tiles = theme === 'dark' ? DARK_TILES : LIGHT_TILES

  const filtered = useMemo(
    () => (pianos ? applyFilters(pianos, filters) : []),
    [pianos, filters]
  )

  const markers = useMemo(
    () =>
      filtered.map((p) => {
        const isActive = activeIds?.has(p.id) ?? false
        return (
          <Marker
            key={`${p.id}-${isActive ? 'a' : 'i'}`}
            position={[p.lat, p.lng]}
            icon={createPianoIcon({
              photoUrl: p.photo_url,
              quality: p.quality,
              active: isActive
            })}
            opacity={p.still_there ? 1 : 0.5}
          >
            <Popup>
              <PianoPopup piano={p} />
            </Popup>
          </Marker>
        )
      }),
    [filtered, activeIds]
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
        <TileLayer key={theme} url={tiles.url} attribution={tiles.attribution} maxZoom={19} />
        <MarkerClusterGroup chunkedLoading showCoverageOnHover={false}>
          {markers}
        </MarkerClusterGroup>
        <LocateMeButton />
      </MapContainer>
      <MapFilters value={filters} onChange={setFilters} />

      {pianos && pianos.length > 0 && filtered.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[400] flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-background/95 px-4 py-2 text-xs shadow-md backdrop-blur animate-fade-in">
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
