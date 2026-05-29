# PianoWorld — Guide projet pour Claude

Carte interactive et communautaire des pianos publics. Stack React + Vite + Supabase + Leaflet, 100% gratuit à héberger, mobile-first, PWA installable. Démarrage focalisé sur Rennes mais carte ouverte partout.

---

## Stack

| Couche | Choix | Pourquoi |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Standard, build rapide |
| Styles | Tailwind CSS + composants shadcn-like (locaux) | Mobile-first |
| Icônes | lucide-react | Tree-shake |
| Carte | Leaflet + react-leaflet + OSM tiles (light) / CARTO (dark) | Gratuit illimité |
| Clustering | react-leaflet-cluster | Lisibilité quand >20 markers |
| Géocodage | Photon (autocomplete) + Nominatim (reverse) | Photon pas de rate-limit, Nominatim limité à 1 req/sec |
| Backend | Supabase (free tier) | PostgreSQL + Auth + Storage + RLS, tout-en-un |
| State serveur | TanStack Query | Cache, optimistic updates |
| Routing | React Router v6 + `React.lazy()` | Lazy par page |
| Forms | react-hook-form + zod | Schemas centralisés dans `src/lib/schemas.ts` |
| Dates | dayjs (locale FR) | Léger, `fromNow()` natif |
| Toasts | react-hot-toast | Stylé via `main.tsx` |
| Photos | browser-image-compression | Client-side, max 200 Ko / 1024px |
| PWA | vite-plugin-pwa | Workbox + cache tuiles |
| Erreurs prod | Sentry (`@sentry/react`) | Free tier 5k events/mois |
| Hébergement | Vercel | `vercel.json` configuré |

---

## Architecture

```
src/
  main.tsx                      # entrée : providers + Toaster + Sentry boundary
  App.tsx                       # routes lazy + OfflineBanner + RequireAuth guard
  index.css                     # @import fonts + palette CSS vars + animations + skeleton

  lib/                          # code pur, sans React
    supabase.ts                 # client typé. NORMALISE l'URL (strip /rest/v1 + slash)
    logger.ts                   # logger central : debug/info/warn/error → console + Sentry
    errors.ts                   # getErrorMessage, isPostgrestError, isUniqueViolation
    constants.ts                # magic numbers (Rennes coords, 50m, 200Ko, regex pseudo)
    schemas.ts                  # zod : login/signup/forgot/reset/piano/report/update
    geocoding.ts                # searchAddress (Photon) + reverseGeocode (Nominatim)
    photo.ts                    # validatePhotoFile + compressPhoto + upload + delete
    distance.ts                 # haversineMeters
    date.ts                     # dayjs FR : fromNow, formatDate, formatDateTime
    utils.ts                    # cn() (clsx + twMerge)
    sentry.ts                   # init + ErrorBoundary export

  contexts/
    AuthContext.tsx             # session + signIn/signUp/signOut/resetPassword + safety timer 8s
    ThemeContext.tsx            # light/dark, persisté localStorage

  hooks/
    useAuth.ts                  # re-export du context
    usePianos.ts                # liste + still_there calculé depuis updates
    usePiano.ts                 # détail + usePianoUpdates
    useUsers.ts                 # search + profile + userPianos
    useStats.ts                 # nombre total + % en bon état
    useRecentFeed.ts            # ajouts + MAJ fusionnés chronologiquement
    useGeolocation.ts           # navigator.geolocation wrapper
    useOnline.ts                # online/offline events

  components/
    ui/                         # Button, Input, Label, Textarea, Dialog, EmptyState, Skeleton
    Map/
      PianoMap.tsx              # carte + clustering + filtres + empty state filtré
      PianoMarker.tsx           # divIcon SVG : touches piano ou photo
      MapFilters.tsx            # qualité × présence × date (DEFAULT_FILTERS exporté)
      AddPianoFlow.tsx          # modal plein écran : géoloc + drag + photo + doublons + dirty confirm
      LocateMeButton.tsx        # bouton "me localiser"
    Piano/
      PianoCard.tsx             # (absent — popup gérée dans PianoMap directement)
      PianoHistory.tsx          # liste des piano_updates avec auteur
      PianoUpdateForm.tsx       # form MAJ état
      EditPianoForm.tsx         # modal édition (adresse/photo/qualité/commentaire, pas la position)
      DeletePianoDialog.tsx     # soft delete + suppression photo
      QualityBadge.tsx          # pastille colorée selon quality
      PianoNavigateButton.tsx   # ouvre Plans (iOS) ou Google Maps
      PianoShareButton.tsx      # Web Share API + fallback clipboard
      PianoReportButton.tsx     # signalement en DB
    Auth/                       # LoginForm, SignupForm, ForgotPasswordForm, ResetPasswordForm
    Settings/                   # EditPseudoDialog, DeleteAccountDialog, ExportDataButton
    Layout/                     # AppShell (Outlet + NavBar), NavBar, Logo, SplashScreen, OfflineBanner
    Onboarding/Tutorial.tsx     # 4 slides, persisté localStorage

  pages/                        # toutes lazy via App.tsx
    AuthPage.tsx                # routes nested login/signup/forgot/reset
    Dashboard.tsx               # stats + feed récent
    MapPage.tsx                 # PianoMap + bouton "+" + Tutorial
    SearchPage.tsx              # recherche pseudo
    SettingsPage.tsx
    UserPage.tsx                # /user/:pseudo
    PianoPage.tsx               # /piano/:id (lecture publique)
    LegalPage.tsx               # RGPD

  types/
    database.ts                 # type Database (Supabase) + enums + QUALITY_COLORS/LABELS

supabase/
  schema.sql                    # tables + RLS + storage + RPC delete_my_account
```

---

## Conventions

### Logger — toujours via `logger`, pas `console`

```ts
import { logger } from '@/lib/logger'

logger.debug('scope.action', 'msg', { ctx })   // dev only
logger.info('scope.action', 'msg', { ctx })    // dev only
logger.warn('scope.action', 'msg', { ctx })    // console + Sentry warning
logger.error('scope.action', 'msg', err, { ctx }) // console + Sentry exception
```

Scope = `domaine.action` (ex: `auth.signup`, `piano.add`, `photo.upload`, `geocoding.reverse`). Permet de filtrer par tag dans Sentry.

### Erreurs — `getErrorMessage()` partout dans les forms

```ts
import { getErrorMessage } from '@/lib/errors'

try {
  await doSomething()
} catch (err) {
  toast.error(getErrorMessage(err, 'Fallback FR'))
}
```

Pour détecter une violation d'unicité Postgres (code 23505) : `isUniqueViolation(err)`.

### Validation — zod schemas dans `src/lib/schemas.ts`

Tout formulaire utilise un schema centralisé. Si tu changes une longueur max, change-le ici, pas dans le composant.

### Constantes — aucune magic number dans le code

`src/lib/constants.ts` regroupe : coords Rennes, 50m doublons, 200 Ko photo, regex pseudo, clés localStorage, etc.

### TypeScript — `type` pas `interface`

Supabase ne reconnaît pas les `interface` comme `Record<string, unknown>` (à cause du declaration merging). Le client se résout en `never` → `insert()` casse. Toujours déclarer les Row/Insert/Update en `type = {...}`.

### Tailwind — classes longues OK, `cn()` pour les conditionnels

```ts
import { cn } from '@/lib/utils'
className={cn('base classes', isActive && 'active classes')}
```

### Animations — utilities globales dans `index.css`

`animate-fade-in`, `animate-slide-up`, `animate-slide-up-modal` (mobile), `animate-scale-in` (desktop). Skeleton avec shimmer via `.skeleton`. Hover lift via `.card-hover`.

---

## Conventions data

### Supabase RLS — tout est protégé

- `profiles` : SELECT public (pseudo public), UPDATE/INSERT/DELETE self only
- `pianos` : SELECT public (is_deleted=false uniquement), INSERT auth, UPDATE/DELETE par créateur
- `piano_updates` : SELECT public, INSERT auth, **immuable** (jamais UPDATE/DELETE)
- `piano_reports` : INSERT auth, SELECT par le rapporteur uniquement
- Storage `piano-photos` : lecture publique, écriture authentifiée, delete par owner

### RPC `delete_my_account`

Fonction `security definer` qui supprime `auth.users WHERE id = auth.uid()`. Cascade vers profiles → pianos → piano_updates → piano_reports → photos storage. Appelée par DeleteAccountDialog.

### Soft delete des pianos

Champ `is_deleted boolean`. Le delete UI met le flag à true. Pour purger physiquement, requête DB manuelle. La RLS `pianos_select` filtre `is_deleted = false`.

### "Encore là" calculé client-side

`usePianos` fetch `piano_updates` en parallèle et calcule `still_there` depuis la dernière MAJ. Pas de colonne stockée → pas de race condition de sync.

---

## Commandes

```powershell
npm run dev       # http://localhost:5173
npm run build     # tsc -b + vite build
npm run preview   # serve dist/ en local pour test prod
npx tsc -b        # type check sans build
```

Avant un PR/commit, toujours `npx tsc -b` puis `npm run build`.

---

## Setup local (premier checkout)

1. `npm install`
2. Crée un projet Supabase (free tier, region eu-west-3)
3. Settings > API → copie URL et anon key
4. Authentication > Providers > Email → **décoche "Confirm email"** (signup direct sans email)
5. SQL Editor → exécute `supabase/schema.sql`
6. `Copy-Item .env.example .env`, remplis :
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   VITE_SENTRY_DSN=         # optionnel
   ```
7. `npm run dev`

---

## Gotchas connus

### `VITE_SUPABASE_URL` ne doit PAS contenir `/rest/v1`

Si l'utilisateur copie l'URL REST complète, supabase-js double le suffixe → 404 partout. `src/lib/supabase.ts` normalise (strip + warn), mais idéalement utiliser l'URL nue.

### Vite ne recharge pas `.env` à chaud

Toujours redémarrer `npm run dev` après avoir touché `.env`.

### Email confirmation Supabase

Doit être désactivée dans le dashboard sinon `auth.uid()` est null au moment du profile insert dans `signUp`, ce qui fait échouer la création du profil par RLS.

### Nominatim rate limit

1 req/sec en gratuit. Ne JAMAIS l'utiliser pour de l'autocomplete (utiliser Photon). Le reverse-geocode (1 appel à l'ajout d'un piano) est OK.

### Supabase types : `type` obligatoire (pas `interface`)

Voir conventions ci-dessus. Si un `from('table').insert(...)` retourne une erreur "never[]", c'est que `Database['public']` ne satisfait pas `GenericSchema`, probablement à cause d'un `interface`.

### PWA icons absents

`public/pwa-192x192.png` et `public/pwa-512x512.png` doivent être générés (realfavicongenerator.net depuis `public/favicon.svg`). Sans eux, le manifest est complet mais l'icône iOS/Android par défaut sera générique.

### Quota Supabase Storage 1 Go

Compression client agressive (200 Ko/photo) → ~5000 photos. Si dépassement, supprime les photos orphelines via SQL.

### Pause Supabase free après 7 jours d'inactivité

Premier accès = quelques secondes de réveil. Non bloquant mais peut causer un `safety timeout` côté AuthContext (8s) si le réseau est lent en plus.

---

## Anti-patterns à éviter

- **Pas de `console.log` direct** → utiliser `logger`
- **Pas de `err.message`** sans `instanceof Error` → utiliser `getErrorMessage(err)`
- **Pas de magic number** → `src/lib/constants.ts`
- **Pas de schema zod inline** dans un component → `src/lib/schemas.ts`
- **Pas d'`interface` pour les types Supabase** → toujours `type` (voir gotcha)
- **Pas de `console.error` + `throw`** redondant → `logger.error('scope', 'msg', err)` puis `throw err`, le logger fait déjà la trace
- **Pas de magic CSS dans le JSX** sans raison → ajouter une utility dans `index.css` ou un composant UI
- **Pas de migration de schéma sans toucher `src/types/database.ts`** → les deux doivent rester synchrones

---

## Où trouver quoi rapidement

| Tu cherches… | Fichier |
|---|---|
| Comment fetcher tous les pianos | `src/hooks/usePianos.ts` |
| Comment valider un formulaire | `src/lib/schemas.ts` |
| La palette de couleurs | `src/index.css` (CSS vars `--primary`, etc.) |
| Les couleurs des badges qualité | `src/types/database.ts` (`QUALITY_COLORS`) |
| Le schéma DB / RLS | `supabase/schema.sql` |
| Le flow d'ajout piano | `src/components/Map/AddPianoFlow.tsx` |
| Comment Sentry est configuré | `src/lib/sentry.ts` + `src/main.tsx` |
| Les routes lazy | `src/App.tsx` |
| Le tutoriel d'accueil | `src/components/Onboarding/Tutorial.tsx` |
| La logique "encore là" | `src/hooks/usePianos.ts` (mapping depuis piano_updates) |
| La RPC suppression compte | `supabase/schema.sql` + `src/components/Settings/DeleteAccountDialog.tsx` |
| Le logger | `src/lib/logger.ts` |
| Les constantes | `src/lib/constants.ts` |

---

## Statut v1

Toutes les features du plan initial sont codées : auth (login/signup/forgot/reset/delete/export), carte (markers + clustering + filtres + dark), ajout (géoloc/drag/photo/doublons/géocodage), détail+MAJ+historique+édition, recherche pseudo, profil, dashboard (stats+feed), settings, tutoriel, mode sombre, mentions légales, PWA, Sentry, vercel.json.

Reste : PWA PNG icons à générer, tests automatisés à écrire si besoin, déploiement Vercel à effectuer.

Le plan détaillé est dans `C:\Users\enzor\.claude\plans\j-aimerai-cr-er-une-application-indexed-thunder.md`.
