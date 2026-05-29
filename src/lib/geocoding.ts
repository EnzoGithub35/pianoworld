import { logger } from '@/lib/logger'
import { GEOCODE_AUTOCOMPLETE_LIMIT } from '@/lib/constants'

/**
 * Wrapper minimal pour deux APIs OSM gratuites :
 *  - Photon (komoot) pour l'autocomplete (pas de rate-limit strict)
 *  - Nominatim pour le reverse-geocode (1 req/sec donc on le réserve à l'ajout)
 */

export type GeocodeResult = {
  lat: number
  lng: number
  label: string
}

const PHOTON_URL = 'https://photon.komoot.io/api'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org'
const USER_AGENT = 'PianoWorld/0.1 (https://pianoworld.app)'

type PhotonFeature = {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    street?: string
    housenumber?: string
    city?: string
    postcode?: string
    country?: string
  }
}

function photonToResult(f: PhotonFeature): GeocodeResult {
  const [lng, lat] = f.geometry.coordinates
  const p = f.properties
  const parts = [
    [p.housenumber, p.street].filter(Boolean).join(' '),
    p.name && !p.street ? p.name : null,
    p.postcode,
    p.city,
    p.country
  ].filter(Boolean) as string[]
  return { lat, lng, label: parts.join(', ') }
}

/** Autocomplete d'adresse, retourne [] si la query est trop courte. */
export async function searchAddress(
  query: string,
  limit = GEOCODE_AUTOCOMPLETE_LIMIT
): Promise<GeocodeResult[]> {
  if (query.trim().length < 3) return []
  const url = `${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=${limit}&lang=fr`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      logger.warn('geocoding.search', 'photon non-OK', { status: res.status, query })
      throw new Error(`Recherche d'adresse échouée (${res.status})`)
    }
    const json = (await res.json()) as { features?: PhotonFeature[] }
    return (json.features ?? []).map(photonToResult)
  } catch (err) {
    logger.error('geocoding.search', 'photon request failed', err, { query })
    throw err
  }
}

/** Reverse-geocode lat/lng → adresse FR. Fallback string de coordonnées si Nominatim down. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  const url = `${NOMINATIM_URL}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=fr`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) {
      logger.warn('geocoding.reverse', 'nominatim non-OK', { status: res.status, lat, lng })
      return fallback
    }
    const json = (await res.json()) as { display_name?: string }
    return json.display_name ?? fallback
  } catch (err) {
    logger.warn('geocoding.reverse', 'nominatim failed, using fallback', {
      message: err instanceof Error ? err.message : String(err)
    })
    return fallback
  }
}
