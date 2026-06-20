import { test, expect } from '@playwright/test'
import { newSignupCredentials } from '../fixtures/auth'

/**
 * Sprint 11 — Golden path #1 : signup -> auto-login -> carte.
 *
 * Prerequis : config.toml `enable_confirmations = false` (skip email link).
 * Le trigger handle_new_user cree le profile + le signup retourne une
 * session immediatement -> redirection auto vers la carte par onAuthStateChange.
 */
test.describe('signup', () => {
  test('signup nominal -> auto-login -> redirige vers la carte', async ({ page }) => {
    const creds = newSignupCredentials()

    await page.goto('/auth/signup')
    await expect(page.getByRole('heading', { name: /pianoworld/i })).toBeVisible()

    await page.getByLabel(/pseudo/i).fill(creds.pseudo)
    await page.getByLabel(/email/i).fill(creds.email)
    await page.getByLabel(/mot de passe/i).fill(creds.password)
    await page.getByRole('checkbox', { name: /cgu|confidentialité/i }).check()

    await page.getByRole('button', { name: /créer mon compte/i }).click()

    // Sans email confirmation : signUp retourne une session immediatement.
    // L'onAuthStateChange redirige vers '/' via AuthPage <Navigate>.
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), {
      timeout: 15_000
    })

    // Carte chargee (NavBar visible -> user authentifie)
    await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible({
      timeout: 10_000
    })
  })

  test('signup avec pseudo deja pris -> erreur', async ({ page }) => {
    await page.goto('/auth/signup')

    await page.getByLabel(/pseudo/i).fill('alice_e2e') // existe deja (fixture)
    await page.getByLabel(/email/i).fill(`dup_${Date.now()}@pianoworld.test`)
    await page.getByLabel(/mot de passe/i).fill('TestPass123!')
    await page.getByRole('checkbox', { name: /cgu/i }).check()

    await page.getByRole('button', { name: /créer mon compte/i }).click()

    // Le check pseudo existant throw avant l'appel a auth.signUp.
    // Toast d'erreur "Ce pseudo est deja pris".
    await expect(page.getByText(/déjà pris/i)).toBeVisible({ timeout: 8_000 })
  })

  test('signup sans accepter CGU -> validation bloque', async ({ page }) => {
    await page.goto('/auth/signup')

    await page.getByLabel(/pseudo/i).fill('no_cgu_user')
    await page.getByLabel(/email/i).fill(`nocgu_${Date.now()}@pianoworld.test`)
    await page.getByLabel(/mot de passe/i).fill('TestPass123!')
    // Pas de check CGU.

    await page.getByRole('button', { name: /créer mon compte/i }).click()

    // Zod errors.acceptCgu.message s'affiche via <FormError id="cgu-error">
    await expect(page.locator('#cgu-error')).toBeVisible()
  })
})
