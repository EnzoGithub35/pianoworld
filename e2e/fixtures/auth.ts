import { type Page, expect } from '@playwright/test'

/**
 * Sprint 11 — Helpers auth pour E2E.
 *
 * Centralise les flows signIn/signOut + l'URL Supabase locale.
 * Les credentials fixtures (alice/bob) viennent de e2e/fixtures/seed.sql.
 *
 * Ne pas importer @/lib/supabase ici (côté Node test runner, pas browser).
 */

export const SUPABASE_LOCAL_URL = process.env.E2E_SUPABASE_URL ?? 'http://localhost:54321'

export const FIXTURE_USERS = {
  alice: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'alice.e2e@pianoworld.test',
    pseudo: 'alice_e2e',
    password: 'TestPass123!'
  },
  bob: {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'bob.e2e@pianoworld.test',
    pseudo: 'bob_e2e',
    password: 'TestPass123!'
  }
} as const

export const FIXTURE_PIANO_ID = '33333333-3333-3333-3333-333333333333'

/**
 * Connecte un user via le form login standard. Attend la redirection vers
 * la carte (route protégée par RequireAuth).
 */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/auth/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/mot de passe/i).fill(password)
  await page.getByRole('button', { name: /se connecter/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 15_000 })
}

/**
 * Sign-out via le bouton settings (page Settings -> "Déconnexion").
 */
export async function signOut(page: Page) {
  await page.goto('/settings')
  await page.getByRole('button', { name: /se déconnecter|déconnexion/i }).click()
  await expect(page).toHaveURL(/\/auth\/login/)
}

/**
 * Génère un email + pseudo uniques pour un test signup (évite collisions
 * inter-tests si la DB n'est pas reset entre 2 specs).
 */
export function newSignupCredentials() {
  const suffix = Math.random().toString(36).slice(2, 10)
  return {
    email: `signup_${suffix}@pianoworld.test`,
    pseudo: `e2e_${suffix}`,
    password: 'TestPass123!'
  }
}
