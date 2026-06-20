# Development — PianoWorld

Setup local, CI/CD, deploy Vercel, Edge Function deploy, pg_cron configuration. Pour les conventions code voir [CONVENTIONS.md](CONVENTIONS.md). Pour la stratégie de branche voir [BRANCHING.md](../BRANCHING.md).

---

## 1. Setup local (premier checkout)

### 1.1 Pré-requis

- **Node.js 20+** (LTS recommandé)
- **PowerShell** (Windows) ou bash (Linux/macOS) — les commandes ici sont en PowerShell mais convertibles
- **Git** + accès au repo GitHub
- Compte **Supabase** gratuit (eu-west-3 recommandé)
- (Optionnel) Compte **Resend** pour les mails transactionnels
- (Optionnel) Compte **Sentry** pour erreurs prod

### 1.2 Install

```powershell
git clone git@github.com:EnzoGithub35/pianoworld.git
cd pianoworld
npm install --legacy-peer-deps
```

⚠️ **`--legacy-peer-deps` obligatoire** — conflit ESLint 9 vs typescript-eslint peer ranges. Sans flag, `npm install` échoue. La CI utilise aussi ce flag.

Husky s'auto-install via le script `prepare` ([package.json](../package.json)).

### 1.3 Supabase

1. Créer un projet sur [supabase.com](https://supabase.com) (free tier, région `eu-west-3` recommandée pour des latences mini sur la France).
2. `Settings > API` → copier `Project URL` (sans `/rest/v1`) et `anon public key`.
3. **SQL Editor** → ouvrir [supabase/schema.sql](../supabase/schema.sql) → coller → Run. Le fichier est idempotent (CREATE TABLE IF NOT EXISTS, etc.) mais long (~3000 lignes) → laisser 30s.
4. **Authentication > Providers > Email** → activer **"Confirm email"** (v5+ obligatoire — le trigger `handle_new_user` gère la création du profile post-confirmation).
5. **Authentication > URL Configuration** :
   - `Site URL` = ton URL prod (ex : `https://pianoworld.vercel.app`)
   - `Redirect URLs` = `<Site URL>/auth/login`, `<Site URL>/auth/reset`, `http://localhost:5173/auth/login`, `http://localhost:5173/auth/reset` (pour dev)

### 1.4 (Optionnel) Webhook + Edge Function pour notifications

Voir [supabase/functions/send-notification/README.md](../supabase/functions/send-notification/README.md). Synthèse :

1. **Database > Webhooks > Create webhook**
   - Name : `send_notifications`
   - Table : `notifications_outbox`
   - Events : `INSERT`
   - Type : Supabase Edge Functions
   - Function : `send-notification`
   - HTTP Headers : `x-webhook-secret` = `<valeur identique à WEBHOOK_SECRET côté Edge>`

2. **Edge Functions > Secrets** (clé/valeur) :
   - `WEBHOOK_SECRET` = `openssl rand -base64 32`
   - `RESEND_API_KEY` = depuis resend.com/api-keys (compte gratuit 3000 mails/mois)
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` = `npx web-push generate-vapid-keys`
   - `VAPID_SUBJECT` = `mailto:enzo.reine35@gmail.com`
   - `MAIL_FROM` = `onboarding@resend.dev` (test) ou `no-reply@<your-domain>` (prod, requiert vérif domaine Resend)
   - `APP_URL` = `https://pianoworld.vercel.app`

3. **Déployer la fonction** :
   ```bash
   supabase functions deploy send-notification
   ```
   (nécessite Supabase CLI installé via `npm i -g supabase`)

### 1.5 (Optionnel) pg_cron — retry + purge notifications

1. **Database > Extensions** → enable `pg_cron` et `pg_net`.

2. **SQL Editor** → exécuter les `cron.schedule(...)` du commentaire section 13 de `schema.sql` :

```sql
-- Retry des notifs en pending toutes les 5 min
select cron.schedule('notif-retry', '*/5 * * * *', $$
  select net.http_post(
    url := '<EDGE_FUNCTION_URL>/send-notification',
    headers := jsonb_build_object(
      'x-webhook-secret', '<WEBHOOK_SECRET>',
      'content-type', 'application/json'
    ),
    body := jsonb_build_object('record', jsonb_build_object('id', id))
  )
  from public.list_pending_notifications(50);
$$);

-- Purge nightly à 03:17 UTC
select cron.schedule('notif-purge', '17 3 * * *', $$
  select public.purge_old_notifications();
$$);
```

Remplacer `<EDGE_FUNCTION_URL>` par l'URL Supabase Edge Functions de ton projet et `<WEBHOOK_SECRET>` par la valeur configurée plus haut.

Vérifier que les jobs sont activés :

```sql
select * from cron.job;
select * from cron.job_run_details order by start_time desc limit 20;
```

### 1.6 .env local

```powershell
Copy-Item .env.example .env
```

Remplir :

```ini
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_SENTRY_DSN=                  # optionnel — si vide, Sentry est désactivé
VITE_VAPID_PUBLIC_KEY=BJk...      # optionnel (push) — `npx web-push generate-vapid-keys`
```

⚠️ **Vite ne recharge pas `.env` à chaud** — toujours redémarrer `npm run dev` après modif.

⚠️ **`VITE_SUPABASE_URL` ne doit PAS contenir `/rest/v1`** — `supabase-js` rajoute ce suffixe → double `/rest/v1/rest/v1/` → 404. Le client normalise (strip + warn) dans [src/lib/supabase.ts](../src/lib/supabase.ts), mais préférer l'URL nue type `https://xxx.supabase.co`.

### 1.7 Run

```powershell
npm run dev
```

Ouvrir `http://localhost:5173`. Au premier signup, le trigger `handle_new_user` crée le profile + les `notification_preferences` automatiquement.

---

## 2. Bootstrap superadmin

Le schema active automatiquement le superadmin sur `enzo.reine35@gmail.com` au signup (section 12 du schema.sql). Pour un autre email, modifier cette ligne :

```sql
-- supabase/schema.sql ligne ~3010
update public.profiles
set role = 'superadmin'
where id = (select id from auth.users where email = 'enzo.reine35@gmail.com')
  and role <> 'superadmin';
```

Replace par ton email avant `Run` dans SQL Editor. **Idempotent** — peut être ré-exécuté après le 1er signup.

Sinon manuellement :

```sql
update public.profiles
set role = 'superadmin'
where id = (select id from auth.users where email = '<your-email>');
```

---

## 3. Commandes — `npm scripts`

[package.json:6-19](../package.json#L6-L19)

| Script           | Commande                                                                                      | Usage                                                   |
| ---------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `dev`            | `vite`                                                                                        | Dev server port 5173, HMR                               |
| `build`          | `tsc -b && vite build`                                                                        | Production build avec PWA                               |
| `preview`        | `vite preview`                                                                                | Serve `dist/` pour test prod local                      |
| `typecheck`      | `tsc -b --noEmit`                                                                             | TypeScript check sans build                             |
| `lint`           | `eslint .`                                                                                    | Lint repo entier                                        |
| `lint:fix`       | `eslint . --fix`                                                                              | Auto-fix lint issues                                    |
| `format`         | `prettier --write "src/**/*.{ts,tsx,css,md,json}" "*.{md,json}" ".github/**/*.{yml,yaml,md}"` | Format all                                              |
| `format:check`   | `prettier --check ...`                                                                        | CI mode (no write)                                      |
| `test`           | `vitest run`                                                                                  | Run unit tests (CI mode, 80 tests + snapshot RLS)       |
| `test:watch`     | `vitest`                                                                                      | Watch mode interactif                                   |
| `test:coverage`  | `vitest run --coverage`                                                                       | Rapport coverage v8 (seuil 65% sur src/lib/)            |
| `test:e2e`       | `playwright test`                                                                             | **Sprint 11** — E2E golden paths headless               |
| `test:e2e:ui`    | `playwright test --ui`                                                                        | **Sprint 11** — Playwright UI debug interactif          |
| `test:e2e:setup` | `pwsh ./scripts/setup-e2e-db.ps1`                                                             | **Sprint 11** — Boot Supabase local + apply schema/seed |
| `prepare`        | `husky`                                                                                       | Réinstalle hooks au `npm install`                       |

### Update snapshots après modif schema.sql

```powershell
npm test -- -u
# ou
npx vitest run --update
```

### Supabase Local + E2E Testing (Sprint 11)

Pour lancer les tests E2E Playwright contre une Supabase Docker isolée :

**Prérequis** :

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running
- Supabase CLI : `scoop install supabase` (Windows) ou `npm i -g supabase`
- `psql` dans le PATH (`scoop install postgresql` Windows)
- Node 20+

**Bootstrap (1 commande)** :

```powershell
npm run test:e2e:setup
```

Le script [scripts/setup-e2e-db.ps1](../scripts/setup-e2e-db.ps1) :

1. `supabase start` (boot Postgres + GoTrue + PostgREST + Studio sur Docker, ports 54321-54323)
2. `psql -f supabase/schema.sql` (apply schema 3173 lignes)
3. `psql -f e2e/fixtures/seed.sql` (crée alice, bob, 1 piano fixture Rennes)
4. Vérifie que les 2 profiles fixtures existent

**Config** : [supabase/config.toml](../supabase/config.toml) avec `[auth.email] enable_confirmations = false` (bypass confirmation mail en test).

**Lancer les tests** :

```powershell
npm run test:e2e          # headless Chromium
npm run test:e2e:ui       # debug interactif
```

**Reset DB entre runs** (si les tests ont créé du state) :

```powershell
supabase db reset --linked=false; npm run test:e2e:setup
```

Détail complet dans [e2e/README.md](../e2e/README.md). Stratégie globale (3 tiers) dans [docs/TESTING.md](TESTING.md).

### pgTAP RLS Tests (Sprint 9)

Tests SQL au comportement réel des policies RLS + RPCs. 88 assertions, 7 fichiers dans [supabase/tests/](../supabase/tests/).

**Prérequis** :

- Supabase CLI installé et liée à un projet (`supabase link`)
- Extension pgTAP activée sur la DB (`create extension if not exists pgtap;` — déjà dans `_setup.sql`)
- Helpers `pgtap_helpers` schema chargés (le script s'en occupe)

**Run** :

```powershell
./scripts/run-pgtap.ps1
```

Le runner :

- Détecte Supabase CLI (PATH ou `$env:USERPROFILE\scoop\shims\supabase.exe`)
- Boucle sur `supabase/tests/0*.sql`
- `supabase db query --file <test.sql> --linked` pour chaque
- Parse plan vs ok N, agrège pass/fail
- Exit 1 si un test échoue

**Quand exécuter** :

- Après chaque modif de `schema.sql` touchant policies / RPCs / grants
- En complément du snapshot RLS Vitest (qui fige le texte SQL ; pgTAP valide le comportement)
- **PAS PR-gated**, **PAS pre-commit** (manuel ou nightly)

Voir [supabase/tests/README.md](../supabase/tests/README.md) pour les patterns. Stratégie complète dans [docs/TESTING.md](TESTING.md).

---

## 4. Hooks Git

Pre-commit hook ([.husky/pre-commit](../.husky/pre-commit)) :

```sh
npx lint-staged
npx tsc -b --noEmit
```

Lance automatiquement :

1. `lint-staged` → `eslint --fix` + `prettier --write` sur les fichiers staged uniquement
2. `tsc --noEmit` sur tout le projet

Toute erreur de type ou de lint bloque le commit avant push.

Commit-msg hook ([.husky/commit-msg](../.husky/commit-msg)) :

```sh
npx --no-install commitlint --edit "$1"
```

Vérifie que le commit suit la convention. Voir [CONVENTIONS.md §10](CONVENTIONS.md#10-husky--lint-staged--commitlint) pour le détail.

### Bypass urgence

Ne **jamais** bypass sauf urgence exceptionnelle (CI down, etc.) :

```bash
git commit --no-verify -m "..."
```

Si Husky bloque, **fix la cause** (lint error, type error, commit subject mal formé) plutôt que de bypass.

---

## 5. CI — GitHub Actions

[.github/workflows/ci.yml](../.github/workflows/ci.yml) — 3 jobs en parallèle, triggered par push/PR sur `main`.

### Job `quality`

Node 20, install `--legacy-peer-deps`, puis séquence :

1. `tsc -b --noEmit` — typecheck
2. `npm run lint` — eslint
3. `npm test` — vitest run (snapshot RLS check)
4. `npm run test:coverage` — coverage avec seuils (continue-on-error sur la coverage, informatif)

Env placeholders `VITE_SUPABASE_URL/ANON_KEY` configurés pour que l'import-time throw de [src/lib/supabase.ts:13-17](../src/lib/supabase.ts#L13-L17) ne casse pas.

### Job `build`

`npm run build` + vérification du **budget bundle** :

```bash
# Fail si dist/assets/index-*.js > 100 KB gzip
```

Empêche les régressions de taille majeures sur le chunk principal (qui ship sur toutes les pages).

### Job `audit`

`npm audit --audit-level=high`, `continue-on-error: true` — informatif, non bloquant. Complément de Dependabot. Si une CVE critique apparaît, alerte mais ne bloque pas le merge.

### Concurrency

`concurrency-cancel: true` (l. 11-13) → si on push deux fois sur la même branche, le run précédent est annulé. Économise les minutes GitHub Actions.

---

## 6. Dependabot

[.github/dependabot.yml](../.github/dependabot.yml) — 2 écosystèmes.

### npm

- Weekly, lundi 06:00 Europe/Paris
- Max 5 PRs ouvertes en parallèle
- Label `dependencies`
- Groupes :
  - `minor-and-patch` (version-updates) → bumped automatiquement
  - `security` (avec major autorisé pour les CVE)
- **Ignore les major** sur `react`, `react-dom`, `react-router-dom`, `vite`, `typescript` (l. 27-37) → bump manuel pour ces deps critiques

### github-actions

Monthly, label `dependencies` + `ci`.

---

## 7. Branch protection — main

Configurée via GitHub UI : `Settings > Branches > Branch protection rules > main`.

Réglages activés (voir [BRANCHING.md §130-147](../BRANCHING.md)) :

- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging :
  - `quality` (typecheck + lint + tests + coverage)
  - `build` (vite build + budget check)
- ✅ Require linear history (squash & merge ou rebase, **pas de merge commit**)
- ✅ Do not allow bypassing the above settings
- ❌ Force push : **denied**
- ✅ Include administrators

### Activation initiale

Le repo est solo. Si tu cliques `Settings > Branches > Branch protection > Add rule` sur GitHub :

1. **Branch name pattern** : `main`
2. Cocher les 5 cases listées ci-dessus
3. Save changes

⚠️ Une fois activée, **tu ne peux plus push direct sur main**. Tout doit passer par PR (squash merge depuis l'UI GitHub ou `gh pr merge --squash --delete-branch`).

---

## 8. Vercel — deploy production

[vercel.json](../vercel.json) configure le déploiement Vercel :

- Framework : `vite`
- Output : `dist`
- **Rewrites SPA** : `/(.*)` → `/` → React Router gère toutes les routes côté client
- **Cache différencié** :
  - `/assets/*` : `immutable, max-age=31536000` (1 an — Vite hash les filenames)
  - `/sw.js` : `max-age=0, must-revalidate` (SW PWA doit toujours être revalidé pour qu'autoUpdate fonctionne)
- **Headers sécurité** : HSTS preload, X-Frame-Options DENY, COOP/COEP/CORP, Permissions-Policy restrictive, CSP avec whitelist
- **CSP `connect-src`** whiteliste : Supabase https + wss, tile CDNs (OSM, CARTO), Photon, Nominatim, Sentry (browser-cdn + ingest), Resend API

### Setup initial

1. Push le repo sur GitHub
2. Sur vercel.com → New Project → Import Git Repository
3. Framework : Vite (auto-détecté)
4. Build command : `npm run build` (auto)
5. Output : `dist` (auto)
6. **Environment Variables** :
   - `VITE_SUPABASE_URL` = ton URL Supabase
   - `VITE_SUPABASE_ANON_KEY` = ta clé anon
   - `VITE_SENTRY_DSN` = (optionnel)
   - `VITE_VAPID_PUBLIC_KEY` = (optionnel, pour push)
7. Deploy

Auto-deploy enclenché : chaque push sur `main` → nouveau deploy en quelques minutes.

### Preview deployments

Chaque PR → un preview deployment Vercel avec URL unique. Permet de tester avant merge.

### Domain custom

Settings > Domains → ajouter `pianoworld.vercel.app` (gratuit) ou un domaine custom. Pour custom, configurer les DNS (CNAME ou A/AAAA selon le provider).

---

## 9. Edge Function deploy

[supabase/functions/send-notification/](../supabase/functions/send-notification/)

### Pré-requis

```bash
npm i -g supabase
supabase login
supabase link --project-ref <project-ref>  # depuis Settings > General
```

### Deploy

```bash
supabase functions deploy send-notification
```

Les secrets (`WEBHOOK_SECRET`, `RESEND_API_KEY`, `VAPID_*`, `MAIL_FROM`, `APP_URL`) sont configurés via Dashboard → Edge Functions → Secrets (jamais commités).

### Re-deploy après changement

```bash
# Modifier index.ts ou templates.ts
git add supabase/functions/send-notification/
git commit -m "fix(notif): handle edge case in template"
git push  # CI run mais n'auto-deploy pas la fonction Edge
supabase functions deploy send-notification  # manuel
```

À automatiser un jour via GitHub Actions (backlog).

### Logs

Dashboard → Edge Functions → `send-notification` → Logs. Filtres : success / error / timeout.

### Test local

```bash
supabase functions serve send-notification --env-file .env.local

# Dans un autre terminal :
curl -X POST http://localhost:54321/functions/v1/send-notification \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"record": {"id": "<outbox_uuid>"}}'
```

---

## 10. Workflow PR (exemple complet)

### Feature complète

```bash
# 1. Sync main
git switch main
git pull --ff-only

# 2. Create branch
git switch -c feat/some-feature

# 3. Code, test, commit (pre-commit hook s'exécute)
# Conventional commits lowercase
git add src/some-file.ts
git commit -m "feat(scope): add some behavior"
# ... plusieurs commits

# 4. Quality check local (optionnel mais recommandé)
npm run typecheck
npm run lint
npm test
npm run build

# Ou skill /quality-check (typecheck → lint → tests → build stop au 1er échec)

# 5. Push
git push -u origin feat/some-feature

# 6. Create PR via GitHub UI ou gh CLI
gh pr create --title "feat(scope): add some behavior" --body "..."

# 7. Attendre CI verte (quality + build + audit)

# 8. Merge sur GitHub UI : Squash and merge
# Branch protection enforce ça

# 9. Delete branch
git switch main
git pull --ff-only
git branch -d feat/some-feature
```

### Hotfix sécurité

Même workflow mais branche `security/<slug>` et commit `security(scope): ...`. Skill `/security-audit` peut être lancé avant merge pour validation multi-agents (facturé).

### Pre-merge final check

Skill `/ship-it` (Workflow multi-agents, facturé) :

1. Phase Quality : typecheck, lint, tests, build en parallèle
2. Phase Security : RLS, RPC, frontend, edge en parallèle
3. Synthèse GO / NO-GO avec checklist priorisée P0/P1/P2

---

## 11. Commandes Supabase utiles (SQL Editor)

### Inspecter les RPCs déployées

```sql
SELECT routine_schema, routine_name, security_type
FROM information_schema.routines
WHERE routine_schema = 'public' AND security_type = 'DEFINER'
ORDER BY routine_name;
```

### Inspecter les policies RLS

```sql
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

### Inspecter les triggers

```sql
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;
```

### Inspecter les column-level grants

```sql
SELECT table_name, column_name, grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY column_name, grantee;
```

(Devrait retourner `(id, pseudo, created_at)` × `(anon, authenticated)` × `SELECT` — pas plus.)

### Inspecter l'outbox

```sql
-- Notifs récentes
SELECT id, recipient_id, kind, status, attempts, error, created_at, sent_at
FROM notifications_outbox
ORDER BY created_at DESC LIMIT 20;

-- Stuck retries
SELECT * FROM notifications_outbox
WHERE status = 'pending' AND attempts > 0
ORDER BY next_retry_at;
```

### Inspecter pg_cron

```sql
SELECT * FROM cron.job;
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

### Forcer un retry de notif

```sql
UPDATE notifications_outbox
SET status = 'pending', attempts = 0, next_retry_at = now(), error = null
WHERE id = '<uuid>';
```

---

## 12. Quotas Supabase free tier

- **Database** : 500 MB → suffisant pour ~100k rows (PianoWorld n'utilise pas grand-chose)
- **Storage** : 1 GB → ~5000 photos avec compression 200 Ko
- **Bandwidth** : 5 GB/mois sortant
- **Auth** : utilisateurs illimités
- **Edge Functions** : 500k invocations/mois, 2M GB-secondes
- **Pause après 7j d'inactivité** : premier accès = quelques secondes de réveil. Non bloquant mais peut causer un `safety timeout` côté `AuthContext` (8s).

### Quotas Resend free tier

- 3000 mails/mois, 100/jour
- Pas de domaine custom (utiliser `onboarding@resend.dev` pour test, sinon ajouter domaine + vérifier DNS)

### Quotas Sentry free tier

- 5000 events/mois → suffisant si scrubber PII actif et pas de boucle d'erreurs

---

## 13. PWA — Service Worker

### Génération

[vite.config.ts](../vite.config.ts) configure `vite-plugin-pwa` avec :

- `registerType: 'autoUpdate'`
- Workbox : `clientsClaim: true`, `skipWaiting: true`, `cleanupOutdatedCaches: true`
- Stratégies : `StaleWhileRevalidate` (vs `CacheFirst`) — bad cache se répare au prochain refetch
- Manifest : icon, name, short_name, theme_color, background_color

### Icons à générer

⚠️ **`public/pwa-192x192.png` et `public/pwa-512x512.png` à générer** (backlog).

Outil : [realfavicongenerator.net](https://realfavicongenerator.net) depuis `public/favicon.svg`. Sans eux, l'icône iOS/Android par défaut sera générique au moment de "Ajouter à l'écran d'accueil".

### Test propre en preview

Le SW déjà installé chez l'utilisateur peut continuer à servir des assets obsolètes après un changement majeur (manifest, tile URLs, etc.).

**En dev/preview** :

- Ouvrir en **navigation privée**
- OU `DevTools → Application → Service Workers → Unregister` puis `Cmd/Ctrl+Shift+R`

**En prod** : `clientsClaim: true` + `skipWaiting: true` forcent le SW à prendre le contrôle au prochain page-load. Les utilisateurs déjà installés peuvent voir l'ancien SW jusqu'au prochain refresh.

### Push iOS

Ne fonctionnent qu'avec **PWA installée** ("Ajouter à l'écran d'accueil"), pas en onglet Safari classique. Sur Android/desktop ça marche en onglet.

---

## 14. Troubleshooting

### `npm install` échoue avec peer dep conflict

→ Manquer `--legacy-peer-deps`. Toujours utiliser ce flag.

### `tsc` retourne `'Database' is never[]`

→ Quelque part dans `src/types/database.ts` un `interface` au lieu de `type`. Le check Supabase declaration merging échoue. Voir [CONVENTIONS.md §5](CONVENTIONS.md#5-typescript--strict-mode--type-pas-interface).

### Snapshot RLS différe après pull

→ Quelqu'un a modifié `schema.sql` sans regen snapshot. `npm test -- -u` après revue du diff.

### Commit refusé par commitlint

→ Subject avec acronyme uppercase (`RGPD`, `CGU`, `RLS`, `RPC`) → écrire lowercase. Ou trop long (> 100 chars). Voir [CONVENTIONS.md §10](CONVENTIONS.md#10-husky--lint-staged--commitlint).

### Supabase paused après 7j

→ Premier accès = 10-30s de réveil. Si `AuthContext` safety timer (8s) déclenche → afficher splash + retry.

### Push notification iOS ne marche pas

→ Vérifier que la PWA est installée (pas juste tab Safari). Sur Mac Safari il faut macOS 13+ (Ventura).

### Edge Function 503 "not configured"

→ Secret `WEBHOOK_SECRET` absent côté Supabase Edge Functions Secrets. Fail-closed by design.

### `find_user_by_email` raise `rate_limit_exceeded`

→ Normal après 5 lookups en 24h. UI doit afficher "Tu as atteint la limite quotidienne, réessaie demain". Voir [SECURITY.md §13](SECURITY.md#13-v7--privacy-contracts-spécifiques).

### Leaflet "Maximum call stack" en dev

→ Race entre Leaflet mount et theme change. Rare. Refresh la page suffit.

### `npm run dev` "EADDRINUSE :::5173"

→ Une instance tourne déjà. `npx kill-port 5173` ou changer le port dans `vite.config.ts`.

---

## 15. Plan files

Le repo utilise les **plan files** Claude Code pour les features majeures. Stockés dans `C:\Users\enzor\.claude\plans\` (hors repo). Format markdown structuré : Contexte → Décisions cadrage → Architecture → PRs → Vérification end-to-end → Risques.

Workflow :

1. **EnterPlanMode** dans Claude Code
2. Brainstorm + AskUserQuestion pour décisions cadrage
3. Plan écrit dans le plan file
4. **ExitPlanMode** → approval user
5. Implémentation par PRs séquentielles
6. Stash file conservé pour référence (commits taggent souvent vers le plan)

Le dernier plan en date : `j-aimerai-cr-er-une-application-indexed-thunder.md` (v7 search + favorites + NavBar).
