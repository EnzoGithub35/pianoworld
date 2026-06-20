import { test, expect } from '@playwright/test'
import { signIn, FIXTURE_USERS, FIXTURE_PIANO_ID } from '../fixtures/auth'

/**
 * Sprint 11 — Golden path #3 : alice MAJ son piano fixture.
 *
 * Le piano fixture est seede a Rennes Place Sainte-Anne (cf. seed.sql).
 * Flow : login -> /piano/<id> -> "Mettre a jour" -> still_there=true -> quality
 * "moyen" -> commentaire -> submit -> verifie historique a 1 entree.
 */
test.describe('update piano', () => {
  test('alice MAJ son piano fixture -> historique mis a jour', async ({ page }) => {
    await signIn(page, FIXTURE_USERS.alice.email, FIXTURE_USERS.alice.password)

    await page.goto(`/piano/${FIXTURE_PIANO_ID}`)

    // Header affiche l'adresse du piano fixture
    await expect(page.getByText(/Place Sainte-Anne/i)).toBeVisible({ timeout: 10_000 })

    // Section "Mise à jour" : clic sur le bouton CTA
    await page.getByRole('button', { name: /mettre à jour/i }).click()

    // Form apparait : "Le piano est-il toujours là ?" -> Oui
    await expect(page.getByText(/piano est-il toujours là/i)).toBeVisible()
    await page.getByRole('button', { name: /^oui$/i }).click()

    // Sélection qualité — utilisation du label "Moyen" (1 des QUALITY_LABELS)
    const qualityRadio = page.getByRole('button', { name: /moyen/i }).first()
    if (await qualityRadio.isVisible()) {
      await qualityRadio.click()
    }

    // Commentaire optionnel
    await page.getByLabel(/commentaire/i).fill('MAJ E2E Sprint 11')

    // Submit
    await page.getByRole('button', { name: /enregistrer|valider/i }).click()

    // Toast success
    await expect(page.getByText(/mise à jour enregistrée/i)).toBeVisible({
      timeout: 8_000
    })

    // L'historique s'actualise (au moins 1 entree visible)
    await expect(page.getByText(/MAJ E2E Sprint 11/i)).toBeVisible({ timeout: 8_000 })
  })

  test('MAJ sans choix still_there -> erreur', async ({ page }) => {
    await signIn(page, FIXTURE_USERS.bob.email, FIXTURE_USERS.bob.password)
    await page.goto(`/piano/${FIXTURE_PIANO_ID}`)

    await page.getByRole('button', { name: /mettre à jour/i }).click()
    await page.getByLabel(/commentaire/i).fill('MAJ sans choice')
    await page.getByRole('button', { name: /enregistrer|valider/i }).click()

    // Toast d'erreur "Indique si le piano est encore là"
    await expect(page.getByText(/indique si le piano est encore là/i)).toBeVisible({
      timeout: 5_000
    })
  })
})
