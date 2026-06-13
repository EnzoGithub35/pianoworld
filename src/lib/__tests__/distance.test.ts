import { describe, expect, it } from 'vitest'
import { haversineMeters } from '@/lib/distance'

const RENNES = { lat: 48.1173, lng: -1.6778 }
const PARIS = { lat: 48.8566, lng: 2.3522 }

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters(RENNES, RENNES)).toBe(0)
  })

  it('is commutative (A→B === B→A)', () => {
    const d1 = haversineMeters(RENNES, PARIS)
    const d2 = haversineMeters(PARIS, RENNES)
    expect(d1).toBeCloseTo(d2, 5)
  })

  it('Rennes ↔ Paris ≈ 308 km (±3 km)', () => {
    const d = haversineMeters(RENNES, PARIS)
    expect(d).toBeGreaterThan(305_000)
    expect(d).toBeLessThan(311_000)
  })

  it('antipodes (0,0) ↔ (0,180) ≈ 20 015 km', () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })
    expect(d).toBeCloseTo(20_015_086, -3)
  })

  it('two close points (10m) → distance < 15m', () => {
    const a = { lat: 48.1, lng: -1.6 }
    const b = { lat: 48.1, lng: -1.6001 } // ~7-8m to east
    const d = haversineMeters(a, b)
    expect(d).toBeLessThan(15)
    expect(d).toBeGreaterThan(0)
  })
})
