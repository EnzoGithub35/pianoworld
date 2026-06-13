# PianoWorld — Guide projet pour Claude

Carte interactive et communautaire des pianos publics. Stack React + Vite + Supabase + Leaflet, 100% gratuit à héberger, mobile-first, PWA installable. Démarrage focalisé sur Rennes mais carte ouverte partout.

État actuel : **v5** (notifications, communauté, audit log, RGPD complet, sécurité durcie). Cf. section "Statut" en bas + [BRANCHING.md](BRANCHING.md) + [docs/FONCTIONNALITES.md](docs/FONCTIONNALITES.md).

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
| Backend               | Supabase (free tier)                                       | PostgreSQL + Auth + Storage + RLS + Edge Functions     |
| State serveur         | TanStack Query                                             | Cache, optimistic updates                              |
| Routing               | React Router v6 + `React.lazy()`                           | Lazy par page                                          |
| Forms                 | react-hook-form + zod                                      | Schemas centralisés dans `src/lib/schemas.ts`          |
| Dates                 | dayjs (locale FR)                                          | Léger, `fromNow()` natif                               |
| Toasts                | react-hot-toast                                            | Stylé via `main.tsx`                                   |
| Photos                | browser-image-compression                                  | Client-side, max 200 Ko / 1024px                       |
| PWA                   | vite-plugin-pwa                                            | Workbox + cache tuiles + Web Push                      |
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

## Architecture

```
src/
  main.tsx                        # entrée : providers + Toaster + Sentry boundary
  App.tsx                         # routes lazy + OfflineBanner + RequireAuth + RequireAdmin
  index.css                       # palette CSS vars + animations + skeleton + pulse-ring

  lib/                            # code pur, sans React
    supabase.ts                   # client typé. NORMALISE l'URL (strip /rest/v1 + slash)
    logger.ts                     # logger central : debug/info/warn/error → console + Sentry
    errors.ts                     # getErrorMessage + isPostgrestError + isUniqueViolation
                                  # + isPermissionDenied + isRateLimitError + isInvalidPassword
    constants.ts                  # magic numbers + NOTIFICATION_* + RATE_LIMITS + CGU_VERSION
    schemas.ts                    # zod : auth + piano + session + event + request + reply
                                  # + changePasswordSchema + passwordConfirmSchema + acceptCgu
    geocoding.ts                  # searchAddress (Photon) + reverseGeocode (Nominatim)
    photo.ts                      # validatePhotoFile + compressPhoto + upload + delete
    distance.ts                   # haversineMeters
    date.ts                       # dayjs FR : fromNow, formatDate, formatDateTime
    utils.ts                      # cn() (clsx + twMerge)
    sentry.ts                     # init + beforeSend scrubber (email + JWT) + ErrorBoundary
    web-push.ts                   # subscribeToPush / unsubscribeFromPush / pushSupported
    session-status.ts             # isSessionActive + sessionRemainingMinutes (pure)
    __tests__/                    # tests Vitest (distance, errors, schemas, date, web-push,
                                  # security-snapshot des policies RLS)

  contexts/
    AuthContext.tsx               # signIn + signUp(needsConfirmation) + signOut + reset
                                  # + resendConfirmation + isAdmin + isSuperadmin
                                  # + safety timer 8s + banned auto-logout
    ThemeContext.tsx              # light/dark, persisté localStorage

  hooks/
    useAuth.ts                    # re-export du context
    usePianos.ts                  # liste + still_there calculé depuis updates
    usePiano.ts                   # détail + usePianoUpdates
    useUsers.ts                   # search + profile + userPianos → renvoie PublicProfile
                                  # (id + pseudo + created_at uniquement, RLS column-restricted)
    useStats.ts                   # nombre total + % en bon état
    useRecentFeed.ts              # ajouts + MAJ + visits + sessions fusionnés chronologiquement
    useCommunityFeed.ts           # passages + sessions sur ±14 jours (onglet Communauté)
    useGeolocation.ts             # navigator.geolocation wrapper
    useOnline.ts                  # online/offline events
    usePianoVisits.ts             # passages d'un piano + auteur + dédup
    usePianoSessions.ts           # sessions d'un piano + classement actif/upcoming/past
    useActiveSessions.ts          # set d'IDs des sessions actives (pulse carte)
    useNotificationPreferences.ts # 5 toggles + push_enabled, optimistic + rollback
    useAdminUsers.ts              # admin_list_users RPC (admin/superadmin gated)
    useAdminReports.ts            # reports non résolus avec piano joint
    useAdminKpis.ts               # 10 count queries en parallèle
    useUserRequests.ts            # useMyRequests (user) + useAdminRequests (admin)
    useEvents.ts                  # events + participants + my participation
    useAuditLog.ts                # journal des actions admin avec filtres

  components/
    ui/                           # Button, Input, Label, Textarea, Dialog, Tabs, Badge,
                                  # Avatar (hash → couleur HSL), EmptyState, Skeleton, Switch
    Map/
      PianoMap.tsx                # carte + clustering + filtres + pulse sur sessions actives
      PianoMarker.tsx             # divIcon SVG : touches piano ou photo, pulse si isActive
      MapFilters.tsx              # qualité × présence × date
      AddPianoFlow.tsx            # modal plein écran : géoloc + drag + photo + doublons
      LocateMeButton.tsx
    Piano/
      PianoActivity.tsx           # section Activité sur PianoPage (passages + sessions)
      VisitButton.tsx + VisitorStack.tsx
      SessionButton.tsx + SessionDialog.tsx + SessionList.tsx
      PianoHistory.tsx            # piano_updates avec auteur + author_pseudo_at_time
      PianoUpdateForm.tsx
      EditPianoForm.tsx
      DeletePianoDialog.tsx
      QualityBadge.tsx
      PianoNavigateButton.tsx     # Plans (iOS) ou Google Maps
      PianoShareButton.tsx        # Web Share API + fallback clipboard
      PianoReportButton.tsx
    Auth/
      LoginForm + SignupForm (avec CGU checkbox + redirect confirm)
      ForgotPasswordForm + ResetPasswordForm
      ConfirmPending.tsx          # /auth/confirm-pending avec bouton resend cooldown
    Settings/
      EditPseudoDialog + ChangePasswordDialog (verify_my_password RPC)
      DeleteAccountDialog (double confirm pseudo + password)
      ExportDataButton (RPC export_my_data complète)
      NotificationPreferences.tsx # 5 toggles + push opt-in
    Community/
      CommunityTab.tsx            # toggle Calendrier / Liste switchable
    Admin/
      KpisTab + UsersTab (ban via password dialog) + RolesTab (superadmin only)
      ReportsTab (force_delete via password dialog) + EventsAdminTab + RequestsAdminTab
      AuditLogTab.tsx             # journal filtrable des actions admin
      NewEventDialog + ReplyDialog
    Requests/
      MyRequestsTab + NewRequestDialog
    Events/
      EventCard + EventsTab
    Layout/
      AppShell (Outlet + NavBar + CookieBanner)
      NavBar + Logo + SplashScreen + OfflineBanner
      CookieBanner.tsx            # bandeau RGPD essentiels uniquement
      RequireAdmin.tsx            # guard /admin/*
    Onboarding/Tutorial.tsx       # 4 slides, persisté localStorage

  pages/                          # toutes lazy via App.tsx
    AuthPage.tsx                  # routes nested login/signup/forgot/reset/confirm-pending
    Dashboard.tsx                 # 4 onglets : Activité / Communauté / Évènements / Mes demandes
    MapPage.tsx                   # PianoMap + bouton "+" + Tutorial
    SearchPage.tsx                # recherche pseudo (PublicProfile)
    SettingsPage.tsx              # Compte + Notifications + Apparence + Admin + RGPD + Session
    UserPage.tsx                  # /user/:pseudo
    PianoPage.tsx                 # /piano/:id (lecture publique + Activité)
    LegalPage.tsx                 # 3 onglets : Mentions / Confidentialité / CGU
    AdminPage.tsx                 # 7 onglets : KPIs / Users / Reports / Events / Requests
                                  # / Audit / Roles (superadmin)

  test/setup.ts                   # jest-dom matchers + cleanup auto + stub matchMedia

  types/database.ts               # type Database (Supabase) + enums + QUALITY_COLORS/LABELS

supabase/
  schema.sql                      # 13 sections : tables + RLS + RPCs + triggers + rate limit
                                  # + audit log + outbox retry + email confirm + RGPD
  functions/
    send-notification/            # Edge Function Deno (Resend + web-push)
      index.ts                    # webhook + re-fetch DB + envoi mail/push + mark sent
      templates.ts                # 5 templates HTML + sanitizeHeader contre injection
      README.md                   # setup webhook + secrets

# Racine
BRANCHING.md                      # stratégie de branche solo + conventional commits
docs/FONCTIONNALITES.md           # référence des features (toutes versions)
eslint.config.js                  # flat config v9 + typescript-eslint + react-hooks v7
commitlint.config.js              # types + subject lowercase + header max 100
vitest.config.ts                  # env jsdom + seuils coverage src/lib/ 70%
.husky/{pre-commit, commit-msg}
.github/workflows/ci.yml          # 3 jobs (quality + build + audit)
.github/{dependabot.yml, pull_request_template.md}
.prettierrc.json + .prettierignore
vercel.json                       # rewrites SPA + CSP + HSTS + COOP/COEP/CORP
```

---

## Conventions

### Logger — toujours via `logger`, jamais `console`

```ts
import { logger } from '@/lib/logger'

logger.debug('scope.action', 'msg', { ctx }) // dev only
logger.info('scope.action', 'msg', { ctx }) // dev only
logger.warn('scope.action', 'msg', { ctx }) // console + Sentry warning
logger.error('scope.action', 'msg', err, { ctx }) // console + Sentry exception
```

Scope = `domaine.action` (ex: `auth.signup`, `piano.add`, `photo.upload`, `geocoding.reverse`, `admin.ban`, `notif.prefs.update`). Filtrable par tag dans Sentry. Seul fichier autorisé à utiliser `console.*` directement : `src/lib/logger.ts` (ESLint override).

### Erreurs — helpers spécialisés selon le contexte

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
  if (isInvalidPassword(err)) {
    toast.error('Mot de passe incorrect')
    return
  }
  if (isRateLimitError(err)) {
    toast.error('Tu vas trop vite, réessaie demain')
    return
  }
  toast.error(getErrorMessage(err, 'Fallback FR'))
}
```

### Validation — zod schemas dans `src/lib/schemas.ts`

Tout formulaire utilise un schema centralisé. Si tu changes une longueur max, change-le ici, pas dans le composant. Schemas en place : `loginSchema`, `signupSchema` (avec `acceptCgu: z.literal(true)`), `forgotPasswordSchema`, `resetPasswordSchema`, `changePasswordSchema`, `passwordConfirmSchema`, `pianoFormSchema`, `pianoUpdateFormSchema`, `reportFormSchema`, `sessionFormSchema`, `eventFormSchema`, `requestFormSchema`, `replyFormSchema`.

### Constantes — aucune magic number dans le code

`src/lib/constants.ts` regroupe : coords Rennes, 50m doublons, 200 Ko photo, regex pseudo, clés localStorage, `NOTIFICATION_CATEGORIES` + `NOTIFICATION_LABELS`, `RATE_LIMITS` (mirror SQL), `CGU_VERSION`, `COMMUNITY_PAST_DAYS` / `COMMUNITY_FUTURE_DAYS`.

### TypeScript — `type` pas `interface` pour Supabase

Supabase ne reconnaît pas les `interface` comme `Record<string, unknown>` (declaration merging). Le client se résout en `never` → `insert()` casse. Toujours déclarer les Row/Insert/Update en `type = {...}`.

### Tailwind — classes longues OK, `cn()` pour les conditionnels

```ts
import { cn } from '@/lib/utils'
className={cn('base classes', isActive && 'active classes')}
```

Prettier + `prettier-plugin-tailwindcss` trient les classes automatiquement au commit.

### Tests — Vitest + Testing Library

Convention : un fichier de test miroir le fichier source dans `__tests__/`.

```ts
// src/lib/__tests__/distance.test.ts
import { describe, expect, it } from 'vitest'
import { haversineMeters } from '@/lib/distance'

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBe(0)
  })
})
```

Couverture cible : **80% sur `src/lib/`** (seuil bloquant en CI), 30% global (informatif). Snapshot des policies RLS dans `security-snapshot.test.ts` — toute modif schema.sql force un diff explicite (mettre à jour avec `npm test -- -u`).

### Conventional commits + branches

Cf. [BRANCHING.md](BRANCHING.md). Format imposé par commitlint au commit-msg hook :

```
<type>(<scope>): <résumé impératif, lowercase, ≤ 100 chars>
```

Types : `feat`, `fix`, `security`, `chore`, `docs`, `test`, `ci`, `perf`, `refactor`, `style`, `build`, `revert`.

Branches : `feat/<slug>`, `fix/<slug>`, `security/<slug>`, etc. Toujours PR vers `main`, **jamais commit direct sur main** (branch protection).

---

## Conventions data (Supabase)

### RLS — tout est protégé

- `profiles` :
  - SELECT : column-level grants (anon + authenticated voient `id, pseudo, created_at` uniquement). Pour lire `role` + `banned_at` : RPC `get_my_profile()` (self) ou `admin_list_users(...)` (admin).
  - UPDATE/INSERT/DELETE : self only (RLS).
- `pianos` : SELECT public (`is_deleted = false`), INSERT auth + check banned, UPDATE/DELETE par créateur.
- `piano_updates` : SELECT public, INSERT auth, **immuable**.
- `piano_reports` : INSERT auth, SELECT par rapporteur OU admin.
- `piano_visits` / `piano_sessions` : SELECT public, INSERT auth + check banned.
- `events` / `event_participants` : SELECT public, INSERT events par admin, join par self avec `event_has_room()`.
- `user_requests` : SELECT par self OR admin, INSERT par self.
- `notification_preferences` / `push_subscriptions` : self only.
- `notifications_outbox` : SELECT admin only (service_role bypasse via Edge Function).
- `rate_limit_buckets` : aucune RLS exposée — accès uniquement via trigger SECURITY DEFINER.
- `audit_log` : SELECT admin only, écriture uniquement via `write_audit_log()` SECURITY DEFINER.
- Storage `piano-photos` : lecture publique, écriture auth, delete par owner.

### Rate limits (BEFORE INSERT trigger `enforce_rate_limit`)

| Action          | Max | Fenêtre |
| --------------- | --- | ------- |
| `piano_create`  | 5   | 24 h    |
| `piano_update`  | 30  | 24 h    |
| `piano_visit`   | 50  | 24 h    |
| `piano_session` | 10  | 24 h    |
| `piano_report`  | 5   | 24 h    |
| `user_request`  | 5   | 7 j     |

Sérialisé par `pg_advisory_xact_lock(hashtext(user_id || action))` → batch INSERT et `Promise.all` ne contournent pas. Erreur `P0001 rate_limit_exceeded` détectée par `isRateLimitError()`.

### RPCs sensibles (toutes SECURITY DEFINER + search_path fixé)

| RPC                                                             | Garde                                                        | Effet                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| `get_my_profile()`                                              | auth                                                         | Lit profil complet du caller                   |
| `admin_list_users(q, filter, lim)`                              | is_admin()                                                   | Liste users (role + banned visible)            |
| `verify_my_password(p)`                                         | auth                                                         | Compare bcrypt côté SQL (pgcrypto)             |
| `set_user_role(target, new_role)`                               | is_superadmin() + self interdit + dernier superadmin protégé | Update role + audit log                        |
| `set_user_banned(target, banned, p_password)`                   | is_admin() + verify_my_password                              | Update banned_at + audit log                   |
| `force_delete_piano(target, p_password)`                        | is_admin() + verify_my_password                              | Soft delete + audit log                        |
| `delete_my_account(p_password)`                                 | auth + verify_my_password                                    | Cascade auth.users                             |
| `resolve_report(report_id)`                                     | is_admin()                                                   | resolved=true + audit log                      |
| `reply_to_request(request_id, reply)`                           | is_admin() + len check                                       | Update + outbox notif + audit log              |
| `export_my_data()`                                              | auth                                                         | jsonb avec les 10 sources de données du caller |
| `write_audit_log(action, target, payload)`                      | aucune (interne, appelée par autres RPCs)                    | INSERT audit_log                               |
| `mark_notification_sent(notif_id, err)`                         | service_role only                                            | Retry/backoff/DLQ outbox                       |
| `list_pending_notifications(lim)` / `purge_old_notifications()` | service_role only                                            | Helpers pg_cron                                |
| `handle_new_user()`                                             | trigger auth.users INSERT                                    | Crée profile avec pseudo + accept_cgu          |
| `is_admin()` / `is_superadmin()` / `is_banned()`                | aucune                                                       | Helpers RLS (pas de récursion)                 |

### Soft delete des pianos

Champ `is_deleted boolean`. Le delete UI met le flag à true. La RLS `pianos_select` filtre `is_deleted = false`. Purge physique = SQL manuel.

### Anonymisation RGPD-cohérente

`piano_updates.updated_by` est `ON DELETE SET NULL` (pas cascade). Snapshot `author_pseudo_at_time` rempli par trigger BEFORE INSERT → l'historique survit aux suppressions de compte.

### "Encore là" calculé client-side

`usePianos` fetch `piano_updates` en parallèle et calcule `still_there` depuis la dernière MAJ. Pas de colonne stockée → pas de race condition de sync.

### Notifications (outbox + Edge Function)

Trigger DB pousse dans `notifications_outbox` (5 kinds : `piano_comment`, `piano_update`, `session_conflict`, `request_reply`, `event_created`). Webhook Supabase POST vers Edge Function `send-notification` (avec header `x-webhook-secret`). La fonction **re-fetch la ligne par id depuis la DB** (ne fait pas confiance au payload), filtre selon `notification_preferences`, envoie Resend + web-push, marque sent via `mark_notification_sent` (backoff exponentiel : 2/4/8/16/32 min, DLQ à la 5e). Purge nightly via pg_cron.

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
npm test -- -u           # update snapshots (after RLS schema change)
```

Pre-commit hook lance automatiquement `lint-staged` (eslint --fix + prettier --write) + `tsc --noEmit`. Commit-msg hook lance commitlint. Pas besoin de penser à `npm run lint` avant le commit.

---

## Setup local (premier checkout)

1. `npm install --legacy-peer-deps`
2. Crée un projet Supabase (free tier, region eu-west-3)
3. `Settings > API` → copie URL et anon key
4. `Authentication > Providers > Email` → **active "Confirm email"** (v5 — le trigger `handle_new_user` gère la création du profile post-confirmation)
5. `Authentication > URL Configuration` → Site URL = ton URL Vercel, Redirect URLs inclut `<URL>/auth/login`
6. `SQL Editor` → exécute [supabase/schema.sql](supabase/schema.sql)
7. (Optionnel mais recommandé) `Database > Webhooks > Create webhook` sur `notifications_outbox` INSERT → Edge Function `send-notification` + header `x-webhook-secret`
8. (Optionnel) `Database > Extensions` → enable `pg_cron` + `pg_net`, puis exécute les `cron.schedule(...)` du commentaire section 13 de schema.sql (retry + purge notifs)
9. `Copy-Item .env.example .env`, remplis :
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   VITE_SENTRY_DSN=                  # optionnel
   VITE_VAPID_PUBLIC_KEY=            # optionnel (push), npx web-push generate-vapid-keys
   ```
10. `npm run dev`

### Setup Edge Function (mails + push)

Cf. [supabase/functions/send-notification/README.md](supabase/functions/send-notification/README.md). Compte Resend gratuit + clés VAPID + secrets Supabase + deploy.

### Setup GitHub (CI + Dependabot)

Push sur GitHub déclenche automatiquement la CI. Pour activer la branch protection sur `main` : cf. [BRANCHING.md](BRANCHING.md) section "Branch protection".

---

## Gotchas connus

### `VITE_SUPABASE_URL` ne doit PAS contenir `/rest/v1`

`supabase-js` rajoute ce suffixe → double `/rest/v1/rest/v1/` → 404. `src/lib/supabase.ts` normalise (strip + warn), mais préfère l'URL nue type `https://xxx.supabase.co`.

### Vite ne recharge pas `.env` à chaud

Toujours redémarrer `npm run dev` après avoir touché `.env`.

### Email confirmation Supabase — DOIT être activée (v5)

⚠️ **Changement par rapport à v1.** En v5, l'email confirmation est obligatoire. Le trigger SQL `handle_new_user` (AFTER INSERT sur `auth.users`) crée le profil côté serveur — donc `auth.uid()` peut être null au moment du signup sans casser quoi que ce soit. Si tu désactives la confirmation, tu casses le flow `/auth/confirm-pending`.

### Nominatim rate limit

1 req/sec en gratuit. Ne JAMAIS l'utiliser pour de l'autocomplete (utiliser Photon). Le reverse-geocode (1 appel à l'ajout d'un piano) est OK.

### Supabase types : `type` obligatoire (pas `interface`)

Voir conventions ci-dessus. Si un `from('table').insert(...)` retourne une erreur "never[]", c'est que `Database['public']` ne satisfait pas `GenericSchema`, probablement à cause d'un `interface`.

### PWA icons absents

`public/pwa-192x192.png` et `public/pwa-512x512.png` doivent être générés (realfavicongenerator.net depuis `public/favicon.svg`). Sans eux, l'icône iOS/Android par défaut sera générique.

### Quota Supabase Storage 1 Go

Compression client agressive (200 Ko/photo) → ~5000 photos. Si dépassement, supprime les photos orphelines via SQL.

### Pause Supabase free après 7 jours d'inactivité

Premier accès = quelques secondes de réveil. Non bloquant mais peut causer un `safety timeout` côté AuthContext (8s).

### commitlint subject lowercase

Le commit-msg hook refuse les sujets avec capitalisation incohérente. Subject doit être **lowercase strict** ou **sentence-case strict** (premier mot capitalisé puis tout lowercase). Les acronymes en milieu (RGPD, CGU, RLS, RPC, CI) cassent → écrire `rgpd`, `cgu`, `rls`, etc. dans le subject. Le body peut être normal.

### Snapshot RLS — `npm test -- -u` après chaque modif schema.sql

Toute modification de policy / trigger / RPC dans `schema.sql` fait diverger le snapshot Vitest. Workflow :

1. Modifier `schema.sql`
2. `npm test` → snapshot diffère
3. Vérifier le diff visuellement (intentionnel ?)
4. `npm test -- -u` pour figer la nouvelle baseline
5. Committer schema.sql + le `.snap` mis à jour

### `--legacy-peer-deps` nécessaire à l'install

Conflit ESLint 9 vs typescript-eslint peer ranges. Sans flag, `npm install` échoue. Documenté dans CI aussi.

### Push notifications iOS

Ne fonctionnent qu'avec PWA installée ("Ajouter à l'écran d'accueil"), pas en onglet Safari classique. Sur Android/desktop ça marche en onglet.

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
- **Pas de SELECT direct sur `profiles` pour lire role/banned_at** → utiliser RPC `get_my_profile()` ou `admin_list_users()`
- **Pas de `signInWithPassword` pour re-auth** → utiliser RPC `verify_my_password()` (sinon rotation session sur tous les devices)
- **Pas de nouvelle RPC sans `set search_path = public`** → le snapshot RLS le check
- **Pas de notification mail/push sans vérifier `notification_preferences`** → soit côté SQL (trigger filtré), soit côté Edge Function

---

## Où trouver quoi rapidement

| Tu cherches…                                | Fichier                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Comment fetcher tous les pianos             | `src/hooks/usePianos.ts`                                                                          |
| Comment valider un formulaire               | `src/lib/schemas.ts`                                                                              |
| La palette de couleurs                      | `src/index.css` (CSS vars `--primary`, etc.)                                                      |
| Les couleurs des badges qualité             | `src/types/database.ts` (`QUALITY_COLORS`)                                                        |
| Le schéma DB / RLS / RPCs                   | `supabase/schema.sql`                                                                             |
| Le flow d'ajout piano                       | `src/components/Map/AddPianoFlow.tsx`                                                             |
| L'auth context (signUp avec confirm)        | `src/contexts/AuthContext.tsx`                                                                    |
| Le client Supabase + normalisation URL      | `src/lib/supabase.ts`                                                                             |
| Comment Sentry est configuré + scrubber PII | `src/lib/sentry.ts`                                                                               |
| Les routes lazy + guards                    | `src/App.tsx`                                                                                     |
| Le tutoriel d'accueil                       | `src/components/Onboarding/Tutorial.tsx`                                                          |
| La logique "encore là"                      | `src/hooks/usePianos.ts`                                                                          |
| La RPC suppression compte                   | `supabase/schema.sql` + `src/components/Settings/DeleteAccountDialog.tsx`                         |
| Le logger                                   | `src/lib/logger.ts`                                                                               |
| Les constantes                              | `src/lib/constants.ts`                                                                            |
| Les notifications mail/push                 | `supabase/functions/send-notification/`                                                           |
| Les préférences notification user           | `src/components/Settings/NotificationPreferences.tsx` + `src/hooks/useNotificationPreferences.ts` |
| Le web push opt-in                          | `src/lib/web-push.ts`                                                                             |
| L'onglet Communauté (Calendrier/Liste)      | `src/components/Community/CommunityTab.tsx`                                                       |
| L'audit log admin                           | `src/components/Admin/AuditLogTab.tsx` + `useAuditLog`                                            |
| Le bandeau cookies                          | `src/components/Layout/CookieBanner.tsx`                                                          |
| La page légale 3 onglets                    | `src/pages/LegalPage.tsx`                                                                         |
| L'export RGPD complet                       | `src/components/Settings/ExportDataButton.tsx` (RPC `export_my_data`)                             |
| Le rate limit + advisory lock               | `supabase/schema.sql` section 11.b                                                                |
| La protection lockout superadmin            | `supabase/schema.sql` fonction `set_user_role`                                                    |
| Le snapshot RLS                             | `src/lib/__tests__/security-snapshot.test.ts` + `__snapshots__/`                                  |
| La stratégie de branche                     | [BRANCHING.md](BRANCHING.md)                                                                      |
| La référence des features                   | [docs/FONCTIONNALITES.md](docs/FONCTIONNALITES.md)                                                |
| La config CI                                | `.github/workflows/ci.yml`                                                                        |
| Les hooks Git                               | `.husky/pre-commit`, `.husky/commit-msg`                                                          |

---

## Statut v5

**v1** : auth (login/signup/forgot/reset/delete/export), carte (markers + clustering + filtres + dark), ajout piano (géoloc/drag/photo/doublons/géocodage), détail + MAJ + historique + édition, recherche pseudo, profil, dashboard, settings, tutoriel, mode sombre, mentions légales, PWA, Sentry, vercel.json.

**v2** : Activité — passages ("J'y suis passé") + sessions de présence ("J'y vais") + pulse animé sur la carte pour sessions actives + feed étendu.

**v3** : Rôles 3 niveaux (user/admin/superadmin), dashboard admin (KPIs, users, reports, events, requests, roles), bannissement, RPCs admin sécurisées.

**v4** : Notifications mail (Resend via Edge Function) + Web Push opt-in + 5 catégories de préférences, onglet Communauté Calendrier/Liste, bandeau cookies RGPD, refonte LegalPage 3 onglets, headers sécurité + CSP, ChangePasswordDialog.

**v5** : Durcissement sécurité (RLS column-level grants sur profiles, rate limit bulletproof avec advisory lock, lockout protection superadmin, re-auth password sur RPCs irréversibles, email confirmation Supabase + trigger handle_new_user, CGU checkbox + accept_cgu_at, audit log admin complet, RGPD export complet + anonymisation cohérente, outbox retry/backoff/purge), infrastructure tests + DX (Vitest + 66 tests dont snapshot RLS, ESLint flat config, Prettier, Husky, commitlint, GitHub Actions CI, Dependabot, BRANCHING.md), scrubber PII Sentry, headers COOP/COEP/CORP.

**Reste à faire (P2/P3)** :

- A.1.2 chiffrement `push_subscriptions` (besoin vault Supabase)
- A.5 CSP nonces (Vercel middleware Edge)
- A.6.3 2FA TOTP admin (Supabase MFA)
- A.6.4 rate limit signup par IP (Edge Function)
- A.7 EXIF strip upload (Edge Function process-photo)
- B.3 component/hook tests (MSW)
- B.4 tests pgTAP RLS via `supabase test db`
- B.5 Playwright e2e golden paths
- PWA PNG icons à générer

Le plan détaillé est dans `C:\Users\enzor\.claude\plans\j-aimerai-cr-er-une-application-indexed-thunder.md` (sections v1 → v5).
