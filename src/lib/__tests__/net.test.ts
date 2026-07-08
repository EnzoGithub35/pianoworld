import { describe, expect, it, vi } from 'vitest'
import { sleep, withRetry } from '@/lib/net'

describe('sleep', () => {
  it('résout après ~N ms', async () => {
    const start = Date.now()
    await sleep(30)
    expect(Date.now() - start).toBeGreaterThanOrEqual(25)
  })
})

describe('withRetry', () => {
  it('retourne la valeur au premier succès (pas de retry)', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("retente jusqu'au succès (3 tentatives, 2 échecs)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom-1'))
      .mockRejectedValueOnce(new Error('boom-2'))
      .mockResolvedValueOnce('ok')
    // baseDelayMs très bas pour ne pas ralentir le test
    const result = await withRetry(fn, { baseDelayMs: 5 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('throw la dernière erreur si toutes les tentatives échouent', async () => {
    const err = new Error('permanent')
    const fn = vi.fn().mockRejectedValue(err)
    await expect(withRetry(fn, { baseDelayMs: 5 })).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('respecte shouldRetry (retourne false → throw immédiatement)', async () => {
    const err = new Error('400 bad request')
    const fn = vi.fn().mockRejectedValue(err)
    await expect(
      withRetry(fn, { baseDelayMs: 5, shouldRetry: () => false })
    ).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('appelle onRetry entre chaque tentative avec numéro + delay', async () => {
    const onRetry = vi.fn()
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom-1'))
      .mockResolvedValueOnce('ok')
    await withRetry(fn, { baseDelayMs: 5, onRetry })
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry.mock.calls[0][1]).toBe(1) // attempt=1
    expect(typeof onRetry.mock.calls[0][2]).toBe('number') // delayMs
  })

  it('respecte attempts custom (1 = pas de retry)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(withRetry(fn, { attempts: 1, baseDelayMs: 5 })).rejects.toThrow('boom')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
