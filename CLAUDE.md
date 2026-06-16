# PianoWorld — Guide projet pour Claude

Carte interactive et communautaire des pianos publics. Stack React + Vite + Supabase + Leaflet, 100% gratuit à héberger, mobile-first, PWA installable. Démarrage focalisé sur Rennes mais carte ouverte partout.

État actuel : **v7 en cours**. v1→v5 livrées (notifications, communauté, audit log, RGPD complet, sécurité durcie). v6 livrée (système d'amitié bidirectionnel + visibility sessions friends/public + compteur présence). **PR-A v7 backend** livrée (recherche unifiée users/pianos via pg_trgm + first_name/last_name opt-in + pianos favoris + notif `piano_favorite_update`). **PR-B v7 frontend à venir** (SearchTabs + FavoriteButton + FavoritesTab + NavBar 5e icône Amis + EditNamesDialog).

---

## Documentation

Ce fichier est l'**entry point** : conventions clés, gotchas, où trouver quoi. Pour les détails, voir :

| Sujet                                                                          | Document                                           |
| ------------------------------------------------------------------------------ | -------------------------------------------------- |
| Architecture frontend + backend, patterns React Query, structure de schema.sql | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)       |
| Modèle de sécurité (RLS, column grants, advisory locks, audit log, RGPD)       | [docs/SECURITY.md](docs/SECURITY.md)               |
| Catalogue exhaustif des RPCs SECURITY DEFINER                                  | [docs/RPCS.md](docs/RPCS.md)                       |
| Système de notifications (outbox + Edge Function + templates + push)           | [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md)     |
| Conventions code (logger, errors, schemas, tests, lint, prettier, commits)     | [docs/CONVENTIONS.md](docs/CONVENTIONS.md)         |
| Setup local + CI/CD + Vercel + Edge Function deploy + pg_cron                  | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)         |
| Référence détaillée des features par version                                   | [docs/FONCTIONNALITES.md](docs/FONCTIONNALITES.md) |
| Stratégie de branche solo + conventional commits                               | [BRANCHING.md](BRANCHING.md)                       |

---

## Stack

| Couche                | Choix                                                      | Pourquoi                                               |
| --------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| Frontend              | React 18 + Vite 6 + TypeScript strict                      | Standard, build rapide                                 |
| Styles                | Tailwind CSS + composants shadcn-like (locaux)             | Mobile-first                                           |
| Icônes                | lucide-react                                               | Tree-shake                                             |
| Carte                 | Leaflet + react-leaflet + OSM tiles (light) / CARTO (dark) | Gratuit illimité                                       |
| Clustering            | react-leaflet-cluster                                      | Lisibilité quand >20 markers                           |
| Géocodage             | Photon (autocomplete) + Nominatim (reverse)                | Photon pas de rate-limit, Nominatim limité à 1 req/sec |
| Recherche full-text   | pg_trgm + unaccent (v7)                                    | Index GIN trigram, accent-insensitive, fuzzy           |
| Backend               | Supabase (free tier, region eu-west-3)                     | PostgreSQL + Auth + Storage + RLS + Edge Functions     |
| State serveur         | TanStack Query                                             | Cache, optimistic updates, query keys par préfixe      |
| Routing               | React Router v6 + `React.lazy()`                           | Lazy par page                                          |
| Forms                 | react-hook-form + zod                                      | Schemas centralisés dans `src/lib/schemas.ts`          |
| Dates                 | dayjs (locale FR)                                          | Léger, `fromNow()` natif                               |
| Toasts                | react-hot-toast                                            | Stylé via `main.tsx`                                   |
| Photos                | browser-image-compression                                  | Client-side, max 200 Ko / 1024px                       |
| PWA                   | vite-plugin-pwa (Workbox)                                  | StaleWhileRevalidate + cache tuiles + Web Push         |
| Mails transactionnels | Resend + Supabase Edge Function                            | Free tier 3000/mois, 100/jour                          |
| Web Push              | web-push + VAPID + Service Worker                          | Notification mobile/desktop opt-in                     |
| Erreurs prod          | Sentry (`@sentry/react`)                                   | Free tier 5k events/mois + scrubber PII                |
| Tests unitaires       | Vitest 2 + @testing-library/react + jsdom                  | Watch instantané, jest-compatible                      |
| Lint & format         | ESLint 9 (flat) + Prettier + plugin-tailwindcss            | Auto-format au commit                                  |
| Hooks Git             | Husky + lint-staged + commitlint                           | pre-commit + commit-msg enforced                       |
| CI                    | GitHub Actions (typecheck + lint + test + build + audit)   | Bloque les merges cassés                               |
| Veille deps           | Dependabot weekly grouped                                  | PR automatiques minor + patch                          |
| Hébergement           | Vercel                                                     | `vercel.json` configuré, auto-deploy main              |

---

## Conventions essentielles

### Logger — toujours via `logger`, jamais `console`

```ts
import { logger } from '@/lib/logger'

logger.debug('scope.action', 'msg', { ctx }) // dev only
logger.info('scope.action', 'msg', { ctx }) // dev only
logger.warn('scope.action', 'msg', { ctx }) // console + Sentry warning
logger.error('scope.action', 'msg', err, { ctx }) // console + Sentry exception
```

Scope = `domaine.action` (ex: `auth.signup`, `piano.add`, `friends.send`, `favorites.toggle`). Seul fichier autorisé à utiliser `console.*` directement : `src/lib/logger.ts` (ESLint override).

### Erreurs — helpers spécialisés

```ts
import {
  getErrorMessage,
  isUniqueViolation,
  isPermissionDenied,
  isRateLimitError,
  isInvalidPassword
} from '@/lib/errors'

try {
  await doSomething()
} catch (err) {
  if (isInvalidPassword(err)) return toast.error('Mot de passe incorrect')
  if (isRateLimitError(err)) return toast.error('Tu vas trop vite, réessaie plus tard')
  toast.error(getErrorMessage(err, 'Fallback FR'))
}
```

### Validation — zod schemas dans `src/lib/schemas.ts`

Tout formulaire utilise un schema centralisé. Si tu changes une longueur max, change-le ici, pas dans le composant. v7 PR-B ajoutera `profileNamesSchema` + `emailSearchSchema`.

### Constantes — aucune magic number dans le code

`src/lib/constants.ts` regroupe coords Rennes, 50m doublons, 200 Ko photo, regex pseudo, `NOTIFICATION_CATEGORIES` (8 entrées — `notify_favorite_update` à ajouter en v7 PR-B), `RATE_LIMITS` (mirror SQL), `CGU_VERSION`, v6 `FRIENDS_DISPLAY_LIMIT` / `PRESENCE_AVATAR_STACK_LIMIT` / `SESSION_VISIBILITIES`.

### TypeScript — `type` pas `interface` pour Supabase

Supabase ne reconnaît pas les `interface` comme `Record<string, unknown>` (declaration merging). Le client se résout en `never` → `insert()` casse. Toujours déclarer les Row/Insert/Update en `type = {...}`.

### Tailwind — `cn()` pour les conditionnels

```ts
import { cn } from '@/lib/utils'
className={cn('base classes', isActive && 'active classes')}
```

Prettier + `prettier-plugin-tailwindcss` trient les classes automatiquement au commit.

### Tests — Vitest + Testing Library

Convention miroir `__tests__/`. Couverture cible : **65% sur `src/lib/`** (seuil bloquant en CI), objectif 80% à terme. Snapshot des policies/RPCs/grants RLS dans `security-snapshot.test.ts` — toute modif `schema.sql` force un diff explicite (`npm test -- -u` après revue).

### Conventional commits + branches

Voir [BRANCHING.md](BRANCHING.md). Format imposé par commitlint :

```
<type>(<scope>): <résumé impératif, lowercase, ≤ 100 chars>
```

Types : `feat`, `fix`, `security`, `chore`, `docs`, `test`, `ci`, `perf`, `refactor`, `style`, `build`, `revert`.

Pour le détail (logger sanitize, error guards complets, schemas list, ESLint overrides, Prettier options, Husky setup) voir [docs/CONVENTIONS.md](docs/CONVENTIONS.md).

---

## Sécurité — defense in depth (7 couches)

1. **RLS policies** sur toutes les tables publiques (sinon REVOKE ALL → invisible PostgREST)
2. **Column-level grants** sur `profiles` (anon+auth voient `(id, pseudo, created_at)` seulement)
3. **RPCs SECURITY DEFINER** avec `set search_path = public` + garde explicite (`auth.uid()`, `is_admin()`, `is_banned()`, etc.)
4. **Rate-limits** : trigger BEFORE INSERT générique + helper `enforce_caller_rate_limit` pour RPC bodies (v7)
5. **Advisory locks** transactionnels (rate-limit, friendship RPCs, toggle_favorite)
6. **Re-auth password** sur RPCs irréversibles (ban, force-delete, delete-account)
7. **Audit log** admin-only, écrit via `write_audit_log()` SECURITY DEFINER

### Rate limits (mirror SQL ↔ `src/lib/constants.ts`)

| Action              | Max | Fenêtre |
| ------------------- | --- | ------- |
| `piano_create`      | 5   | 24 h    |
| `piano_update`      | 30  | 24 h    |
| `piano_visit`       | 50  | 24 h    |
| `piano_session`     | 10  | 24 h    |
| `piano_report`      | 5   | 24 h    |
| `user_request`      | 5   | 7 j     |
| `friend_request`    | 20  | 24 h    |
| `user_search_email` | 5   | 24 h    |

### Anonymisation RGPD-cohérente

`piano_updates.updated_by` est `ON DELETE SET NULL`. Snapshot `author_pseudo_at_time` rempli par trigger BEFORE INSERT → l'historique survit aux suppressions de compte. Même pattern v6 (`sender_pseudo` snapshot payload `friend_arriving`) et v7 (`updater_pseudo` payload `piano_favorite_update`).

### `export_my_data()` RGPD

Retourne jsonb : `user, profile, pianos, piano_updates, piano_reports, piano_visits, piano_sessions, piano_favorites (v7), friendships (v7), event_participants, user_requests, notification_preferences, push_subscriptions`. Push subscriptions exportent endpoint + UA seulement (jamais p256dh/auth_secret).

Pour le modèle de sécurité complet (RLS pattern, threat model, backlog, sub-RPCs, advisory locks détaillés), voir [docs/SECURITY.md](docs/SECURITY.md). Pour le catalogue exhaustif des RPCs, voir [docs/RPCS.md](docs/RPCS.md).

---

## Notifications (résumé — voir [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md))

Pattern **outbox transactionnel** : trigger DB → `notifications_outbox` → webhook → Edge Function `send-notification` (re-fetch row depuis DB, jamais le payload webhook) → filtre prefs + banned → re-vérif spécifique (friend_arriving check `are_friends_safe` à delivery time) → mail Resend + push web-push → `mark_notification_sent` (backoff exponentiel 2/4/8/16/32 min, DLQ à la 5e). Purge nightly via pg_cron.

**9 notification kinds (post v7)** : `piano_comment, piano_update, session_conflict, request_reply, event_created` (v4) + `friend_arriving, friend_request_received, friend_request_accepted` (v6) + `piano_favorite_update` (v7).

⚠️ **Transitional state v7 PR-A** : `notify_favorite_update` existe en DB (colonne + KIND_TO_PREF) mais n'est PAS encore dans `NOTIFICATION_CATEGORIES` côté `src/lib/constants.ts` → le toggle UI sera invisible jusqu'à PR-B v7. Conséquence : les users reçoivent les notifs MAJ favoris sans pouvoir opt-out via UI tant que PR-B n'est pas mergée. À fixer dans PR-B v7.

---

## Arborescence (résumé — voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) pour le détail)

```
src/
  main.tsx                        # 5 providers (Sentry/Router/Query/Theme/Auth) + Toaster
  App.tsx                         # routes lazy + RequireAuth + RequireAdmin + AppShell unique
  lib/                            # logger, errors, schemas, constants, supabase, sentry, web-push,
                                  # geocoding, photo, distance, date, utils, session-status
                                  # + __tests__/ (Vitest + security-snapshot RLS)
  contexts/                       # AuthContext (useAuth re-exporté ici, PAS dans hooks/), ThemeContext
  hooks/                          # tous TanStack Query (sauf useGeolocation/useOnline)
                                  # 17 hooks dont useFriends (v6), usePianoPresence (v6)
                                  # v7 PR-B ajoutera : usePianoSearch, useEmailSearch, useFavorites
  components/
    ui/                           # primitives (Button CVA, Dialog sans focus trap,
                                  # Tabs sans ArrowKey handler, Avatar HSL hash, etc.)
    Auth/ Map/ Piano/ Layout/ Onboarding/ Settings/ Admin/ Community/ Events/ Requests/
    Friends/                      # v6 — FriendsTab + FriendCard + AddFriendButton (5 états)
                                  # + RemoveFriendDialog (confirmation textuelle "retirer")
    Dashboard/ActivityTab.tsx
  pages/                          # toutes lazy : AuthPage, MapPage, Dashboard (5 tabs),
                                  # SearchPage, SettingsPage, UserPage, PianoPage, LegalPage, AdminPage
  test/setup.ts
  types/database.ts               # Database type + enums + v6/v7 types (Friendship, PianoFavorite, ...)

supabase/
  schema.sql                      # 15 sections (1-11 cœur, 12 bootstrap, 13 setup, 14 v6, 15 v7)
  functions/send-notification/    # Edge Function Deno (Resend + web-push) + 9 templates

# Racine
BRANCHING.md, CLAUDE.md, docs/, eslint.config.js, commitlint.config.js, vitest.config.ts,
.husky/, .github/, .prettierrc.json, vercel.json
```

---

## Commandes

```powershell
npm run dev              # http://localhost:5173
npm run build            # tsc -b + vite build
npm run preview          # serve dist/ pour test prod
npm run typecheck        # tsc -b --noEmit
npm run lint             # eslint .
npm run lint:fix         # eslint . --fix
npm run format           # prettier --write src/**/*
npm run format:check     # prettier --check
npm test                 # vitest run (CI mode)
npm run test:watch       # vitest interactive
npm run test:coverage    # rapport coverage v8
npm test -- -u           # update snapshots (après modif schema.sql)
npx vitest run --update  # alternative explicite update snapshot
```

Pre-commit hook lance automatiquement `lint-staged` (eslint --fix + prettier --write) + `tsc --noEmit`. Commit-msg hook lance commitlint. Pas besoin de penser à `npm run lint` avant le commit.

---

## Skills Claude Code

Skills custom du projet, dans `.claude/skills/` (committés, versionnés). Invocables via `/<nom>` ou auto-déclenchés sur les phrases indiquées.

| Skill             | Quand l'utiliser                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `/quality-check`  | Gate locale rapide : typecheck → lint → tests → build, stop au 1er échec. Avant un commit/push. |
| `/ship-it`        | Pré-déploiement (Workflow multi-agents) : qualité + sécurité → verdict GO/NO-GO. ⚠️ facturé.    |
| `/security-audit` | Audit sécurité multi-axes (RLS, RPCs, frontend, Edge, CSP, RGPD) via Workflow. ⚠️ facturé.      |
| `/rpc-create`     | Scaffolde une RPC `SECURITY DEFINER` conforme + rappel snapshot.                                |
| `/design-review`  | Revue design/UX d'une page/composant vs design system "Bois de piano".                          |
| `/a11y-audit`     | Audit accessibilité (erreur↔champ, clavier/Tabs, aria-label, focus, contraste).                 |
| `/feature-slice`  | Ajout d'une feature data end-to-end : table + RLS + zod + type + constantes + hook + snapshot.  |

`ship-it` et `security-audit` lancent le tool Workflow (multi-agents, facturé) : ne les exécuter que sur demande explicite.

---

## Setup local rapide

Voir [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) pour les étapes complètes (Supabase, Edge Function, GitHub, Vercel, pg_cron).

1. `npm install --legacy-peer-deps`
2. Créer projet Supabase free tier eu-west-3
3. SQL Editor → exécuter `supabase/schema.sql`
4. `Authentication > Providers > Email` → activer "Confirm email" (v5+ obligatoire)
5. (Optionnel) Webhook `notifications_outbox` INSERT → Edge Function + secrets Resend/VAPID
6. (Optionnel) pg_cron jobs (`notif-retry */5` + `notif-purge` nightly)
7. `cp .env.example .env`, remplir `VITE_SUPABASE_URL/ANON_KEY`, optionnels SENTRY_DSN + VAPID_PUBLIC_KEY
8. `npm run dev`

---

## Gotchas connus

### `VITE_SUPABASE_URL` ne doit PAS contenir `/rest/v1`

`supabase-js` rajoute ce suffixe → double `/rest/v1/rest/v1/` → 404. `src/lib/supabase.ts` normalise (strip + warn), mais préfère l'URL nue type `https://xxx.supabase.co`.

### Vite ne recharge pas `.env` à chaud

Toujours redémarrer `npm run dev` après avoir touché `.env`.

### Email confirmation Supabase — DOIT être activée (v5+)

Le trigger SQL `handle_new_user` (AFTER INSERT sur `auth.users`) crée le profil côté serveur — donc `auth.uid()` peut être null au moment du signup sans casser quoi que ce soit. Si tu désactives la confirmation, tu casses le flow `/auth/confirm-pending`.

### Nominatim rate limit

1 req/sec en gratuit. Ne JAMAIS l'utiliser pour de l'autocomplete (utiliser Photon). Le reverse-geocode (1 appel à l'ajout d'un piano) est OK.

### Supabase types : `type` obligatoire (pas `interface`)

Si un `from('table').insert(...)` retourne une erreur "never[]", c'est que `Database['public']` ne satisfait pas `GenericSchema`, probablement à cause d'un `interface`.

### PWA icons absents

`public/pwa-192x192.png` et `public/pwa-512x512.png` doivent être générés (realfavicongenerator.net depuis `public/favicon.svg`). Sans eux, l'icône iOS/Android par défaut sera générique.

### Quota Supabase Storage 1 Go

Compression client agressive (200 Ko/photo) → ~5000 photos. Si dépassement, supprime les photos orphelines via SQL.

### Pause Supabase free après 7 jours d'inactivité

Premier accès = quelques secondes de réveil. Non bloquant mais peut causer un `safety timeout` côté AuthContext (8s).

### commitlint subject lowercase

Le commit-msg hook refuse les sujets avec capitalisation incohérente. Subject doit être **lowercase strict** ou **sentence-case strict**. Les acronymes en milieu (RGPD, CGU, RLS, RPC, CI) cassent → écrire `rgpd`, `cgu`, `rls`, etc. dans le subject. Le body peut être normal.

### Snapshot RLS — `npm test -- -u` après chaque modif schema.sql

Toute modification de policy / trigger / RPC / grant dans `schema.sql` fait diverger le snapshot Vitest. Workflow :

1. Modifier `schema.sql`
2. `npm test` → snapshot diffère
3. Vérifier le diff visuellement (intentionnel ?)
4. `npm test -- -u` (ou `npx vitest run --update`) pour figer la nouvelle baseline
5. Committer `schema.sql` + le `.snap` mis à jour

### `--legacy-peer-deps` nécessaire à l'install

Conflit ESLint 9 vs typescript-eslint peer ranges. Sans flag, `npm install` échoue. Documenté dans CI aussi.

### Push notifications iOS

Ne fonctionnent qu'avec PWA installée ("Ajouter à l'écran d'accueil"), pas en onglet Safari classique. Sur Android/desktop ça marche en onglet.

### Service Worker PWA stale après changement majeur

Si tu changes le manifest, des URLs de tuiles ou des stratégies de cache dans `vite.config.ts`, le SW déjà installé peut continuer à servir des assets obsolètes. Le `registerType: 'autoUpdate'` + `clientsClaim: true` + `skipWaiting: true` + `cleanupOutdatedCaches: true` + stratégies `StaleWhileRevalidate` (vs CacheFirst) corrigent au prochain refetch. Pour test propre en preview : navigation privée OU `DevTools → Application → Service Workers → Unregister` puis `Cmd/Ctrl+Shift+R`.

### v7 transitional state — `notify_favorite_update` invisible UI

Voir section Notifications ci-dessus. Tant que PR-B v7 n'est pas mergée, le toggle n'apparaît pas dans Settings → Notifications.

### v7 transitional state — NavBar 5e icône Amis

Aujourd'hui les amis sont accessibles via `/dashboard?tab=friends`. PR-B v7 ajoutera une 5e icône Users → page `/friends` standalone.

### `useAuth` n'est pas dans `src/hooks/`

Le hook `useAuth` vit dans `src/contexts/AuthContext.tsx`. Tous les consommateurs `import { useAuth } from '@/contexts/AuthContext'`. Ne pas chercher un fichier `src/hooks/useAuth.ts` — il n'existe pas.

### AdminPage tabs non URL-synced

Contrairement à `Dashboard` qui utilise `?tab=`, `AdminPage` garde l'onglet en state local → refresh sur `/admin` retombe sur l'onglet KPIs. À synchroniser un jour (item C.4 du backlog).

### Leaflet CSS importée globalement

`src/main.tsx:11` importe `leaflet.css` au top-level → quelques KB de CSS shippés sur les pages non-carte. Migration future : importer dans `MapPage` chunk.

### Dashboard comment header stale

Le commentaire JSDoc en tête de `src/pages/Dashboard.tsx:15-22` dit encore "3 onglets" alors que le code en définit 5 (`activity, community, events, requests, friends`). À nettoyer.

---

## Anti-patterns à éviter

- **Pas de `console.log` direct** → utiliser `logger` (sauf dans `logger.ts` lui-même)
- **Pas de `err.message`** sans `instanceof Error` → utiliser `getErrorMessage(err)`
- **Pas de magic number** → `src/lib/constants.ts`
- **Pas de schema zod inline** dans un component → `src/lib/schemas.ts`
- **Pas d'`interface` pour les types Supabase** → toujours `type`
- **Pas de `console.error` + `throw`** redondant → `logger.error('scope', 'msg', err)` puis `throw err`
- **Pas de magic CSS dans le JSX** sans raison → ajouter une utility dans `index.css`
- **Pas de migration de schéma sans toucher `src/types/database.ts`** → les deux doivent rester synchrones (+ mettre à jour le snapshot RLS)
- **Pas de commit direct sur `main`** → toujours via branche + PR (branch protection l'empêche)
- **Pas de `git commit --no-verify`** sauf urgence vraiment exceptionnelle → si Husky bloque, fix la cause
- **Pas de `git push --force` sur `main`** → désactivé en branch protection de toute façon
- **Pas de SELECT direct sur `profiles` pour lire role/banned_at/first_name/last_name** → utiliser RPC `get_my_profile()`, `admin_list_users()`, `search_users()` ou `find_user_by_email()`
- **Pas de `signInWithPassword` pour re-auth** → utiliser RPC `verify_my_password()` (sinon rotation session sur tous les devices)
- **Pas de nouvelle RPC sans `set search_path = public`** → le snapshot RLS le check
- **Pas de notification mail/push sans vérifier `notification_preferences`** → soit côté SQL (trigger filtré), soit côté Edge Function via `KIND_TO_PREF`
- **Pas d'accès direct à `friendships` / `friendship_rejections` / `friend_arriving_dedup`** → tables REVOKE ALL, accès exclusif via les 10 RPCs v6
- **Pas de SELECT visibility-aware côté client sur `piano_sessions`** → utiliser RPC `list_piano_presence(p_piano)` ou `get_active_piano_counts(piano_ids[])` qui appliquent les filtres en SECURITY DEFINER

---

## Où trouver quoi rapidement

| Tu cherches…                                | Fichier                                                                                                                                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comment fetcher tous les pianos             | [src/hooks/usePianos.ts](src/hooks/usePianos.ts)                                                                                                                                                |
| Comment valider un formulaire               | [src/lib/schemas.ts](src/lib/schemas.ts)                                                                                                                                                        |
| La palette de couleurs                      | [src/index.css](src/index.css) (CSS vars `--primary`, etc.)                                                                                                                                     |
| Les couleurs des badges qualité             | [src/types/database.ts](src/types/database.ts) (`QUALITY_COLORS`)                                                                                                                               |
| Le schéma DB / RLS / RPCs                   | [supabase/schema.sql](supabase/schema.sql) + [docs/RPCS.md](docs/RPCS.md)                                                                                                                       |
| Le flow d'ajout piano                       | [src/components/Map/AddPianoFlow.tsx](src/components/Map/AddPianoFlow.tsx)                                                                                                                      |
| L'auth context (signUp avec confirm)        | [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)                                                                                                                                    |
| Le client Supabase + normalisation URL      | [src/lib/supabase.ts](src/lib/supabase.ts)                                                                                                                                                      |
| Comment Sentry est configuré + scrubber PII | [src/lib/sentry.ts](src/lib/sentry.ts)                                                                                                                                                          |
| Les routes lazy + guards                    | [src/App.tsx](src/App.tsx)                                                                                                                                                                      |
| Le tutoriel d'accueil                       | [src/components/Onboarding/Tutorial.tsx](src/components/Onboarding/Tutorial.tsx)                                                                                                                |
| La logique "encore là"                      | [src/hooks/usePianos.ts](src/hooks/usePianos.ts)                                                                                                                                                |
| La RPC suppression compte                   | [supabase/schema.sql](supabase/schema.sql) + [src/components/Settings/DeleteAccountDialog.tsx](src/components/Settings/DeleteAccountDialog.tsx)                                                 |
| Le logger                                   | [src/lib/logger.ts](src/lib/logger.ts)                                                                                                                                                          |
| Les constantes                              | [src/lib/constants.ts](src/lib/constants.ts)                                                                                                                                                    |
| Les notifications mail/push                 | [supabase/functions/send-notification/](supabase/functions/send-notification/) + [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md)                                                                 |
| Les préférences notification user           | [src/components/Settings/NotificationPreferences.tsx](src/components/Settings/NotificationPreferences.tsx) + [src/hooks/useNotificationPreferences.ts](src/hooks/useNotificationPreferences.ts) |
| Le web push opt-in                          | [src/lib/web-push.ts](src/lib/web-push.ts)                                                                                                                                                      |
| L'onglet Communauté (Calendrier/Liste)      | [src/components/Community/CommunityTab.tsx](src/components/Community/CommunityTab.tsx)                                                                                                          |
| L'audit log admin                           | [src/components/Admin/AuditLogTab.tsx](src/components/Admin/AuditLogTab.tsx) + `useAuditLog`                                                                                                    |
| Le bandeau cookies                          | [src/components/Layout/CookieBanner.tsx](src/components/Layout/CookieBanner.tsx)                                                                                                                |
| La page légale 3 onglets                    | [src/pages/LegalPage.tsx](src/pages/LegalPage.tsx)                                                                                                                                              |
| L'export RGPD complet                       | [src/components/Settings/ExportDataButton.tsx](src/components/Settings/ExportDataButton.tsx) (RPC `export_my_data`)                                                                             |
| Le rate limit + advisory lock               | [supabase/schema.sql](supabase/schema.sql) section 11.b + [docs/SECURITY.md](docs/SECURITY.md)                                                                                                  |
| La protection lockout superadmin            | [supabase/schema.sql](supabase/schema.sql) fonction `set_user_role`                                                                                                                             |
| Le snapshot RLS                             | [src/lib/**tests**/security-snapshot.test.ts](src/lib/__tests__/security-snapshot.test.ts) + `__snapshots__/`                                                                                   |
| La stratégie de branche                     | [BRANCHING.md](BRANCHING.md)                                                                                                                                                                    |
| La référence des features                   | [docs/FONCTIONNALITES.md](docs/FONCTIONNALITES.md)                                                                                                                                              |
| La config CI                                | [.github/workflows/ci.yml](.github/workflows/ci.yml)                                                                                                                                            |
| Les hooks Git                               | [.husky/pre-commit](.husky/pre-commit), [.husky/commit-msg](.husky/commit-msg)                                                                                                                  |
| Le système d'amitié v6 (hooks + UI)         | [src/hooks/useFriends.ts](src/hooks/useFriends.ts) + [src/components/Friends/](src/components/Friends/)                                                                                         |
| La visibility des sessions v6               | [src/lib/schemas.ts](src/lib/schemas.ts) `sessionFormSchema` + [supabase/schema.sql](supabase/schema.sql) section 14.c                                                                          |
| Le compteur de présence v6                  | [src/components/Piano/PianoPresenceCounter.tsx](src/components/Piano/PianoPresenceCounter.tsx) + `usePianoPresence`                                                                             |
| Les RPCs v7 search/favoris                  | [supabase/schema.sql](supabase/schema.sql) section 15.h + [docs/RPCS.md](docs/RPCS.md)                                                                                                          |
| Le helper rate-limit RPC body v7            | [supabase/schema.sql](supabase/schema.sql) `enforce_caller_rate_limit`                                                                                                                          |

---

## Statut v7

- **v1** : auth (login/signup/forgot/reset/delete/export), carte (markers + clustering + filtres + dark), ajout piano, détail + MAJ + historique + édition, recherche pseudo, profil, dashboard, settings, tutoriel, mode sombre, mentions légales, PWA, Sentry, vercel.json.
- **v2** : Activité — passages ("J'y suis passé") + sessions de présence ("J'y vais") + pulse animé sur la carte pour sessions actives + feed étendu.
- **v3** : Rôles 3 niveaux (user/admin/superadmin), dashboard admin (KPIs, users, reports, events, requests, roles), bannissement, RPCs admin sécurisées.
- **v4** : Notifications mail (Resend via Edge Function) + Web Push opt-in + 5 catégories de préférences, onglet Communauté Calendrier/Liste, bandeau cookies RGPD, refonte LegalPage 3 onglets, headers sécurité + CSP, ChangePasswordDialog.
- **v5** : Durcissement sécurité (RLS column-level grants sur profiles, rate limit bulletproof avec advisory lock, lockout protection superadmin, re-auth password sur RPCs irréversibles, email confirmation Supabase + trigger handle_new_user, CGU checkbox + accept_cgu_at, **audit log admin complet**, RGPD export complet + anonymisation cohérente, outbox retry/backoff/purge), infrastructure tests + DX (Vitest + 66 tests dont snapshot RLS, ESLint flat config, Prettier, Husky, commitlint, GitHub Actions CI, Dependabot, BRANCHING.md), scrubber PII Sentry, headers COOP/COEP/CORP.
- **v6** : Système d'amitié bidirectionnel (3 tables friendships + friendship_rejections + friend_arriving_dedup, 10 RPCs SECURITY DEFINER, cooldown 30j anti-stalking, auto-accept croisé via advisory lock, ghost-reject silencieux), visibility scope sur piano_sessions (`public`/`friends`) set-once via trigger BEFORE UPDATE, compteur de présence "X session(s) en cours" via batch RPC `get_active_piano_counts` (perf : 1 query au lieu de N), notification `friend_arriving` avec dedup hourly + re-vérif amitié à delivery time, 3 nouvelles préférences notif amis, audit log sur `remove_friendship`.
- **v7** (en cours) :
  - **PR-A backend (livrée)** : extensions pg_trgm + unaccent, colonnes `first_name`/`last_name` opt-in sur profiles (column-grants exclus → invisibles via PostgREST direct), 5 indexes GIN trgm (3 profiles + 2 pianos), table `piano_favorites` self-only RLS, notif kind `piano_favorite_update` + colonne `notify_favorite_update`, trigger `queue_favorite_update_notification`, helper `enforce_caller_rate_limit` (rate-limit dans RPC bodies), 6 RPCs : `search_users` (fuzzy 3 cols), `find_user_by_email` (exact-match + rate-limit 5/24h anti-énumération), `search_pianos` (fuzzy address+comment), `update_my_profile_names`, `toggle_piano_favorite` (advisory lock), `get_my_favorites`. `export_my_data` étendu (piano_favorites + friendships).
  - **PR-B frontend (à venir)** : `SearchTabs` (Utilisateurs/Pianos), `EmailSearchDialog`, `PianoSearchTab`, `FavoriteButton` (Bookmark, variant default + compact), `FavoritesTab` (6e onglet Dashboard ou remplace Amis), `EditNamesDialog` (Settings opt-in noms), `FriendsPage` standalone, **NavBar 5e icône Users** → `/friends`, refactor `Dashboard` (Friends tab → page standalone, Favoris tab ajouté), `notify_favorite_update` ajouté dans `NOTIFICATION_CATEGORIES` (fix transitional UI gap).

**Reste à faire (P2/P3 backlog)** :

- A.1.2 chiffrement `push_subscriptions` (vault Supabase nécessaire)
- A.5 CSP nonces (Vercel middleware Edge — actuellement `'unsafe-inline'` sur script-src + style-src)
- A.6.3 2FA TOTP admin (Supabase MFA)
- A.6.4 rate limit signup par IP (Edge Function)
- A.7 EXIF strip upload (Edge Function `process-photo` — photos peuvent contenir GPS)
- B.3 component/hook tests (MSW)
- B.4 tests pgTAP RLS via `supabase test db`
- B.5 Playwright e2e golden paths
- C.1 Dialog focus trap (a11y gap connu)
- C.2 Tabs ArrowLeft/Right keyboard handler (a11y gap connu)
- C.3 `AddFriendButton.findPendingId` stub retournant null (UX dégradée)
- C.4 AdminPage tabs URL-synced (refresh perd l'onglet)
- PWA PNG icons à générer

Plan détaillé : `C:\Users\enzor\.claude\plans\j-aimerai-cr-er-une-application-indexed-thunder.md`.
