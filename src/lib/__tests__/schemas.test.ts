import { describe, expect, it } from 'vitest'
import {
  signupSchema,
  loginSchema,
  changePasswordSchema,
  passwordConfirmSchema,
  sessionFormSchema,
  eventFormSchema,
  requestFormSchema,
  replyFormSchema,
  pianoFormSchema
} from '@/lib/schemas'

describe('signupSchema', () => {
  const ok = {
    pseudo: 'enzo35',
    email: 'e@r.fr',
    password: 'longpass1',
    acceptCgu: true as const
  }

  it('accepte un signup valide', () => {
    expect(signupSchema.safeParse(ok).success).toBe(true)
  })

  it('refuse un pseudo avec espace', () => {
    expect(signupSchema.safeParse({ ...ok, pseudo: 'mauvais pseudo' }).success).toBe(
      false
    )
  })

  it('refuse un pseudo trop court', () => {
    expect(signupSchema.safeParse({ ...ok, pseudo: 'a' }).success).toBe(false)
  })

  it('refuse un email invalide', () => {
    expect(signupSchema.safeParse({ ...ok, email: 'pas-un-email' }).success).toBe(false)
  })

  it('refuse un mot de passe < 8 caractères', () => {
    expect(signupSchema.safeParse({ ...ok, password: 'court' }).success).toBe(false)
  })

  it('refuse si acceptCgu est false', () => {
    const r = signupSchema.safeParse({ ...ok, acceptCgu: false })
    expect(r.success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('exige email + password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.fr', password: 'x' }).success).toBe(true)
    expect(loginSchema.safeParse({ email: 'a@b.fr', password: '' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: '', password: 'x' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'pas-un-email', password: 'x' }).success).toBe(
      false
    )
  })
})

describe('changePasswordSchema', () => {
  it('accepte un changement valide', () => {
    expect(
      changePasswordSchema.safeParse({
        current: 'old12345',
        next: 'new12345',
        confirm: 'new12345'
      }).success
    ).toBe(true)
  })

  it('refuse si confirm ne match pas next', () => {
    expect(
      changePasswordSchema.safeParse({
        current: 'old12345',
        next: 'new12345',
        confirm: 'autre'
      }).success
    ).toBe(false)
  })

  it('refuse si current === next', () => {
    expect(
      changePasswordSchema.safeParse({
        current: 'same12345',
        next: 'same12345',
        confirm: 'same12345'
      }).success
    ).toBe(false)
  })
})

describe('passwordConfirmSchema', () => {
  it('refuse un password vide', () => {
    expect(passwordConfirmSchema.safeParse({ password: '' }).success).toBe(false)
  })
  it('accepte tout password non vide', () => {
    expect(passwordConfirmSchema.safeParse({ password: 'x' }).success).toBe(true)
  })
})

describe('sessionFormSchema', () => {
  it('refuse une date dans le passé lointain (> 1h)', () => {
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000)
    expect(
      sessionFormSchema.safeParse({ starts_at: past, duration_min: 30 }).success
    ).toBe(false)
  })

  it('refuse une date > 7 jours dans le futur', () => {
    const far = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
    expect(
      sessionFormSchema.safeParse({ starts_at: far, duration_min: 30 }).success
    ).toBe(false)
  })

  it('refuse une durée < 5 min', () => {
    const soon = new Date(Date.now() + 60_000)
    expect(
      sessionFormSchema.safeParse({ starts_at: soon, duration_min: 3 }).success
    ).toBe(false)
  })

  it('refuse une durée > 240 min', () => {
    const soon = new Date(Date.now() + 60_000)
    expect(
      sessionFormSchema.safeParse({ starts_at: soon, duration_min: 999 }).success
    ).toBe(false)
  })

  it('accepte un cas valide', () => {
    const soon = new Date(Date.now() + 60_000)
    expect(
      sessionFormSchema.safeParse({ starts_at: soon, duration_min: 30 }).success
    ).toBe(true)
  })
})

describe('eventFormSchema', () => {
  const base = {
    title: 'concert',
    description: 'venez nombreux',
    location: 'parc',
    starts_at: new Date(Date.now() + 3600_000)
  }

  it('refuse ends_at <= starts_at', () => {
    expect(eventFormSchema.safeParse({ ...base, ends_at: base.starts_at }).success).toBe(
      false
    )
  })

  it('refuse max_participants <= 0', () => {
    expect(eventFormSchema.safeParse({ ...base, max_participants: 0 }).success).toBe(
      false
    )
  })

  it('refuse un titre vide', () => {
    expect(eventFormSchema.safeParse({ ...base, title: '' }).success).toBe(false)
  })

  it('accepte un event valide', () => {
    expect(eventFormSchema.safeParse(base).success).toBe(true)
  })
})

describe('requestFormSchema / replyFormSchema', () => {
  it('refuse subject vide', () => {
    expect(requestFormSchema.safeParse({ subject: '', message: 'foo' }).success).toBe(
      false
    )
  })
  it('refuse message vide', () => {
    expect(requestFormSchema.safeParse({ subject: 'foo', message: '' }).success).toBe(
      false
    )
  })
  it('refuse reply vide', () => {
    expect(replyFormSchema.safeParse({ reply: '' }).success).toBe(false)
  })
  it('accepte un reply valide', () => {
    expect(replyFormSchema.safeParse({ reply: 'merci' }).success).toBe(true)
  })
})

describe('pianoFormSchema', () => {
  it('refuse un commentaire > 500 chars', () => {
    const long = 'a'.repeat(501)
    expect(
      pianoFormSchema.safeParse({
        address: 'rue',
        comment: long,
        quality: 'neuf'
      }).success
    ).toBe(false)
  })

  it('refuse une quality inconnue', () => {
    expect(
      pianoFormSchema.safeParse({
        address: 'rue',
        comment: 'ok',
        quality: 'pas_une_valeur'
      }).success
    ).toBe(false)
  })

  it('accepte un piano valide', () => {
    expect(
      pianoFormSchema.safeParse({
        address: 'rue',
        comment: 'ok',
        quality: 'neuf'
      }).success
    ).toBe(true)
  })
})
