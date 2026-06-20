import { test, expect } from '@playwright/test'
import { signIn, signOut, FIXTURE_USERS } from '../fixtures/auth'

/**
 * Sprint 11 — Golden path #5 : alice envoie demande -> bob accepte.
 *
 * Flow :
 *  1. Alice login -> /user/bob_e2e -> "Ajouter en ami"
 *  2. Alice logout
 *  3. Bob login -> /friends ou /dashboard?tab=friends -> "Recues" tab -> Accepter
 *  4. Bob verifie alice apparait dans "Mes amis"
 *
 * Si cleanup necessaire entre runs : seed.sql wipe friendships pour les 2 users
 * (a executer manuellement entre 2 runs si pas de db reset).
 */
test.describe('friend workflow', () => {
  test('alice envoie demande -> bob accepte -> ils sont amis', async ({ page }) => {
    // 1. Alice -> page de bob -> envoie demande
    await signIn(page, FIXTURE_USERS.alice.email, FIXTURE_USERS.alice.password)
    await page.goto(`/user/${FIXTURE_USERS.bob.pseudo}`)

    // La page user affiche le pseudo
    await expect(page.getByRole('heading', { name: new RegExp(FIXTURE_USERS.bob.pseudo, 'i') })).toBeVisible({
      timeout: 8_000
    })

    // Bouton "Ajouter en ami" (status='none' au depart)
    await page.getByRole('button', { name: /ajouter en ami/i }).click()

    // Toast success
    await expect(page.getByText(/demande envoyée/i)).toBeVisible({ timeout: 5_000 })

    // 2. Alice logout
    await signOut(page)

    // 3. Bob login
    await signIn(page, FIXTURE_USERS.bob.email, FIXTURE_USERS.bob.password)

    // Va sur /friends (NavBar 5e icone) ou /dashboard?tab=friends
    await page.goto('/friends')

    // Onglet "Reçues"
    await page.getByRole('tab', { name: /reçues/i }).click()

    // La demande de alice apparait
    await expect(page.getByText(new RegExp(FIXTURE_USERS.alice.pseudo, 'i'))).toBeVisible({
      timeout: 8_000
    })

    // Click "Accepter"
    await page.getByRole('button', { name: /accepter/i }).first().click()

    // Toast success
    await expect(page.getByText(/ami avec|acceptée/i)).toBeVisible({ timeout: 5_000 })

    // 4. Verifie dans onglet "Mes amis"
    await page.getByRole('tab', { name: /mes amis/i }).click()
    await expect(page.getByText(new RegExp(FIXTURE_USERS.alice.pseudo, 'i'))).toBeVisible({
      timeout: 8_000
    })
  })
})
