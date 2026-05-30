import { describe, expect, it } from 'vitest'
import {
  getErrorMessage,
  isPostgrestError,
  isUniqueViolation,
  isPermissionDenied,
  isRateLimitError,
  isInvalidPassword
} from '@/lib/errors'

describe('getErrorMessage', () => {
  it("extrait .message d'une Error JS", () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom')
  })

  it('retourne la string brute si on lui passe une string', () => {
    expect(getErrorMessage('hello', 'fallback')).toBe('hello')
  })

  it("extrait .message d'un objet PostgrestError-like", () => {
    expect(
      getErrorMessage({ code: '23505', message: 'duplicate key' }, 'fallback')
    ).toContain('duplicate')
  })

  it('retombe sur le fallback pour null', () => {
    expect(getErrorMessage(null, 'fallback')).toBe('fallback')
  })

  it('retombe sur le fallback pour undefined', () => {
    expect(getErrorMessage(undefined, 'Erreur')).toBe('Erreur')
  })

  it('retombe sur le fallback pour string vide', () => {
    expect(getErrorMessage('', 'fallback')).toBe('fallback')
  })

  it('retombe sur le fallback pour Error sans message', () => {
    expect(getErrorMessage(new Error(''), 'fallback')).toBe('fallback')
  })
})

describe('isPostgrestError', () => {
  it('détecte un objet avec message + code', () => {
    expect(isPostgrestError({ message: 'x', code: '23505' })).toBe(true)
  })
  it('refuse une Error JS classique', () => {
    expect(isPostgrestError(new Error('x'))).toBe(false)
  })
  it('refuse null', () => {
    expect(isPostgrestError(null)).toBe(false)
  })
  it('refuse un objet sans code', () => {
    expect(isPostgrestError({ message: 'x' })).toBe(false)
  })
})

describe('isUniqueViolation', () => {
  it('détecte le code 23505', () => {
    expect(isUniqueViolation({ message: 'x', code: '23505' })).toBe(true)
  })
  it('rejette les autres codes', () => {
    expect(isUniqueViolation({ message: 'x', code: '42501' })).toBe(false)
  })
})

describe('isPermissionDenied', () => {
  it('détecte 42501', () => {
    expect(isPermissionDenied({ message: 'x', code: '42501' })).toBe(true)
  })
  it('détecte PGRST301', () => {
    expect(isPermissionDenied({ message: 'x', code: 'PGRST301' })).toBe(true)
  })
})

describe('isRateLimitError', () => {
  it('détecte rate_limit_exceeded sur code P0001', () => {
    expect(isRateLimitError({ code: 'P0001', message: 'rate_limit_exceeded' })).toBe(true)
  })
  it('ne détecte pas P0001 sans le marqueur', () => {
    expect(isRateLimitError({ code: 'P0001', message: 'autre erreur' })).toBe(false)
  })
  it('ne détecte pas un autre code', () => {
    expect(isRateLimitError({ code: '23505', message: 'rate_limit_exceeded' })).toBe(
      false
    )
  })
})

describe('isInvalidPassword', () => {
  it('détecte le marqueur invalid_password', () => {
    expect(isInvalidPassword({ code: 'P0001', message: 'invalid_password' })).toBe(true)
  })
  it('refuse les autres messages', () => {
    expect(isInvalidPassword({ code: 'P0001', message: 'forbidden' })).toBe(false)
  })
})
