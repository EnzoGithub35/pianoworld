# Conventions — PianoWorld

Document de référence pour les conventions de code, tooling, tests, lint, format, commits. Pour le setup voir [DEVELOPMENT.md](DEVELOPMENT.md). Pour l'architecture voir [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 1. Logger — `src/lib/logger.ts`

Logger central, 67 lignes. **Toute trace passe par lui** ; jamais de `console.*` direct ailleurs.

### Scope convention

Format `domaine.action` (ex : `auth.signup`, `piano.add`, `photo.upload`, `geocoding.reverse`, `admin.ban`, `notif.prefs.update`, `friends.send`, `favorites.toggle`, `search.users`). Le scope se retrouve en tag Sentry → filtrable par domaine.

### 4 niveaux

```ts
import { logger } from '@/lib/logger'

logger.debug(scope, msg, ctx?)  // console.debug — DEV ONLY (isDev guard)
logger.info(scope, msg, ctx?)   // console.info  — DEV ONLY
logger.warn(scope, msg, ctx?)   // console.warn  + Sentry.captureMessage level 'warning'
logger.error(scope, msg, err, ctx?) // console.error + Sentry.captureException avec tag scope
```

`logger.error` wrap les `err` non-`Error` dans `new Error(String(err))` pour que Sentry capture une stack trace cohérente.

### Sanitize PII

`sanitize()` ([src/lib/logger.ts:24-35](../src/lib/logger.ts#L24-L35)) — remplace les `File` par un descripteur `{ _kind, name, size, type }` pour éviter de fuir des blobs binaires dans Sentry.

### Exception ESLint

[src/lib/logger.ts](../src/lib/logger.ts) est le **seul** fichier où `console.*` est autorisé. Override explicite dans [eslint.config.js:76-79](../eslint.config.js#L76-L79) :

```js
{
  files: ['src/lib/logger.ts'],
  rules: { 'no-console': 'off' }
}
```

---

## 2. Errors — `src/lib/errors.ts`

Helpers pour extraire / typer les erreurs Supabase et celles de l'app. **Convention dure** : jamais `err.message` direct sans `instanceof Error` — toujours `getErrorMessage()`.

### API

| Helper                                                                             | Returns   | Usage                                                                                                                  |
| ---------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `getErrorMessage(err, fallback)` ([errors.ts:31-44](../src/lib/errors.ts#L31-L44)) | `string`  | Extrait une string lisible quel que soit le format (Error JS, `PostgrestLikeError` Supabase, payload Photon/Nominatim) |
| `isPostgrestError(err)` ([errors.ts:17-25](../src/lib/errors.ts#L17-L25))          | `boolean` | Type guard, exige `message: string` + `code` présent                                                                   |
| `isUniqueViolation(err)` ([errors.ts:47-49](../src/lib/errors.ts#L47-L49))         | `boolean` | Code Postgres `23505`                                                                                                  |
| `isPermissionDenied(err)` ([errors.ts:52-55](../src/lib/errors.ts#L52-L55))        | `boolean` | Code `42501` ou `PGRST301` (RLS)                                                                                       |
| `isRateLimitError(err)` ([errors.ts:63-69](../src/lib/errors.ts#L63-L69))          | `boolean` | Code `P0001` + message contient `rate_limit_exceeded`                                                                  |
| `isInvalidPassword(err)` ([errors.ts:72-75](../src/lib/errors.ts#L72-L75))         | `boolean` | Message contient `invalid_password`                                                                                    |

### Pattern usage

```ts
try {
  await supabase.rpc('toggle_piano_favorite', { p_piano: pianoId })
} catch (err) {
  if (isInvalidPassword(err)) return toast.error('Mot de passe incorrect')
  if (isRateLimitError(err)) return toast.error('Tu vas trop vite, réessaie plus tard')
  if (isUniqueViolation(err)) return toast.error('Ce pseudo est déjà pris')
  if (isPermissionDenied(err)) return toast.error('Action non autorisée')
  logger.error('favorites.toggle', 'rpc failed', err, { pianoId })
  toast.error(getErrorMessage(err, 'Une erreur est survenue'))
}
```

---

## 3. Validation — zod schemas

Tout schema vit dans [src/lib/schemas.ts](../src/lib/schemas.ts). **Aucun schema inline** dans un component — change la longueur ici et tous les forms suivent.

### Liste exhaustive

| Schema                                          |  Lignes | Notes                                                                   |
| ----------------------------------------------- | ------: | ----------------------------------------------------------------------- | --- | ----- |
| `pseudoSchema`, `emailSchema`, `passwordSchema` |   31-41 | primitives réutilisées                                                  |
| `loginSchema`                                   |   43-46 | email + password                                                        |
| `signupSchema`                                  |   49-56 | + `pseudo` + **`acceptCgu: z.literal(true)`**                           |
| `forgotPasswordSchema`                          |   59-61 | email uniquement                                                        |
| `resetPasswordSchema`                           |   64-72 | password + confirm + refine match                                       |
| `changePasswordSchema`                          | 195-208 | **double refine** : confirm match + différent de l'actuel               |
| `passwordConfirmSchema`                         | 217-219 | confirmation re-auth ban/force-delete/delete-account                    |
| `pianoFormSchema`                               |   83-95 | ajout & édition (address, lat/lng, quality, comment)                    |
| `pianoUpdateFormSchema`                         |  98-111 | append-only, **transform** `comment.trim()                              |     | null` |
| `reportFormSchema`                              | 114-120 | raison ≤ 500 chars                                                      |
| `eventFormSchema`                               | 134-165 | **refine `ends_at > starts_at`**                                        |
| `requestFormSchema`                             | 168-179 | subject + message                                                       |
| `replyFormSchema`                               | 182-188 | reply ≤ 2000 chars                                                      |
| `sessionFormSchema` (v6)                        | 222-244 | **inclut `visibility: z.enum(['public','friends']).default('public')`** |

### v7 PR-B (à venir)

- `profileNamesSchema` — `first_name`/`last_name` optionnels (`.optional().or(z.literal(''))`)
- `emailSearchSchema` — email exact via `z.string().email()`

### Pattern react-hook-form

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { sessionFormSchema, type SessionFormValues } from '@/lib/schemas'

const {
  register,
  handleSubmit,
  formState: { errors, isSubmitting }
} = useForm<SessionFormValues>({
  resolver: zodResolver(sessionFormSchema),
  defaultValues: { visibility: 'public' }
})
```

---

## 4. Constants — `src/lib/constants.ts`

**Aucune magic number dans le code**. Tout vit dans `constants.ts`, organisé par section commentée :

| Section                     |  Lignes | Constants                                                                                                                                                                                                                                                  |
| --------------------------- | ------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carte / coords              |    9-10 | `DEFAULT_MAP_CENTER = [48.1173, -1.6778]` (Rennes), `DEFAULT_MAP_ZOOM = 13`                                                                                                                                                                                |
| Distance                    |      13 | `DUPLICATE_DISTANCE_METERS = 50`                                                                                                                                                                                                                           |
| Champs piano                |   16-18 | `PIANO_COMMENT_MAX`, `PIANO_ADDRESS_MAX`, `REPORT_REASON_MAX = 500`                                                                                                                                                                                        |
| Photo                       |   21-23 | `PHOTO_MAX_SIZE_MB = 0.2`, `PHOTO_MAX_DIMENSION = 1024`, `PHOTO_JPEG_QUALITY = 0.8`                                                                                                                                                                        |
| Pseudo                      |   26-28 | 2-30 chars, regex `^[a-zA-Z0-9_\-.]+$`                                                                                                                                                                                                                     |
| Password                    |      31 | `PASSWORD_MIN_LENGTH = 8`                                                                                                                                                                                                                                  |
| Geocoding                   |      34 | `GEOCODE_AUTOCOMPLETE_LIMIT = 5`                                                                                                                                                                                                                           |
| User search                 |   37-38 | `USER_SEARCH_MIN_CHARS = 2`, `USER_SEARCH_MAX_RESULTS = 20`                                                                                                                                                                                                |
| Recent feed                 |      41 | `RECENT_FEED_LIMIT = 15`                                                                                                                                                                                                                                   |
| Storage keys                |   44-45 | `TUTORIAL_STORAGE_KEY`, `THEME_STORAGE_KEY`                                                                                                                                                                                                                |
| Photo bucket                |      48 | `PHOTO_BUCKET = 'piano-photos'`                                                                                                                                                                                                                            |
| v2 activity                 |   50-71 | `SESSION_DURATION_OPTIONS`, `SESSION_DURATION_MIN/MAX = 5/240`, `SESSION_FUTURE_DAYS_MAX = 7`, `VISITS_DISPLAY_LIMIT`, `VISITORS_HEADLINE_ROTATION_MS = 4000`, `ACTIVE_SESSIONS_STALE_MS = 30_000`                                                         |
| v3 events/requests          |   73-85 | `EVENT_TITLE_MAX = 120`, `EVENT_DESCRIPTION_MAX = 2000`, `EVENT_LOCATION_MAX = 200`, `REQUEST_SUBJECT_MAX = 120`, `REQUEST_MESSAGE_MAX = 2000`, `REQUESTS_LAST_SEEN_KEY`                                                                                   |
| v4 notifications            |  87-157 | `NOTIFICATION_CATEGORIES` (8 entrées post-v6, à étendre à 9 en v7 PR-B), `NOTIFICATION_LABELS`, `NOTIFICATION_SECTION_OF`, `NOTIFICATION_SECTION_LABELS`, `COOKIE_CONSENT_KEY`, `PUSH_OPT_IN_KEY`, `VAPID_PUBLIC_KEY_FALLBACK`, `RATE_LIMITS` (mirror SQL) |
| v6 friends + presence + CGU | 159-191 | `FRIENDS_DISPLAY_LIMIT = 200`, `PRESENCE_AVATAR_STACK_LIMIT = 5`, `PRESENCE_STALE_MS = 30_000`, `SESSION_VISIBILITIES`, `SESSION_VISIBILITY_LABELS`, `COMMUNITY_PAST_DAYS = 7`, `COMMUNITY_FUTURE_DAYS = 14`, `CGU_VERSION = '2026-05-30'`                 |

### `RATE_LIMITS` — mirror SQL

```ts
export const RATE_LIMITS: Record<string, { count: number; windowLabel: string }> = {
  piano_create: { count: 5, windowLabel: '24 h' },
  piano_update: { count: 30, windowLabel: '24 h' },
  piano_visit: { count: 50, windowLabel: '24 h' },
  piano_session: { count: 10, windowLabel: '24 h' },
  piano_report: { count: 5, windowLabel: '24 h' },
  user_request: { count: 5, windowLabel: '7 jours' },
  friend_request: { count: 20, windowLabel: '24 h' }
}
```

**Important** : ce n'est qu'un mirror UX. Le SQL est la **source de vérité** (le frontend l'utilise pour les messages d'erreur "tu as atteint la limite de X / Y"). v7 PR-B doit ajouter `user_search_email: { count: 5, windowLabel: '24 h' }`.

### v7 PR-B (à venir)

- `FIRST_NAME_MAX = 50`, `LAST_NAME_MAX = 50`
- `PIANO_SEARCH_MAX_RESULTS = 30`
- `FAVORITES_DISPLAY_LIMIT = 200`
- `SEARCH_TAB_KEY = 'pianoworld:search-tab'`
- `RATE_LIMITS.user_search_email`

---

## 5. TypeScript — strict mode + `type` pas `interface`

### Strict mode

Activé dans `tsconfig.json`, vérifié par :

- `npx tsc -b --noEmit` en pre-commit ([.husky/pre-commit:2](../.husky/pre-commit))
- CI ([.github/workflows/ci.yml:41](../.github/workflows/ci.yml#L41))

### Règle critique : `type` pas `interface` pour Supabase

Supabase ne reconnaît pas les `interface` comme `Record<string, unknown>` (declaration merging). Le client se résout en `never` → `Database['public']` ne satisfait pas `GenericSchema` → `insert()` casse silencieusement.

**Symptôme** : `from('table').insert(...)` retourne une erreur `never[]`.

**Toujours** déclarer les Row/Insert/Update en `type = {...}` :

```ts
// ✅ OK
export type Piano = { id: string; created_by: string; ... }

// ❌ casse l'inférence Supabase
export interface Piano { id: string; created_by: string; ... }
```

### Imports `type` explicites

`@typescript-eslint/consistent-type-imports` warn (`import type` forcé quand seul un type est importé). Pas critique mais cohérent avec le style du projet.

---

## 6. Tailwind + `cn()`

### `cn()` utility

[src/lib/utils.ts](../src/lib/utils.ts) (7 lignes) :

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Combine `clsx` (conditionnels) et `tailwind-merge` (résolution des conflits utility, ex. `p-2 p-4` → `p-4`).

```tsx
className={cn(
  'base classes',
  isActive && 'active classes',
  variant === 'primary' && 'primary-classes'
)}
```

### Tri automatique au commit

`prettier-plugin-tailwindcss` déclaré dans [.prettierrc.json:9](../.prettierrc.json#L9) trie automatiquement les utility classes au format. Pre-commit hook lance `prettier --write` sur les staged files.

### Palette "bois de piano"

Définie via CSS vars HSL dans `src/index.css`. Couleurs principales :

- `--primary` ambre `#B5651D`
- `--background` crème `#FAF6F1`
- `--card` `#FFFDF9`
- `--foreground` bois sombre `#3F2E20`
- `--border`, `--muted`, `--accent`, `--destructive` cohérents en HSL

Theme switching via `ThemeContext` qui flip `class="dark"` sur `<html>`. `darkMode: 'class'` dans `tailwind.config.js`.

---

## 7. Tests — Vitest 2 + Testing Library

### Config

[vitest.config.ts](../vitest.config.ts) :

- `environment: 'jsdom'` (l. 20)
- `setupFiles: ['./src/test/setup.ts']` (l. 22)
- `globals: true` (l. 21) — `describe`/`it`/`expect` globaux sans import
- Alias `@/` aligné avec `vite.config.ts` (l. 17)
- `css: false` (l. 23) — pas de traitement CSS
- Pattern `src/**/*.{test,spec}.{ts,tsx}` (l. 24)

### Setup file

[src/test/setup.ts](../src/test/setup.ts) (24 lignes) :

- Import `@testing-library/jest-dom/vitest` — matchers (`toBeInTheDocument`, etc.)
- `afterEach(cleanup)` — auto-unmount
- Stub `window.matchMedia` — sinon `ThemeContext` crashe en jsdom (l. 11-23)

### Coverage v8

[vitest.config.ts:36-46](../vitest.config.ts#L36-L46) :

```ts
coverage: {
  provider: 'v8',
  thresholds: {
    'src/lib/**/*.ts': {
      lines: 65, branches: 55, functions: 60, statements: 65
    }
  }
}
```

**Seuils stricts sur `src/lib/`** à 65% lines (objectif 80% à terme, l. 43). Pas de seuil global tant que B.3/B.4/B.5 (component/hook/e2e tests) ne sont pas en place.

### Convention miroir

`src/lib/foo.ts` → `src/lib/__tests__/foo.test.ts`. Fichiers tests existants :

- `distance.test.ts` — haversine + edge cases
- `errors.test.ts` — type guards + getErrorMessage
- `schemas.test.ts` — zod validations
- `date.test.ts` — dayjs FR
- `web-push.test.ts` — pushSupported
- **`security-snapshot.test.ts`** — fige toutes les policies / RPCs / grants / triggers de [supabase/schema.sql](../supabase/schema.sql)

### Workflow snapshot RLS

Toute modification de `schema.sql` fait diverger le snapshot :

1. Modifier `schema.sql`
2. `npm test` → diff
3. **Vérifier le diff visuellement** (intentionnel ?)
4. `npm test -- -u` (ou `npx vitest run --update`) pour figer la baseline
5. Committer `schema.sql` + le `.snap` mis à jour

Le snapshot extrait via regex (4 fonctions dans [security-snapshot.test.ts](../src/lib/__tests__/security-snapshot.test.ts)) :

- `extractPolicies(sql)` — `CREATE POLICY .. FOR (select|update|insert|delete) ... USING/WITH CHECK`
- `extractTriggers(sql)` — `CREATE TRIGGER`
- `extractFunctions(sql)` — `CREATE OR REPLACE FUNCTION`
- `extractGrants(sql)` — `GRANT / REVOKE`

Format snapshot enregistre `table, name, operation, using/withcheck, language, security_definer, grantee, privileges`.

### Run

```bash
npm test                  # vitest run (CI mode)
npm run test:watch        # vitest interactive
npm run test:coverage     # rapport coverage v8
npm test -- -u            # update snapshots
npx vitest run --update   # alternative explicite
```

---

## 8. ESLint flat config — `eslint.config.js`

Format flat ESLint 9+. 87 lignes.

### Plugins

- `js.configs.recommended` + `tseslint.configs.recommended` (l. 32-33)
- **`react-hooks` (eslint-plugin-react-hooks v7)** — exhaustive-deps activé, **nouvelles règles purity** :
  - `react-hooks/purity`, `set-state-in-effect`, `set-state-in-render`, `refs`
  - Toutes en **`'warn'`** (l. 52-55) pour ne pas bloquer le CI sur du code pré-existant
- `react-refresh/only-export-components` warn (l. 56-59)
- `jsx-a11y` — `alt-text`, `anchor-is-valid`, `aria-props`, `role-has-required-aria-props` tous en warn (l. 61-64)

### Severity

| Rule                                 | Severity                                 | Notes                                             |
| ------------------------------------ | ---------------------------------------- | ------------------------------------------------- |
| `@typescript-eslint/no-unused-vars`  | warn                                     | ignore `^_`                                       |
| `@typescript-eslint/no-explicit-any` | warn                                     | pas error pour permettre certains casts edge      |
| `no-console`                         | `['warn', { allow: ['warn', 'error'] }]` | console.log forbidden, console.warn/error tolérés |

### Overrides

| Path                             | Rule                                      |
| -------------------------------- | ----------------------------------------- |
| `src/lib/logger.ts`              | `'no-console': 'off'`                     |
| `**/__tests__/**`, `src/test/**` | `no-explicit-any: off`, `no-console: off` |

### Ignored

[eslint.config.js:20-30](../eslint.config.js#L20-L30) : `dist`, `node_modules`, `.husky`, `coverage`, `supabase/functions/**` (Deno code), configs build (`tailwind.config.js`, `postcss.config.js`, `vite.config.ts`, `vitest.config.ts`).

---

## 9. Prettier

[.prettierrc.json](../.prettierrc.json) (10 lignes) :

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "none",
  "printWidth": 90,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "auto",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

`endOfLine: 'auto'` pour compatibilité CRLF Windows. Plugin Tailwind trie les utility classes automatiquement.

---

## 10. Husky + lint-staged + commitlint

### Pre-commit ([.husky/pre-commit](../.husky/pre-commit))

```sh
npx lint-staged
npx tsc -b --noEmit
```

Toute erreur de type ou de lint bloque le commit avant push.

### lint-staged ([package.json:20-34](../package.json#L20-L34))

```json
{
  "lint-staged": {
    "src/**/*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "src/**/*.{css,md,json}": ["prettier --write"],
    "*.{md,json}": ["prettier --write"],
    ".github/**/*.{yml,yaml,md}": ["prettier --write"]
  }
}
```

### Commit-msg ([.husky/commit-msg](../.husky/commit-msg))

```sh
npx --no-install commitlint --edit "$1"
```

### `commitlint.config.js` (36 lignes)

Étend `@commitlint/config-conventional`. Règles spécifiques :

| Rule                        | Value                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `type-enum` (l. 9-26)       | 12 types : `feat`, `fix`, `security`, `chore`, `docs`, `test`, `ci`, `perf`, `refactor`, `style`, `build`, `revert` |
| `subject-full-stop` (l. 28) | `never` (pas de `.` final)                                                                                          |
| **`subject-case`** (l. 29)  | `['sentence-case', 'lower-case']`                                                                                   |
| `header-max-length` (l. 31) | 100 chars                                                                                                           |
| `scope-case` (l. 33)        | `lower-case`                                                                                                        |

### Gotcha acronymes

`subject-case` casse sur les acronymes en milieu de sujet (`RGPD`, `CGU`, `RLS`, `RPC`, `CI`). **Écrire en lowercase** dans le subject : `rgpd`, `cgu`, `rls`, etc. Le body peut être normal.

✅ `feat(security): add rgpd export with friendships`
❌ `feat(security): add RGPD export with friendships`

---

## 11. Conventional commits + scopes

Format imposé :

```
<type>(<scope>): <résumé impératif, lowercase, ≤ 100 chars>

[body optionnel, multi-ligne ok]

[footer optionnel : Co-Authored-By, Refs, etc.]
```

### Scopes recommandés (cf. [BRANCHING.md](../BRANCHING.md))

`auth`, `piano`, `map`, `community`, `events`, `requests`, `notif`, `friends`, `friendships`, `presence`, `search`, `favorites`, `admin`, `security`, `db`, `ui`, `deps`, `ci`, `docs`, `tests`.

### Exemples

```
feat(friends): add 5-state addfriendbutton with optimistic rollback
fix(piano): harden add/edit forms (anchor, photo rollback, double-submit)
security(rls): column-level grants on profiles + admin_list_users rpc
chore(deps): bump @sentry/react minor
docs(architecture): document v7 search + favorites + transitional state
test(snapshot): regen rls baseline after v7 pr-a
```

---

## 12. Branches — voir [BRANCHING.md](../BRANCHING.md)

Stratégie **GitHub Flow** solo :

- 1 branche `main` toujours déployable + branches `<type>/<short-slug>` éphémères
- Pas de `develop`/`release`/`hotfix`
- Types alignés sur commitlint
- **Squash & merge** par défaut, rebase si commits volontairement atomiques, **jamais de merge commit**
- Branch protection : PR obligatoire, status checks `quality` + `build` requis, linear history, force-push DENY, include administrators ON

---

## 13. Modules utilitaires `src/lib/` — référence rapide

| Module              | Lignes (~) | Purpose                                                 |  Testé  |
| ------------------- | ---------: | ------------------------------------------------------- | :-----: |
| `logger.ts`         |         67 | Logger central debug/info/warn/error → console + Sentry | partiel |
| `errors.ts`         |         76 | 6 helpers : getErrorMessage + 5 type guards             |   ✅    |
| `schemas.ts`        |       250+ | Tous les zod schemas centralisés                        |   ✅    |
| `constants.ts`      |       200+ | Magic numbers / constants par section                   | partiel |
| `supabase.ts`       |        ~30 | Client Supabase typé + normalisation URL                | manuel  |
| `sentry.ts`         |        ~60 | initSentry + beforeSend scrubber PII + ErrorBoundary    |   non   |
| `web-push.ts`       |       150+ | subscribeToPush / unsubscribeFromPush / pushSupported   |   ✅    |
| `geocoding.ts`      |        ~80 | searchAddress (Photon) + reverseGeocode (Nominatim)     |   non   |
| `photo.ts`          |       ~120 | validatePhotoFile + compressPhoto + upload + delete     |   non   |
| `distance.ts`       |        ~30 | haversineMeters                                         |   ✅    |
| `date.ts`           |        ~30 | dayjs FR : fromNow, formatDate, formatDateTime          |   ✅    |
| `utils.ts`          |          7 | cn() (clsx + twMerge)                                   |   n/a   |
| `session-status.ts` |        ~30 | isSessionActive + sessionRemainingMinutes (pures)       |   non   |

### `session-status.ts` — module pur testable

[src/lib/session-status.ts](../src/lib/session-status.ts) expose deux fonctions pures faciles à tester :

```ts
export function isSessionActive(session: {
  starts_at: string
  duration_min: number
}): boolean
export function sessionRemainingMinutes(session: {
  starts_at: string
  duration_min: number
}): number
```

Utilisées par `SessionList`, `PresenceListDialog`, `useActivePianoIds`. À écrire les tests Vitest (backlog).

### `sentry.ts` — scrubber PII

[src/lib/sentry.ts](../src/lib/sentry.ts) — `initSentry()` + `beforeSend` hook qui :

- Strip emails dans messages + stack traces (regex)
- Strip JWT tokens (regex `eyJ[\w-]+\.[\w-]+\.[\w-]+`)
- Strip bearer tokens dans headers
- Strip query strings sensibles (`?token=`, `?access_token=`)

**Critique RGPD** : si on leak des emails users vers Sentry, c'est une violation du DPA.

### `supabase.ts` — normalisation URL

[src/lib/supabase.ts](../src/lib/supabase.ts) normalise `VITE_SUPABASE_URL` : strip trailing `/` + strip suffix `/rest/v1` si présent par erreur. Sans cela, `supabase-js` rajoute encore `/rest/v1` → double `/rest/v1/rest/v1/` → 404.

---

## 14. Workflow d'une feature

Documenté en détail dans le skill `/feature-slice`. Synthèse :

1. **Plan** : `EnterPlanMode` puis décrire approche + ask user
2. **Backend** :
   - Ajouter table + RLS dans `schema.sql` (section appropriée)
   - Si rate-limited → trigger BEFORE INSERT
   - Si destructive → audit_log
   - RPC SECURITY DEFINER si lecture/écriture privilégiée (skill `/rpc-create`)
3. **Types** : Étendre `src/types/database.ts`
4. **Constants** : Ajouter dans `src/lib/constants.ts` (no magic numbers)
5. **Schemas** : Ajouter zod dans `src/lib/schemas.ts`
6. **Hook** : Créer dans `src/hooks/` avec queryKey convention + optimistic + rollback
7. **Component** : Dans le bon `src/components/<domain>/`
8. **Snapshot RLS** : `npm test -- -u` après revue du diff
9. **Test** : Au minimum schema validation Vitest
10. **Quality check** : `/quality-check` (typecheck + lint + test + build)
11. **Commit** : conventional (lowercase subject) + push
12. **Design review** : `/design-review` + `/a11y-audit` avant merge
13. **PR** : squash merge sur main

---

## 15. Anti-patterns interdits

| ❌                                                                             | ✅                                                                                      |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `console.log('...')`                                                           | `logger.debug('scope', '...')`                                                          |
| `err.message` direct                                                           | `getErrorMessage(err)`                                                                  |
| Magic number `if (x > 50)`                                                     | constante dans `constants.ts`                                                           |
| Schema zod inline dans component                                               | `schemas.ts`                                                                            |
| `interface PianoRow {}` pour Supabase                                          | `type PianoRow = {}`                                                                    |
| `console.error(err); throw err` redondant                                      | `logger.error('scope', 'msg', err)` puis `throw err`                                    |
| Migration schema sans toucher `types/database.ts`                              | sync les deux + snapshot RLS                                                            |
| `git commit -m "Update stuff"` direct sur main                                 | branche + PR + conventional commit                                                      |
| `git commit --no-verify`                                                       | fix la cause                                                                            |
| `git push --force` sur main                                                    | jamais (branch protection l'empêche)                                                    |
| `SELECT * FROM profiles WHERE ...` pour role/banned_at                         | RPC `get_my_profile()`, `admin_list_users()`, `search_users()`                          |
| `signInWithPassword` pour re-auth                                              | RPC `verify_my_password()`                                                              |
| RPC sans `set search_path = public`                                            | ajouter — snapshot le check                                                             |
| Notif sans check `notification_preferences`                                    | filtrer côté SQL via JOIN ou côté Edge Function via `KIND_TO_PREF`                      |
| Accès direct `friendships` / `friendship_rejections` / `friend_arriving_dedup` | les 10 RPCs v6                                                                          |
| SELECT direct `piano_sessions` côté client (v6+)                               | RPCs `list_piano_presence` / `get_active_piano_counts` qui appliquent visibility filter |
