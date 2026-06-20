import { test, expect } from '@playwright/test'
import { newSignupCredentials } from '../fixtures/auth'

/**
 * Sprint 11 — Golden path #4 : suppression compte RGPD.
 *
 * Crée un user jetable via signup (pas alice/bob — fixtures preservees),
 * connecte-le, ouvre /settings, declenche le DeleteAccountDialog avec
 * re-auth password, verifie redirect /auth/login + impossible de re-login.
 */
test.describe('delete account', () => {
  test('signup -> settings -> supprime compte -> redirect /auth/login', async ({
    page
  }) => {
    const creds = newSignupCredentials()

    // 1. Signup (config.toml enable_confirmations = false -> auto-login)
    await page.goto('/auth/signup')
    await page.getByLabel(/pseudo/i).fill(creds.pseudo)
    await page.getByLabel(/email/i).fill(creds.email)
    await page.getByLabel(/mot de passe/i).fill(creds.password)
    await page.getByRole('checkbox', { name: /cgu/i }).check()
    await page.getByRole('button', { name: /créer mon compte/i }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), {
      timeout: 15_000
    })

    // 2. Navigate to settings
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /paramètres|settings/i })).toBeVisible({
      timeout: 8_000
    })

    // 3. Click "Supprimer mon compte" (data attribute via label prop)
    await page.getByText(/supprimer mon compte/i).first().click()

    // 4. Dialog ouvert : double confirmation
    await expect(page.getByRole('heading', { name: /supprimer mon compte/i })).toBeVisible()

    // Tape le pseudo
    await page.getByLabel(/pour confirmer/i).fill(creds.pseudo)
    // Tape le password
    await page.getByLabel(/ton mot de passe/i).fill(creds.password)

    // 5. Clic Supprimer
    await page.getByRole('button', { name: /^supprimer$/i }).click()

    // 6. Toast success + signOut + redirect /auth/login
    await expect(page.getByText(/compte supprimé/i)).toBeVisible({ timeout: 10_000 })
    await page.waitForURL(/\/auth\/login/, { timeout: 10_000 })

    // 7. Tentative re-login -> echec (user n'existe plus)
    await page.getByLabel(/email/i).fill(creds.email)
    await page.getByLabel(/mot de passe/i).fill(creds.password)
    await page.getByRole('button', { name: /se connecter/i }).click()

    // Toast d'erreur connexion (credentials invalides)
    await expect(page.getByText(/incorrect|invalid|échec/i)).toBeVisible({
      timeout: 5_000
    })
  })

  test('delete avec mauvais mot de passe -> erreur', async ({ page }) => {
    const creds = newSignupCredentials()

    await page.goto('/auth/signup')
    await page.getByLabel(/pseudo/i).fill(creds.pseudo)
    await page.getByLabel(/email/i).fill(creds.email)
    await page.getByLabel(/mot de passe/i).fill(creds.password)
    await page.getByRole('checkbox', { name: /cgu/i }).check()
    await page.getByRole('button', { name: /créer mon compte/i }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), {
      timeout: 15_000
    })

    await page.goto('/settings')
    await page.getByText(/supprimer mon compte/i).first().click()
    await page.getByLabel(/pour confirmer/i).fill(creds.pseudo)
    await page.getByLabel(/ton mot de passe/i).fill('WrongPass123!')
    await page.getByRole('button', { name: /^supprimer$/i }).click()

    await expect(page.getByText(/mot de passe incorrect/i)).toBeVisible({
      timeout: 5_000
    })

    // Toujours connecté → URL inchangée
    await expect(page).not.toHaveURL(/\/auth/)
  })
})
