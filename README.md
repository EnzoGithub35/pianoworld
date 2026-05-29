# PianoWorld

Carte interactive et communautaire des pianos publics. React + Vite + Supabase + Leaflet, 100% gratuit, mobile-first, PWA installable.

## Setup local

### 1. Dépendances

```powershell
npm install
```

### 2. Projet Supabase (gratuit)

1. [supabase.com](https://supabase.com) → New Project
2. Region : `eu-west-3` (Paris)
3. Mot de passe DB fort
4. Settings > API : note **Project URL** et **anon public key**

### 3. Schéma DB

Dans Supabase > **SQL Editor** > New query → colle [`supabase/schema.sql`](./supabase/schema.sql) → **Run**.

Cela crée les tables, la RLS, le bucket Storage `piano-photos`, et la fonction RPC `delete_my_account` (RGPD).

### 4. Désactiver la confirmation email

Supabase > **Authentication > Providers > Email** → décocher **"Confirm email"** → Save.

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

Bundle produit (gzippé) : ~268 Ko total, splitté en 5 chunks (react, leaflet, supabase, query, index) pour bon caching HTTP.

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

## Icônes PWA (avant déploiement public)

Génère deux icônes carrées et place-les dans `public/` :
- `public/pwa-192x192.png`
- `public/pwa-512x512.png`
- `public/favicon.svg` (optionnel)

Tu peux utiliser [realfavicongenerator.net](https://realfavicongenerator.net) ou créer une icône piano simple.

## Stack

| Couche | Choix |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Styles | Tailwind CSS + shadcn-style components |
| Icônes | lucide-react |
| Carte | Leaflet + react-leaflet + tuiles OSM (light) / CARTO (dark) |
| Clustering | react-leaflet-cluster |
| Géocodage | Photon (autocomplete) + Nominatim (reverse) |
| Auth + DB + Storage | Supabase (PostgreSQL + Auth + Storage + RLS) |
| State | TanStack Query |
| Forms | react-hook-form + zod |
| Dates | dayjs (locale FR) |
| Toasts | react-hot-toast |
| Photos | browser-image-compression (max 200 Ko / 1024px) |
| PWA | vite-plugin-pwa (Workbox, cache tuiles offline) |
| Erreurs prod | Sentry (free tier) |
| Hébergement | Vercel |

## Features implémentées

- **Auth** : signup (pseudo unique + email + mdp ≥ 8) sans confirmation email, login, logout, mot de passe oublié, reset, suppression de compte (RGPD), export JSON des données (RGPD)
- **Carte** : Leaflet centré Rennes, tuiles light/dark selon thème, markers photo ou icône piano, clustering, "me localiser", **filtres** (qualité / présence / date)
- **Ajout piano** : géoloc ou drag sur carte, reverse-geocode auto, photo compressée client (max 200 Ko), 6 qualités, commentaire obligatoire, **détection doublon < 50m** non bloquante
- **Détail piano** : photo, badge qualité, commentaire, auteur cliquable, "Y aller" (Plans/Google Maps), "Partager" (Web Share API + fallback clipboard), **historique de toutes les MAJ**, bouton "Mettre à jour" (encore là / nouvelle qualité / commentaire), modif/suppression par le créateur (soft delete)
- **Signaler** un piano (motif libre, stocké en DB)
- **Recherche utilisateurs** par pseudo
- **Profil utilisateur** avec liste de ses pianos
- **Page piano partageable** `/piano/:id` (lecture publique)
- **Dashboard** : stats globales (nombre, % en bon état) + feed des 15 derniers événements (ajouts + MAJ)
- **Settings** : modif pseudo, mode sombre, export RGPD, lien légal, déconnexion, suppression compte
- **Tutoriel d'accueil** 4 slides à la première connexion (stocké en localStorage)
- **PWA installable** : manifest, service worker, cache offline des tuiles OSM/CARTO
- **Mentions légales / RGPD** : page dédiée
- **Sentry** en prod (optionnel)

## Vérifs avant prod

```powershell
npm run build     # doit passer sans warnings rouges
npm run preview   # test du bundle prod en local
```

Tests fonctionnels minimaux :
1. Signup → tutoriel → ajout d'un piano avec photo
2. Logout, signup autre compte → voir le piano du 1er user → cliquer son pseudo
3. Mettre à jour l'état → historique mis à jour
4. Filtrer la carte par qualité / date
5. "Y aller" ouvre Google Maps / Plans
6. "Partager" copie l'URL `/piano/:id`
7. Mode sombre toggle
8. Suppression de compte → cascade complète
9. Export → JSON téléchargé
10. PWA : "Ajouter à l'écran d'accueil" depuis téléphone

## Structure

```
src/
  lib/         supabase, geocoding, photo, distance, date, sentry, utils
  contexts/    AuthContext, ThemeContext
  hooks/       usePianos, usePiano, usePianoUpdates, useUsers, useStats, useRecentFeed, useGeolocation
  components/
    ui/        Button, Input, Label, Textarea, Dialog
    Map/       PianoMap, PianoMarker, AddPianoFlow, LocateMeButton, MapFilters
    Piano/     QualityBadge, PianoHistory, PianoUpdateForm, EditPianoForm, DeletePianoDialog,
               PianoNavigateButton, PianoShareButton, PianoReportButton
    Auth/      LoginForm, SignupForm, ForgotPasswordForm, ResetPasswordForm
    Layout/    AppShell, NavBar
    Settings/  EditPseudoDialog, DeleteAccountDialog, ExportDataButton
    Onboarding/ Tutorial
  pages/       AuthPage, Dashboard, MapPage, SearchPage, SettingsPage, UserPage, PianoPage, LegalPage
  types/       database.ts
supabase/
  schema.sql   schema + RLS + storage + RPC delete_my_account
```
