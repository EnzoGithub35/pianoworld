import { describe, expect, it } from 'vitest'
import { fromNow, formatDate, formatDateTime } from '@/lib/date'

describe('fromNow', () => {
  it('renvoie une string courte non vide pour une date proche', () => {
    const result = fromNow(new Date(Date.now() - 30_000))
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('contient un mot caractéristique du FR pour le passé', () => {
    const result = fromNow(new Date(Date.now() - 5 * 60 * 1000))
    expect(result.toLowerCase()).toMatch(/^il y a \d+ minutes?$/)
  })

  it('contient un mot caractéristique du FR pour le futur', () => {
    const result = fromNow(new Date(Date.now() + 5 * 60 * 1000))
    expect(result.toLowerCase()).toMatch(/^dans \d+ minutes?$/)
  })
})

describe('formatDate', () => {
  it('formate une date ISO en `D MMM YYYY`', () => {
    const result = formatDate('2026-05-30T12:00:00Z')
    expect(result).toBe('30 mai 2026')
  })
})

describe('formatDateTime', () => {
  it('inclut HH:mm', () => {
    const result = formatDateTime('2026-05-30T14:30:00')
    expect(result).toMatch(/14:30|15:30|13:30/) // tolère TZ shift
  })
})
