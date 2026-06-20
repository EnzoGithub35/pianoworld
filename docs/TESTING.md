# PianoWorld — Stratégie de tests

PianoWorld utilise **3 tiers de tests complémentaires**. Chaque tier couvre un domaine que les autres ne couvrent pas. Ce document est l'entry point unique pour comprendre quel test lancer quand.

| Tier              | Outil                                   | Périmètre                                                                    | CI bloquant ?                     | Quand lancer                                    |
| ----------------- | --------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------- |
| **1. Unit / lib** | Vitest 2 + jsdom                        | `src/lib/`, helpers, schemas zod, snapshot RLS                               | ✅ **Oui** (pre-commit + PR gate) | À chaque commit (auto via Husky)                |
| **2. RLS SQL**    | pgTAP 1.3.3                             | Policies RLS + RPCs SECURITY DEFINER + grants + advisory locks + rate-limits | ❌ Non                            | Après modif `schema.sql` (manuel)               |
| **3. E2E**        | Playwright 1.61 + Supabase local Docker | Golden paths complets (UI + RPC + DB + auth)                                 | ❌ Non (nightly cron)             | Avant release ou après modif d'un flow critique |

**Philosophie** : la rapidité du PR gate (~3 min) prime sur l'exhaustivité. Les tiers 2 et 3 sont lancés manuellement / nightly pour ne pas bloquer le développement quotidien.

---

## 1. Vitest unit/lib tests

[src/lib/**tests**/](../src/lib/__tests__/) + [src/test/setup.ts](../src/test/setup.ts) + [vitest.config.ts](../vitest.config.ts).

### Couverture

- **80 tests** au total sur 7 fichiers (au 2026-06-20).
- **`src/lib/`** : seuil bloquant `lines: 65%, branches: 55%, functions: 60%, statements: 65%`. Toute régression de coverage fail la CI.
- **`security-snapshot.test.ts`** : snapshot complet des policies RLS + triggers + RPCs + grants extraits via regex de `schema.sql`. Toute modif de SQL force un diff explicite (`npm test -- -u` après revue).

### Quand utiliser Vitest

- Pour les **purs fonctions** (helpers, errors, schemas zod, distance, date, photo compression mocks)
- Pour figer la **signature SQL** (snapshot RLS — détecte qu'une policy a changé sans qu'on s'en rende compte)
- Pour les **hooks unitaires** (avec `renderHook` de @testing-library/react)
- **Pas pour** : tester le rendu d'un composant complet avec router/auth/query → préférer Playwright E2E

### Commandes

```powershell
npm test                  # CI mode (1 run, fail si snapshot diffère)
npm run test:watch        # watch interactif (re-run sur save)
npm run test:coverage     # rapport coverage v8 (HTML dans coverage/)
npm test -- -u            # update snapshots après revue du diff
npx vitest run --update   # alternative explicite update
```

### Pre-commit hook

Husky lance `lint-staged` (eslint --fix + prettier --write) + `tsc -b --noEmit` sur tous les fichiers staged. **Pas `npm test`** — pour garder le commit rapide. Le test suite tourne dans la CI GitHub Actions à la push.

### Workflow modification `schema.sql`

1. Modifier `schema.sql`
2. `npm test` → le snapshot RLS diffère
3. **Vérifier le diff** : est-ce intentionnel ? (policy ajoutée, RPC modifiée, grant changé)
4. `npm test -- -u` pour figer la nouvelle baseline
5. Lancer les pgTAP tests (cf. § 2) pour valider le comportement réel
6. Committer `schema.sql` + `.snap` mis à jour ensemble

### Quand lancer

- **Auto** : à chaque commit (via Husky) + à chaque PR (CI workflow `.github/workflows/ci.yml`)
- **Manuel** : pendant le dev pour itérer rapidement (`test:watch`)

---

## 2. pgTAP RLS SQL tests (Sprint 9)

[supabase/tests/](../supabase/tests/) + [scripts/run-pgtap.ps1](../scripts/run-pgtap.ps1) + [supabase/tests/README.md](../supabase/tests/README.md).

### Couverture — 88 assertions / 7 fichiers

| Fichier                            | Assertions | Couvre                                                                                                     |
| ---------------------------------- | ---------: | ---------------------------------------------------------------------------------------------------------- |
| `01_invisible_tables.sql`          |         13 | REVOKE ALL (friendships, friend_rejections, rate_limit_buckets, signup_ip_attempts) + audit_log admin-only |
| `02_profiles_grants.sql`           |         12 | Column grants (id/pseudo OK ; role/banned_at/first_name/last_name invisibles)                              |
| `03_piano_sessions_visibility.sql` |         10 | RLS visibility public/friends + list_piano_presence + get_active_piano_counts + reject_visibility_update   |
| `04_piano_favorites.sql`           |         11 | RLS self-only + toggle_piano_favorite idempotent + get_my_favorites                                        |
| `05_rpc_admin_guards.sql`          |         14 | set_user_role / set_user_banned / force_delete_piano / resolve_report / reply_to_request / delete_account  |
| `06_rpc_friend_workflow.sql`       |         16 | send/accept/reject/cancel/remove + cooldown 30j ghost-reject + get_friend_status                           |
| `07_rate_limits.sql`               |         12 | find_user_by_email (5/24h anti-énumération) + check_signup_ip_allowed (service_role only)                  |
| **Total**                          |     **88** |                                                                                                            |

### Pourquoi pgTAP ?

Le snapshot Vitest (`security-snapshot.test.ts`) fige la **forme** SQL : nom, signature, body texte. Mais il ne **prouve pas** qu'une policy bloque effectivement un anon ni qu'un RPC raise au bon endroit. pgTAP comble ce gap en exécutant des assertions réelles sur la DB.

**Bugs trouvés via pgTAP** (cf. [supabase/tests/README.md](../supabase/tests/README.md)) :

- `get_my_favorites.pu.updated_at` → la colonne n'existe pas, c'est `created_at`. Détecté Sprint 7 sécu deploy.
- `queue_favorite_update_notification.new.quality` → la colonne n'existe pas, c'est `new.new_quality`. Détecté par pgTAP test 04.

### Quand utiliser pgTAP

- **Après chaque modif de policy / RPC / grant dans `schema.sql`** — en complément du snapshot Vitest
- **Pour tester** : la **vraie** sémantique des RLS (qui peut SELECT/INSERT/UPDATE quoi avec quel rôle), les guards explicites des RPCs SECURITY DEFINER, les rate-limits, les advisory locks
- **Pas pour** : tester l'UI ou un flow user complet — utiliser Playwright

### Commandes

```powershell
./scripts/run-pgtap.ps1    # tous les tests (BEGIN/ROLLBACK isolé)

# un seul test
$sb = "$env:USERPROFILE\scoop\shims\supabase.exe"
& $sb db query --file supabase/tests/01_invisible_tables.sql --linked
```

### Quand lancer

- **Manuel** : après chaque modif `schema.sql` impactant policies / RPCs / grants
- **PAS PR-gated** (nécessite Supabase CLI loggé + projet linké + Docker pas suffisant — DB prod)
- **PAS pre-commit** (trop lent, dépendances)

### Pattern d'un test

```sql
begin;
select plan(3);

-- Setup en role postgres
select pgtap_helpers.create_test_user('alice', 'user');
select pgtap_helpers.create_test_user('bob', 'user');

-- Switch as alice authenticated
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('alice')::text,
  true
);

-- Assertions
select ok(
  exists(select 1 from public.pianos where created_by = auth.uid()),
  'alice voit ses propres pianos'
);
select throws_ok(
  $$ select role from public.profiles where id = pgtap_helpers.uid_for('bob') $$,
  '42501',
  'permission denied for column role',
  'alice ne voit pas le role de bob (column grant)'
);

select * from finish();
rollback;
```

Helpers dans [supabase/tests/\_setup.sql](../supabase/tests/_setup.sql) :

- `pgtap_helpers.uid_for(label)` — récupère l'UUID stable d'un test user créé par label
- `pgtap_helpers.create_test_user(label, role)` — crée un user dans `auth.users` + trigger `handle_new_user` crée le profil
- `pgtap_helpers.friendship_id_between(a, b)` — utilitaire pour resolver l'ID d'une friendship

---

## 3. Playwright E2E tests (Sprint 11)

[e2e/](../e2e/) + [playwright.config.ts](../playwright.config.ts) + [e2e/README.md](../e2e/README.md).

### Couverture — 5 golden paths

| Spec                         | Flow                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `01-signup.spec.ts`          | Signup → auto-login → carte. Variantes : pseudo dup, CGU manquant                               |
| `02-add-piano.spec.ts`       | Login alice → FAB → autocomplete Photon (mocké) → commentaire → submit                          |
| `03-update-piano.spec.ts`    | Login alice → /piano/<fixture> → Mettre à jour → still_there=true → submit → historique         |
| `04-delete-account.spec.ts`  | Signup user jetable → /settings → DeleteAccountDialog → re-auth password → redirect /auth/login |
| `05-friend-workflow.spec.ts` | Login alice → /user/bob → Ajouter en ami → logout → login bob → Accepter → vérif "Mes amis"     |

### Pourquoi Playwright ?

Vitest + pgTAP couvrent la logique. Mais ils ne valident pas que :

- Le bouton "Ajouter un piano" ouvre bien le bon Dialog
- Le flow signup → confirmation → login marche bout-en-bout
- Les RPCs sont bien appelées avec les bons params depuis l'UI
- La navigation entre pages préserve la session
- Les toasts d'erreur s'affichent au bon moment

Playwright lance Chromium contre l'app buildée + Supabase local Docker → vrai test end-to-end.

### Stack

- **Playwright 1.61** + `@playwright/test`
- **Chromium headless** (ajout d'autres browsers possible dans `playwright.config.ts:projects`)
- **Supabase local Docker** via [supabase/config.toml](../supabase/config.toml) (ports 54321-54323)
- **`enable_confirmations = false`** dans config.toml → bypass mail confirmation pour signup tests
- **Mocks Photon/Nominatim** via `page.route(...)` → tests offline-safe

### Fixtures

[e2e/fixtures/seed.sql](../e2e/fixtures/seed.sql) + [e2e/fixtures/auth.ts](../e2e/fixtures/auth.ts) :

- **Alice** (`alice.e2e@pianoworld.test`, password `TestPass123!`) — owner du piano fixture
- **Bob** (`bob.e2e@pianoworld.test`, password `TestPass123!`) — utilisé pour friend workflow
- **Piano fixture** à Place Sainte-Anne Rennes, UUID `33333333-3333-3333-3333-333333333333`
- Helpers : `signIn(page, email, password)`, `signOut(page)`, `newSignupCredentials()`, constants `FIXTURE_USERS`, `FIXTURE_PIANO_ID`

### Quand utiliser Playwright

- **Avant un release majeur** — sanity check des flows critiques
- **Après modif d'un golden path** (form signup, AddPianoFlow, DeleteAccountDialog, etc.)
- **PAS pour tester du SQL** (utiliser pgTAP) ou des helpers purs (utiliser Vitest)

### Commandes

```powershell
# Prérequis 1 fois : Docker Desktop + scoop install supabase + psql + node 20+
npx playwright install chromium

# Boot stack + apply schema + seed (1 cmd)
npm run test:e2e:setup

# Lancer les tests
npm run test:e2e          # headless CI mode
npm run test:e2e:ui       # UI interactif debug (time-travel, watch, network logs)
npx playwright test e2e/golden/01-signup.spec.ts   # un seul spec
```

### CI nightly

[.github/workflows/e2e.yml](../.github/workflows/e2e.yml) :

- **Manual** : `gh workflow run "E2E Playwright"` ou GitHub UI → Actions
- **Nightly cron** : tous les jours à `30 3 * * *` UTC (~04:30 Paris)
- **PAS attaché aux PRs** : garde le PR gate rapide (~3 min)
- **Trace artifact** uploadé sur fail (rétention 7j, téléchargeable depuis l'onglet Actions)

### Quand lancer

- **Manuel local** : avant un merge important
- **Auto nightly** : sanity check passif

### Pattern d'un spec

```ts
import { test, expect } from '@playwright/test'
import { signIn, FIXTURE_USERS, FIXTURE_PIANO_ID } from '../fixtures/auth'

test.describe('update piano', () => {
  test('alice MAJ son piano fixture', async ({ page }) => {
    await signIn(page, FIXTURE_USERS.alice.email, FIXTURE_USERS.alice.password)
    await page.goto(`/piano/${FIXTURE_PIANO_ID}`)

    await page.getByRole('button', { name: /mettre à jour/i }).click()
    await page.getByRole('button', { name: /^oui$/i }).click()
    await page.getByLabel(/commentaire/i).fill('MAJ E2E Sprint 11')
    await page.getByRole('button', { name: /enregistrer/i }).click()

    await expect(page.getByText(/mise à jour enregistrée/i)).toBeVisible({
      timeout: 8_000
    })
  })
})
```

### Sélecteurs

Préférer ARIA roles (`getByRole`, `getByLabel`, `getByText`) → résilients aux refactors CSS/HTML. Pas de classes Tailwind dans les selecteurs (fragiles).

Voir [Playwright best practices selectors](https://playwright.dev/docs/best-practices#use-locators).

---

## Récap : quand lancer quoi ?

```
Modif d'un helper pur (src/lib/errors.ts) → Vitest
Modif d'un composant UI                   → Vitest hook + Playwright si flow critique
Modif schema.sql (policy/RPC/grant)       → npm test (snapshot diff) + run-pgtap.ps1
Ajout d'une RPC                            → /rpc-create + Vitest snapshot + pgTAP 05_rpc_admin_guards.sql
Ajout d'un golden path                    → Playwright spec dans e2e/golden/
Avant release prod                         → tous les tiers + manuel sur mobile réel
```

## Limitations connues

| Tier       | Limitation                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| Vitest     | Pas de jsdom-incompatible API (Service Worker, IndexedDB → utiliser mocks dans `src/test/setup.ts`)         |
| pgTAP      | Exécuté contre la DB **prod** (rollback isolé). Pas de CI auto. Pas de tests data-driven (peu de fixtures). |
| Playwright | Email confirmation bypass (config.toml). Mocks Photon/Nominatim. Pas testé sur mobile réel iOS/Android.     |
| **Tous**   | Backlog **B.3 component/hook tests** Vitest + MSW non implémenté (cf. [CLAUDE.md backlog](../CLAUDE.md))    |

## Réf croisées

- [docs/CONVENTIONS.md §7-7c](CONVENTIONS.md) — patterns Vitest, pgTAP, Playwright
- [docs/DEVELOPMENT.md](DEVELOPMENT.md) — setup local + npm scripts
- [supabase/tests/README.md](../supabase/tests/README.md) — détail pgTAP
- [e2e/README.md](../e2e/README.md) — détail Playwright
- [docs/SECURITY.md § Sprint 9/11](SECURITY.md) — entrées sécurité B.4 + B.5
