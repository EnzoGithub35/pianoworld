# E2E Playwright — PianoWorld (Sprint 11)

Tests E2E des **golden paths** de l'app, exécutés contre une Supabase locale (Docker).

## Structure

```
e2e/
  fixtures/
    auth.ts          # helpers signIn/signOut + credentials fixtures
    seed.sql         # 2 users (alice, bob) + 1 piano fixture à Rennes
  golden/
    01-signup.spec.ts          # signup -> auto-login -> carte
    02-add-piano.spec.ts       # alice ajoute un piano (Photon mocké)
    03-update-piano.spec.ts    # MAJ piano fixture + verifie historique
    04-delete-account.spec.ts  # suppression compte RGPD (re-auth password)
    05-friend-workflow.spec.ts # alice envoie -> bob accepte
  tsconfig.json
  README.md
```

## Setup local (1 fois)

### 1. Prérequis

- **Docker Desktop** running (Supabase local utilise Docker)
- **Supabase CLI** : `scoop install supabase` (Windows) ou `npm i -g supabase`
- **psql** dans le PATH (vient avec Postgres ou via `scoop install postgresql`)
- **Node.js 20+** : requis (vérifier via `node --version`)

### 2. Installer Playwright + browsers

```powershell
npm install --legacy-peer-deps
npx playwright install chromium
```

### 3. Boot Supabase local + apply schema + seed

```powershell
npm run test:e2e:setup
```

Ce script :

- `supabase start` (boot Postgres + GoTrue + PostgREST + Studio sur Docker)
- `psql -f supabase/schema.sql` (apply schema 3000+ lignes)
- `psql -f e2e/fixtures/seed.sql` (crée alice, bob, piano fixture)

URLs locales :

- API : <http://localhost:54321>
- DB : `postgresql://postgres:postgres@localhost:54322/postgres`
- Studio : <http://localhost:54323>

## Lancer les tests

### Mode headless (CLI)

```powershell
npm run test:e2e
```

Lance tous les 5 specs en chromium headless. Trace + video + screenshot conservés en cas d'échec dans `playwright-report/`.

### Mode UI interactif (debug)

```powershell
npm run test:e2e:ui
```

Ouvre le Playwright UI : sélection des specs, time-travel debugging, watch mode.

> 💡 **Auto-start dev server** : en local Playwright démarre automatiquement `npm run dev` ([playwright.config.ts:21-30](../playwright.config.ts#L21-L30)) avant les tests. Set `E2E_NO_WEBSERVER=1` pour désactiver et tester contre un serveur déjà running.

### Spec unique

```powershell
npx playwright test e2e/golden/01-signup.spec.ts
```

### Reset DB entre runs

Si les tests ont modifié l'état (piano créés, demandes d'amitié) :

```powershell
supabase db reset --linked=false
npm run test:e2e:setup
```

(ou plus simplement `npm run test:e2e:setup` qui inclut le reset)

## Limitations connues

| Sujet                   | Détail                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Email confirmation**  | Désactivée dans `supabase/config.toml` (`enable_confirmations = false`) pour bypass dans signup tests.       |
| **Photon autocomplete** | Mocké via `page.route(...)` dans 02-add-piano. Tests offline-safe.                                           |
| **Nominatim reverse**   | Mocké également. Pas de hit réseau.                                                                          |
| **Notifications mail**  | Pas testées E2E (l'Edge Function `send-notification` ne tourne pas en local sans Resend). Couvert par pgTAP. |
| **Push notifications**  | Pas testées E2E (besoin de PWA installée + VAPID).                                                           |
| **Friend rate-limit**   | 20/24h sur `send_friend_request` — les specs reset entre runs sinon hit.                                     |

## CI GitHub Actions

Workflow `.github/workflows/e2e.yml` :

- **Manual** : `gh workflow run "E2E Playwright"` ou GitHub UI
- **Nightly cron** : 03:30 UTC tous les jours
- **PAS attaché aux PRs** : garde le check PR rapide (~3 min vitest+lint+build).

Le workflow boot Supabase via `supabase/setup-cli@v1` + `supabase start`, applique schema+seed, build l'app, lance Playwright headless. Trace artifact uploadé en cas d'échec.

## Debug d'un test qui fail

1. `npm run test:e2e:ui` → ouvre le runner UI
2. Sélectionne le spec qui fail
3. Inspect le trace : DOM snapshot à chaque étape, network requests, console logs
4. Adapte les selecteurs si besoin (le HTML peut avoir évolué)

Si un selector `getByRole` ou `getByLabel` ne match plus, c'est probablement qu'un attribut `aria-label` ou `<label htmlFor=>` a changé dans le code source. Voir [Playwright best practices selectors](https://playwright.dev/docs/best-practices#use-locators).

## Ajouter un nouveau spec

1. Créer `e2e/golden/06-<feature>.spec.ts`
2. Importer `signIn`, `FIXTURE_USERS` depuis `../fixtures/auth`
3. Utiliser `getByRole`, `getByLabel`, `getByText` (pas de class CSS selectors fragiles)
4. Tester localement : `npx playwright test e2e/golden/06-<feature>.spec.ts`
5. Commit + push → s'exécute au prochain run nightly
