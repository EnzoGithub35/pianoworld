import { describe, expect, it } from 'vitest'
import { photonToResult } from '@/lib/geocoding'

type Props = {
  name?: string
  street?: string
  housenumber?: string
  city?: string
  postcode?: string
  country?: string
  osm_key?: string
  osm_value?: string
}

function feature(props: Props, coords: [number, number] = [-1.6778, 48.1173]) {
  return { geometry: { coordinates: coords }, properties: props }
}

describe('photonToResult — label (comportement existant, verrouillé)', () => {
  it('préfixe le nom du POI quand il diffère de la rue', () => {
    const r = photonToResult(
      feature({
        name: 'Gare de Rennes',
        street: 'Place de la Gare',
        city: 'Rennes',
        postcode: '35000',
        country: 'France'
      })
    )
    expect(r.label).toBe('Gare de Rennes, Place de la Gare, 35000, Rennes, France')
  })

  it("n'ajoute pas le nom en double s'il est identique à la rue", () => {
    const r = photonToResult(
      feature({ name: 'Rue Vasselot', street: 'Rue Vasselot', city: 'Rennes' })
    )
    expect(r.label).toBe('Rue Vasselot, Rennes')
  })
})

describe('photonToResult — extraction de catégorie', () => {
  it('résout un tag connu (amenity/university) en label FR', () => {
    const r = photonToResult(
      feature({
        name: 'Université de Rennes 2',
        city: 'Rennes',
        osm_key: 'amenity',
        osm_value: 'university'
      })
    )
    expect(r.category).toBe('Université')
  })

  it('distingue deux homonymes "E. Leclerc" par leur catégorie (cas diagnostiqué)', () => {
    const supermarche = photonToResult(
      feature({
        name: 'E. Leclerc',
        city: 'Saint-Grégoire',
        osm_key: 'shop',
        osm_value: 'supermarket'
      })
    )
    const stationService = photonToResult(
      feature({
        name: 'E. Leclerc',
        city: 'Saint-Grégoire',
        osm_key: 'amenity',
        osm_value: 'fuel'
      })
    )
    expect(supermarche.label).toBe(stationService.label) // même label → ambigu sans catégorie
    expect(supermarche.category).toBe('Supermarché')
    expect(stationService.category).toBe('Station-service')
  })

  it('normalise shop=gas et amenity=fuel sur le même label FR', () => {
    const a = photonToResult(feature({ name: 'X', osm_key: 'shop', osm_value: 'gas' }))
    const b = photonToResult(
      feature({ name: 'X', osm_key: 'amenity', osm_value: 'fuel' })
    )
    expect(a.category).toBe('Station-service')
    expect(b.category).toBe('Station-service')
  })

  it('humanise un osm_value inconnu en fallback (absent du dictionnaire)', () => {
    const r = photonToResult(
      feature({ name: 'Un lieu', osm_key: 'amenity', osm_value: 'some_new_tag' })
    )
    expect(r.category).toBe('Some new tag')
  })

  it('ignore les valeurs génériques (yes/no) et les clés de voirie (highway)', () => {
    expect(
      photonToResult(feature({ name: 'X', osm_key: 'building', osm_value: 'yes' }))
        .category
    ).toBeUndefined()
    expect(
      photonToResult(feature({ name: 'X', osm_key: 'highway', osm_value: 'residential' }))
        .category
    ).toBeUndefined()
  })

  it("n'a pas de catégorie pour une adresse pure (pas de osm_key/value)", () => {
    const r = photonToResult(
      feature({ street: 'Rue de la Monnaie', city: 'Rennes', postcode: '35000' })
    )
    expect(r.category).toBeUndefined()
  })
})
