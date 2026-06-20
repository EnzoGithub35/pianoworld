# PianoWorld

Carte interactive et communautaire des pianos publics. React + Vite + Supabase + Leaflet, 100% gratuit, mobile-first, PWA installable.

## Setup local

### 1. Dépendances

```powershell
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` requis (conflit peer ranges ESLint 9 / typescript-eslint).

### 2. Projet Supabase (gratuit)

1. [supabase.com](https://supabase.com) → New Project
2. Region : `eu-west-3` (Paris)
3. Mot de passe DB fort
4. Settings > API : note **Project URL** et **anon public key**

### 3. Schéma DB

Dans Supabase > **SQL Editor** > New query → colle [`supabase/schema.sql`](./supabase/schema.sql) → **Run**.

Cela crée 19 tables, les policies RLS, triggers, le bucket Storage `piano-photos`, et plus de 35 fonctions/RPCs SECURITY DEFINER (auth, admin, amitiés v6, favoris v7, rate-limit signup IP v7 sécu). Voir [docs/RPCS.md](./docs/RPCS.md) pour le catalogue complet.

### 4. Activer la confirmation email (OBLIGATOIRE)

Supabase > **Authentication > Providers > Email** → cocher **"Confirm email"** → Save.

> ⚠️ **Obligatoire depuis v5**. Le trigger SQL `handle_new_user` (AFTER INSERT sur `auth.users`) crée le profil côté serveur. Sans confirmation email activée, le flow `/auth/confirm-pending` casse.

### 5. Variables d'env

```powershell
Copy-Item .env.example .env
```

Édite `.env` :

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
# Optionnel (laisse vide en dev)
VITE_SENTRY_DSN=
```

### 6. Dev

```powershell
npm run dev
```

→ http://localhost:5173

## Build

```powershell
npm run build
```

Bundle produit (gzippé) : **~270 Ko** total — splitté en ~10 chunks (`index ~28`, `react ~54`, `leaflet ~60`, `supabase ~55`, `photo ~23`, `query ~13`, `schemas ~14`, `MapPage ~9`, `PianoPage ~10`, `Dashboard ~7`). Bon caching HTTP par chunk.

## Déploiement Vercel

### Option A — UI Vercel

1. Push le code sur GitHub
2. [vercel.com](https://vercel.com) → Import GitHub Repo
3. Framework auto-détecté : Vite
4. **Environment Variables** :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SENTRY_DSN` (optionnel)
5. Deploy → URL `pianoworld-xxxx.vercel.app`

### Option B — CLI

```powershell
npm i -g vercel
vercel
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel --prod
```

Le fichier [`vercel.json`](./vercel.json) gère :

- SPA rewrites (toutes les routes → `/`)
- Cache `assets/*` 1 an
- Cache `sw.js` revalidation forcée (pour update PWA)

## Sentry (optionnel)

1. [sentry.io](https://sentry.io) → free tier (5k events/mois)
2. Crée un projet React → copie le DSN
3. Ajoute `VITE_SENTRY_DSN=...` dans `.env` ou Vercel

Sentry s'active **uniquement en prod** (PROD build). En dev, aucun appel réseau.

## E2E & tests locaux (optionnel)

Lancer les tests E2E Playwright contre une Supabase locale Docker :

```powershell
# Prérequis : Docker Desktop, Supabase CLI, psql
npx playwright install chromium
npm run test:e2e:setup    # boot Supabase local + apply schema + seed
npm run test:e2e          # headless
npm run test:e2e:ui       # UI interactif debug
```

Voir [docs/TESTING.md](./docs/TESTING.md) pour la stratégie complète (Vitest unit, pgTAP RLS, Playwright E2E) et [e2e/README.md](./e2e/README.md) pour le détail Playwright.

## Icônes PWA (avant déploiement public)

Génère deux icônes carrées et place-les dans `public/` :

- `public/pwa-192x192.png`
- `public/pwa-512x512.png`
- `public/favicon.svg` (optionnel)

Tu peux utiliser [realfavicongenerator.net](https://realfavicongenerator.net) ou créer une icône piano simple.

## Stack

| Couche              | Choix                                                         |
| ------------------- | ------------------------------------------------------------- |
| Frontend            | React 18 + Vite 6 + TypeScript strict                         |
| Styles              | Tailwind CSS + shadcn-style components                        |
| Icônes              | lucide-react                                                  |
| Carte               | Leaflet + react-leaflet + tuiles OSM (light) / CARTO (dark)   |
| Clustering          | react-leaflet-cluster                                         |
| Géocodage           | Photon (autocomplete) + Nominatim (reverse)                   |
| Recherche full-text | pg_trgm + unaccent (v7)                                       |
| Auth + DB + Storage | Supabase (PostgreSQL + Auth + Storage + RLS + Edge Functions) |
| State serveur       | TanStack Query                                                |
| Forms               | react-hook-form + zod                                         |
| Dates               | dayjs (locale FR)                                             |
| Toasts              | react-hot-toast                                               |
| Photos              | browser-image-compression (max 200 Ko / 1024px)               |
| PWA                 | vite-plugin-pwa (Workbox, cache tuiles offline)               |
| Mails               | Resend + Supabase Edge Function (free tier 3000/mois)         |
| Web Push            | web-push + VAPID + Service Worker (opt-in)                    |
| Erreurs prod        | Sentry (free tier 5k events/mois)                             |
| Tests unit          | Vitest 2 + @testing-library/react                             |
| Tests RLS SQL       | pgTAP 1.3.3 — 88 assertions (Sprint 9)                        |
| Tests E2E           | Playwright 1.61 + Supabase local Docker (Sprint 11)           |
| Hébergement         | Vercel                                                        |

## Features implémentées

**v1-v3 — cœur**

- **Auth** : signup (pseudo unique + email + mdp ≥ 8) **avec confirmation email** (depuis v5), login, mot de passe oublié, reset, **CGU checkbox + accept_cgu_at**, suppression compte avec re-auth password (RGPD), export JSON des données (RGPD)
- **Carte** : Leaflet centré Rennes, tuiles light/dark selon thème, markers photo ou icône piano, clustering, "me localiser", **filtres** (qualité / présence / date)
- **Ajout piano** : géoloc ou drag sur carte, **autocomplete Photon** (Sprint 6) + reverse-geocode Nominatim, photo compressée client (200 Ko, **EXIF strip** Sprint 7), 6 qualités, commentaire, **détection doublon < 50m** non bloquante
- **Détail piano** : photo, badge qualité, commentaire, auteur cliquable, "Y aller", "Partager", **historique de toutes les MAJ**, "Mettre à jour" (encore là / qualité / commentaire), modif/suppression par le créateur
- **Signaler** un piano (motif libre)
- **Dashboard** : 4 onglets (Activité, Évènements, Favoris v7, Support) + stats + feed récent
- **Admin v3** : 3 rôles (user/admin/superadmin), KPIs, users, reports, events, requests, **audit log**
- **PWA installable** + service worker + cache offline tuiles
- **Mentions légales / RGPD** 3 onglets (CGU, confidentialité, mentions)
- **Sentry** en prod (optionnel)

**v4 — notifications & communauté**

- **Notifications mail** (Resend via Edge Function) + **Web Push opt-in** (VAPID)
- **9 catégories** de préférences (5 v4 + 3 v6 amis + 1 v7 favori)
- **Onglet Communauté** Calendrier/Liste (fusionné dans Activité via toggle Sprint 3)
- **Cookies banner** RGPD + headers sécurité + CSP

**v6 — système d'amitié**

- Envoi / acceptation / rejet / annulation de demandes d'amitié bidirectionnelles
- **Cooldown 30j** anti-stalking, ghost-reject silencieux, auto-accept croisé
- **Page Amis** `/friends` (NavBar 5e icône Users) avec sub-tabs (Mes amis, Reçues, Envoyées)
- **Notif `friend_arriving`** : alerte quand un ami démarre un créneau sur un piano
- **Compteur de présence** "X créneau(x) en cours" sur les markers carte
- **Visibility sessions** : public ou friends only

**v7 — recherche & favoris**

- **Recherche unifiée** Users + Pianos (SearchTabs) — fuzzy via pg_trgm (accent-insensitive)
- **Recherche utilisateur par email** (exact match, rate-limit 5/24h anti-énumération)
- **Prénom / nom opt-in** (EditNamesDialog Settings, invisibles via PostgREST direct, accessibles via RPC `search_users`)
- **Favoris pianos** : FavoriteButton (Bookmark), FavoritesTab (Dashboard), notif `piano_favorite_update`
- **NavBar 5e icône** Users → `/friends`

**Sprints audit 6-11 — livrés**

- Sprint 6 UX heuristics (autocomplete, back-button, HelpTooltip)
- Sprint 7 sécu (EXIF strip + signup IP rate-limit 5/24h)
- Sprint 8 wording ("session" → "créneau" face newcomer)
- Sprint 9 tests pgTAP RLS (88 assertions / 7 fichiers + 2 bugs SQL fixés)
- Sprint 10 hygiène (Leaflet CSS lazy + reconnexion toast)
- Sprint 11 Playwright E2E (5 golden paths + Supabase local + nightly CI)

## Scripts disponibles

```powershell
# Dev
npm run dev              # http://localhost:5173
npm run build            # tsc -b + vite build (~25s)
npm run preview          # serve dist/ pour test prod
npm run typecheck        # tsc -b --noEmit

# Lint & format
npm run lint             # eslint .
npm run lint:fix         # eslint . --fix
npm run format           # prettier --write

# Tests
npm test                 # vitest run (80 tests, snapshot RLS bloquant)
npm run test:watch       # vitest interactive
npm run test:coverage    # rapport coverage v8 (seuil 65% sur src/lib/)

# Tests E2E (Sprint 11)
npm run test:e2e:setup   # boot Supabase local + apply schema + seed
npm run test:e2e         # playwright test (headless)
npm run test:e2e:ui      # playwright test --ui (debug)
```

Pre-commit hook lance auto `lint-staged` (eslint --fix + prettier --write) + `tsc --noEmit`. Commit-msg lance `commitlint`. **E2E et pgTAP NON lancés en pre-commit** — manuel ou CI nightly.

## Vérifs avant prod

```powershell
npm run typecheck   # tsc -b --noEmit
npm run lint        # eslint . (0 errors)
npm test            # vitest 80/80 + snapshot RLS aligné
npm run build       # bundle sans warnings rouges
npm run preview     # test du bundle prod en local
```

Tests fonctionnels minimaux (manuels) :

1. Signup → confirmation email → tutoriel → ajout d'un piano avec photo
2. Logout, signup autre compte → voir le piano du 1er user → cliquer son pseudo
3. Mettre à jour l'état → historique mis à jour
4. Filtrer la carte par qualité / date
5. "Y aller" ouvre Google Maps / Plans
6. "Partager" copie l'URL `/piano/:id`
7. Mode sombre toggle
8. Suppression de compte → cascade complète (re-auth password)
9. Export RGPD → JSON téléchargé
10. PWA : "Ajouter à l'écran d'accueil" depuis téléphone
11. Amis (v6) : envoyer demande, accepter, voir présence ami sur carte
12. Favoris (v7) : marquer favori, recevoir notif de MAJ

## Structure

```
src/
  lib/         logger, errors, schemas (zod), constants, supabase, sentry, web-push,
               geocoding, photo, distance, date, utils, session-status
  contexts/    AuthContext (re-exporte useAuth), ThemeContext
  hooks/       usePianos, usePiano, usePianoUpdates, useUsers, useStats, useRecentFeed,
               useGeolocation, useNotificationPreferences (v4),
               useFriends, usePianoPresence (v6),
               usePianoSearch, useEmailSearch, useFavorites (v7)
  components/
    ui/        Button (CVA), Input, Label, Textarea, Dialog, Tabs, Avatar, HelpTooltip, FormError
    Map/       PianoMap (chunk lazy avec leaflet.css), PianoMarker, AddPianoFlow, MapFilters
    Piano/     QualityBadge, PianoHistory, PianoUpdateForm, EditPianoForm, DeletePianoDialog,
               PianoNavigateButton, PianoShareButton, PianoReportButton,
               PianoPresenceCounter (v6), FavoriteButton (v7)
    Auth/      LoginForm, SignupForm, ForgotPasswordForm, ResetPasswordForm, ConfirmPending
    Layout/    AppShell, NavBar (5 items), OfflineBanner, CookieBanner, Logo, SplashScreen
    Settings/  EditPseudoDialog, EditNamesDialog (v7), ChangePasswordDialog,
               DeleteAccountDialog, ExportDataButton, NotificationPreferences
    Admin/     KPIsTab, UsersTab, ReportsTab, EventsTab, RequestsTab, AuditLogTab, RolesTab
    Community/ CommunityTab (Calendrier/Liste)
    Events/    EventsTab, EventCard, EventDialog
    Requests/  MyRequestsTab
    Friends/   FriendsTab, FriendCard, AddFriendButton, RemoveFriendDialog (v6)
    Search/    SearchTabs, UserSearchTab, PianoSearchTab, EmailSearchDialog (v7)
    Dashboard/ ActivityTab, FavoritesTab (v7)
    Onboarding/ Tutorial
  pages/       AuthPage, Dashboard, MapPage, SearchPage, SettingsPage,
               UserPage, FriendsPage (v7), PianoPage, LegalPage, AdminPage
  types/       database.ts (Database + enums + v6/v7 types)

supabase/
  schema.sql                # 3173 lignes, 16 sections (1-11 core, 12 bootstrap, 13 setup,
                            #  14 v6 friendships, 15 v7 search/favoris, 16 v7 sécu signup IP)
  config.toml               # Sprint 11 — Supabase local Docker pour E2E
  functions/
    send-notification/      # Edge Function Deno (Resend + web-push) + 9 templates
    signup-protected/       # Sprint 7 sécu — rate-limit signup par IP
  tests/                    # Sprint 9 — 7 fichiers pgTAP (88 assertions RLS)

e2e/                        # Sprint 11 — Playwright golden paths + fixtures
scripts/
  run-pgtap.ps1             # runner pgTAP local
  setup-e2e-db.ps1          # 1-cmd boot Supabase local + apply schema + seed

docs/                       # docs détaillées (ARCHITECTURE, SECURITY, RPCS,
                            #  NOTIFICATIONS, CONVENTIONS, DEVELOPMENT, TESTING,
                            #  FONCTIONNALITES, POST-DEPLOY)
```

Pour le détail (conventions, gotchas, statut sprints, où trouver quoi), voir [CLAUDE.md](./CLAUDE.md).
