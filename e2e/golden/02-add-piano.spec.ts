import { test, expect } from '@playwright/test'
import { signIn, FIXTURE_USERS } from '../fixtures/auth'

/**
 * Sprint 11 — Golden path #2 : alice ajoute un piano via le FAB.
 *
 * Strategie : mock Photon + Nominatim pour rendre le test deterministe et
 * eviter les rate-limits en CI. Use le flow autocomplete (tape une adresse
 * -> suggestion -> click) qui set lat/lng sans clic sur la map (selecteur
 * Leaflet pixel-pos instable).
 */
test.describe('add piano', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Photon autocomplete
    await page.route('**/photon.komoot.io/api/**', async (route) => {
      await route.fulfill({
        json: {
          features: [
            {
              geometry: { type: 'Point', coordinates: [-1.6750, 48.1100] },
              properties: {
                name: 'Cathédrale Saint-Pierre',
                city: 'Rennes',
                country: 'France',
                postcode: '35000',
                street: 'Rue de la Monnaie'
              }
            }
          ]
        }
      })
    })
    // Mock Nominatim reverse (au cas où coords résolves via geoloc)
    await page.route('**/nominatim.openstreetmap.org/**', async (route) => {
      await route.fulfill({
        json: { display_name: 'Cathédrale Saint-Pierre, 35000 Rennes' }
      })
    })
  })

  test('ajout piano via autocomplete -> succes', async ({ page }) => {
    await signIn(page, FIXTURE_USERS.alice.email, FIXTURE_USERS.alice.password)

    // Ouvre le flow via FAB
    await page.getByRole('button', { name: /ajouter un piano/i }).click()

    // L'AddPianoFlow ouvre un Dialog plein écran.
    // Tape une adresse -> Photon mock retourne 1 suggestion.
    const addressInput = page.getByLabel(/adresse/i)
    await addressInput.fill('Cathédrale Rennes')

    // Attend le dropdown listbox suggestions
    const suggestions = page.getByRole('listbox', { name: /suggestion|address/i }).or(
      page.locator('#address-suggestions')
    )
    await expect(suggestions).toBeVisible({ timeout: 5_000 })
    await page.getByRole('option').first().click()

    // L'adresse est maintenant résolue, coords settées.
    // Remplit le commentaire
    await page.getByLabel(/commentaire/i).fill('Piano test E2E Sprint 11')

    // Quality "bon état" (default) — pas besoin de sélection

    // Submit
    await page.getByRole('button', { name: /ajouter le piano|enregistrer/i }).click()

    // Toast success
    await expect(page.getByText(/piano ajouté|piano créé/i)).toBeVisible({
      timeout: 10_000
    })
  })

  test('ajout piano sans coords -> bouton submit disabled', async ({ page }) => {
    await signIn(page, FIXTURE_USERS.alice.email, FIXTURE_USERS.alice.password)
    await page.getByRole('button', { name: /ajouter un piano/i }).click()

    // Sans cliquer sur la map / sans autocomplete : l'hint "Clique sur la carte
    // ou utilise « Ma position »" est visible.
    await expect(page.getByText(/clique sur la carte/i)).toBeVisible()

    // Le bouton submit est désactivé tant que coords absent.
    const submit = page.getByRole('button', { name: /ajouter le piano|enregistrer/i })
    await expect(submit).toBeDisabled()
  })
})
