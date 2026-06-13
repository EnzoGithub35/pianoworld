import { describe, expect, it } from 'vitest'
import { pushSupported } from '@/lib/web-push'

describe('pushSupported', () => {
  it('renvoie false en environnement jsdom (pas de PushManager)', () => {
    // jsdom n'expose ni PushManager ni Notification → support négatif attendu.
    // Si on lance en navigateur réel, on s'attend à `true`.
    expect(pushSupported()).toBe(false)
  })
})
