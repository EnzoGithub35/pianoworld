import { logger } from '@/lib/logger'
import {
  DEFAULT_MAP_CENTER,
  GEOCODE_AUTOCOMPLETE_LIMIT,
  GEOCODE_MIN_QUERY_LENGTH
} from '@/lib/constants'

/**
 * Wrapper minimal pour deux APIs OSM gratuites :
 *  - Photon (komoot) pour l'autocomplete (pas de rate-limit strict)
 *  - Nominatim pour le reverse-geocode (1 req/sec donc on le réserve à l'ajout)
 */

export type GeocodeResult = {
  lat: number
  lng: number
  label: string
  /** Catégorie FR lisible ("Université", "Supermarché"…). Absente si
   *  résultat = adresse pure ou tag OSM non reconnu/trop générique. */
  category?: string
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
    osm_key?: string
    osm_value?: string
  }
}

/**
 * Traduction FR des tags OSM les plus utiles pour repérer où poser un piano.
 * Couverture volontairement NON exhaustive (Photon indexe des milliers de
 * osm_value différents) — seulement les catégories plausibles ici.
 * Clé composite `osm_key:osm_value` : un même osm_value peut avoir un sens
 * différent selon la clé (shop=gas ET amenity=fuel = station-service —
 * cas réel observé sur "Leclerc Saint-Grégoire").
 */
const OSM_CATEGORY_LABELS: Record<string, string> = {
  'amenity:university': 'Université',
  'amenity:college': 'Établissement scolaire',
  'amenity:school': 'École',
  'amenity:kindergarten': 'Crèche / maternelle',
  'amenity:library': 'Bibliothèque',
  'amenity:music_school': 'École de musique',
  'shop:supermarket': 'Supermarché',
  'shop:convenience': 'Supérette',
  'shop:mall': 'Centre commercial',
  'shop:department_store': 'Grand magasin',
  'shop:bakery': 'Boulangerie',
  'shop:gas': 'Station-service',
  'amenity:marketplace': 'Marché',
  'amenity:fuel': 'Station-service',
  'railway:station': 'Gare',
  'railway:halt': 'Gare',
  'aeroway:aerodrome': 'Aéroport',
  'amenity:bus_station': 'Gare routière',
  'amenity:ferry_terminal': 'Gare maritime',
  'amenity:townhall': 'Mairie',
  'office:government': 'Administration',
  'amenity:post_office': 'Bureau de poste',
  'amenity:courthouse': 'Palais de justice',
  'amenity:police': 'Commissariat',
  'amenity:hospital': 'Hôpital',
  'amenity:clinic': 'Clinique',
  'amenity:pharmacy': 'Pharmacie',
  'amenity:bank': 'Banque',
  'amenity:parcel_locker': 'Point relais',
  'amenity:cafe': 'Café',
  'amenity:bar': 'Bar',
  'amenity:restaurant': 'Restaurant',
  'amenity:fast_food': 'Restauration rapide',
  'amenity:theatre': 'Théâtre',
  'amenity:arts_centre': 'Centre culturel',
  'amenity:cinema': 'Cinéma',
  'tourism:museum': 'Musée',
  'tourism:hotel': 'Hôtel',
  'tourism:attraction': 'Site touristique',
  'leisure:park': 'Parc',
  'amenity:community_centre': 'Centre social',
  'amenity:place_of_worship': 'Lieu de culte',
  'place:city': 'Ville',
  'place:town': 'Ville',
  'place:village': 'Village',
  'place:hamlet': 'Hameau',
  'place:suburb': 'Quartier',
  'place:neighbourhood': 'Quartier'
}

/** Clés OSM dont toutes les valeurs sont du bruit ici (classification
 *  routière — jamais une "catégorie de lieu" utile). */
const IGNORED_OSM_KEYS = new Set(['highway'])
/** Valeurs génériques, peu importe la clé — n'apportent aucune info. */
const IGNORED_OSM_VALUES = new Set(['yes', 'no', 'unclassified'])

/** Résout un label catégorie FR à partir des tags OSM Photon.
 *  Fallback en 2 temps : dictionnaire connu → valeur brute humanisée
 *  ("music_school" → "Music school") → undefined si bruit/absent.
 *  N'importe quel texte vaut mieux que rien pour distinguer des homonymes
 *  (cas "5 Leclerc"), donc on ne masque QUE le bruit avéré. */
function resolveCategoryLabel(osmKey?: string, osmValue?: string): string | undefined {
  if (!osmKey || !osmValue) return undefined
  const known = OSM_CATEGORY_LABELS[`${osmKey}:${osmValue}`]
  if (known) return known
  if (IGNORED_OSM_KEYS.has(osmKey) || IGNORED_OSM_VALUES.has(osmValue)) return undefined
  const humanized = osmValue.replace(/_/g, ' ')
  return humanized.charAt(0).toUpperCase() + humanized.slice(1)
}

export function photonToResult(f: PhotonFeature): GeocodeResult {
  const [lng, lat] = f.geometry.coordinates
  const p = f.properties
  const street = [p.housenumber, p.street].filter(Boolean).join(' ')
  // Sprint UX : préfixer par le nom du POI (Gare de Rennes, Cathédrale, etc.)
  // dès qu'il existe ET diffère de l'adresse — rend les lieux nommés
  // immédiatement reconnaissables dans le dropdown autocomplete.
  const parts = [
    p.name && p.name !== street ? p.name : null,
    street,
    p.postcode,
    p.city,
    p.country
  ].filter(Boolean) as string[]
  return {
    lat,
    lng,
    label: parts.join(', '),
    category: resolveCategoryLabel(p.osm_key, p.osm_value)
  }
}

/** Autocomplete d'adresse, retourne [] si la query est trop courte.
 *
 *  Biais géographique doux vers `options.bias` si fourni (position réelle
 *  de l'utilisateur, résolue silencieusement au montage d'AddPianoFlow),
 *  sinon vers DEFAULT_MAP_CENTER (Rennes) — important pour qu'un user à
 *  Lyon qui tape "Gare" voie d'abord la gare la plus proche de chez lui.
 *  Le biais reste doux (location_bias_scale=0.2) : une query sans ambiguïté
 *  (ex. "Tour Eiffel") retourne le bon résultat quel que soit le biais.
 */
export async function searchAddress(
  query: string,
  options?: { limit?: number; bias?: { lat: number; lng: number } }
): Promise<GeocodeResult[]> {
  if (query.trim().length < GEOCODE_MIN_QUERY_LENGTH) return []
  const limit = options?.limit ?? GEOCODE_AUTOCOMPLETE_LIMIT
  const [biasLat, biasLng] = options?.bias
    ? [options.bias.lat, options.bias.lng]
    : DEFAULT_MAP_CENTER
  const url =
    `${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=${limit}&lang=fr` +
    `&lat=${biasLat}&lon=${biasLng}&location_bias_scale=0.2`
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
      logger.warn('geocoding.reverse', 'nominatim non-OK', {
        status: res.status,
        lat,
        lng
      })
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
