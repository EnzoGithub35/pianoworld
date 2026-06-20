# Architecture — PianoWorld

Référence pour comprendre comment l'app est construite : frontend (React + Vite + TanStack), backend (PostgreSQL + Supabase), Edge Function, PWA. Pour la sécurité voir [SECURITY.md](SECURITY.md). Pour les RPCs voir [RPCS.md](RPCS.md). Pour les notifs voir [NOTIFICATIONS.md](NOTIFICATIONS.md).

---

## 1. Entry point — `src/main.tsx`

L'arbre React est monté dans 5 providers, ordre **outer → inner** :

1. `SentryErrorBoundary` avec fallback FR ([src/main.tsx:27](../src/main.tsx#L27))
2. `BrowserRouter` ([src/main.tsx:34](../src/main.tsx#L34))
3. `QueryClientProvider` — `staleTime: 30_000`, `refetchOnWindowFocus: false`, `retry: 1` ([src/main.tsx:15-23](../src/main.tsx#L15-L23))
4. `ThemeProvider` puis `AuthProvider` ([src/main.tsx:36-37](../src/main.tsx#L36-L37))
5. `<App />` + `<Toaster />` montés en frères dans `AuthProvider` ([src/main.tsx:38-55](../src/main.tsx#L38-L55))

`initSentry()` est appelé eagerly au top-level ([src/main.tsx:16](../src/main.tsx#L16)). Le CSS Leaflet est importé dans le chunk lazy `MapPage` via [PianoMap.tsx:6](../src/components/Map/PianoMap.tsx#L6) (`import 'leaflet/dist/leaflet.css'`) — **PAS** dans `main.tsx`. Sprint 10 a déplacé cet import pour économiser ~6 KB gzip sur tous les chunks non-carte (Dashboard, Settings, Auth, Legal).

Toaster stylé via vars HSL (`--popover`, `--border`, `--primary`, `--destructive`) → suit light/dark automatiquement ([src/main.tsx:43-53](../src/main.tsx#L43-L53)).

---

## 2. Routes et guards — `src/App.tsx`

Toutes les pages sont lazy via `React.lazy` + unwrap d'export nommé ([src/App.tsx:15-37](../src/App.tsx#L15-L37)). Le commentaire note que Leaflet est lourd → isoler `MapPage`/`PianoPage` est le gain explicite.

| Path            | Element           | Guard                                                                            | Layout                           | Notes                                                                      |
| --------------- | ----------------- | -------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| `/auth/*`       | `AuthPage`        | aucune (page redirige si `user` existe, sauf sur `/reset` et `/confirm-pending`) | aucune — son propre `AuthLayout` | redirect logic [AuthPage.tsx:137-139](../src/pages/AuthPage.tsx#L137-L139) |
| `/piano/:id`    | `PianoPage`       | aucune — **lecture publique**                                                    | aucune (propre header)           | shareable par URL                                                          |
| `/legal`        | `LegalPage`       | aucune — **publique**                                                            | aucune                           | sub-tabs via URL hash                                                      |
| `/`             | `MapPage`         | `RequireAuth`                                                                    | `AppShell`                       | route racine post-auth                                                     |
| `/dashboard`    | `Dashboard`       | `RequireAuth`                                                                    | `AppShell`                       | 4 tabs (activity, events, favorites, requests)                             |
| `/search`       | `SearchPage`      | `RequireAuth`                                                                    | `AppShell`                       | SearchTabs (Utilisateurs + Pianos) v7 livré                                |
| `/settings`     | `SettingsPage`    | `RequireAuth`                                                                    | `AppShell`                       | inclut EditNamesDialog v7 + ChangePasswordDialog                           |
| `/user/:pseudo` | `UserPage`        | `RequireAuth`                                                                    | `AppShell`                       | AddFriendButton v6                                                         |
| `/friends`      | `FriendsPage`     | `RequireAuth`                                                                    | `AppShell`                       | v7 — page standalone wrap FriendsTab (NavBar 5e icône Users)               |
| `/admin/*`      | `AdminPage`       | `RequireAdmin`                                                                   | aucune (propre header)           | superadmin only roles tab                                                  |
| `*`             | `Navigate to="/"` | n/a                                                                              | n/a                              | catch-all                                                                  |

`RequireAuth` ([src/App.tsx:39-44](../src/App.tsx#L39-L44)) rend `<SplashScreen />` pendant `loading`, redirige vers `/auth` si pas de user. Les routes auth-only sont **nested sous un seul `<Route element={<RequireAuth><AppShell /></RequireAuth>}>`** parent : le shell monte **une seule fois** entre les tab switches (évite NavBar re-mount flash) ([src/App.tsx:56-68](../src/App.tsx#L56-L68)).

`<OfflineBanner />` est monté **hors Suspense** pour rester visible pendant les chargements de chunks lazy ([src/App.tsx:49](../src/App.tsx#L49)).

**Gotcha** : `/piano/:id` et `/legal` sont volontairement publics (no guard, no shell) pour être partageables — mais pas de NavBar. `PianoPage` et `LegalPage` ré-implémentent un header avec bouton retour.

### Guards

- **`RequireAuth`** — 3 états : `loading` → splash, no user → `/auth`, ok → children.
- **`RequireAdmin`** ([src/components/Layout/RequireAdmin.tsx:11-18](../src/components/Layout/RequireAdmin.tsx#L11-L18)) — 4 états : `loading` → splash, no user → `/auth`, no profile → splash, not `isAdmin` → `/` (pas `/auth` puisque déjà loggué).

---

## 3. Shell + NavBar — `src/components/Layout/`

### `AppShell.tsx`

Flex column minimal : `<main flex-1 overflow-hidden pb-16>` wrap `<Outlet />`, puis `<NavBar />`, puis `<CookieBanner />` ([AppShell.tsx:14-22](../src/components/Layout/AppShell.tsx#L14-L22)). `pb-16` réserve l'espace pour la nav bar fixed de 64px. `overflow-hidden` sur `main` → chaque page gère son propre scroll.

`CookieBanner` est volontairement monté **dans AppShell, pas dans App** → il n'apparaît jamais sur `/auth` ou `/legal`. Décision CNIL-friendly ("informer au moment du service").

### `NavBar.tsx`

**5 items** ([NavBar.tsx:7-15](../src/components/Layout/NavBar.tsx#L7-L15)) :

1. `/dashboard` — `LayoutDashboard` — "Activité"
2. `/` — `MapIcon` — "Carte" (`end: true` pour ne pas rester actif sur tous les sous-paths)
3. `/search` — `Search` — "Recherche"
4. `/friends` — `Users` — "Amis" + **Badge `usePendingReceivedCount()`** (v7 Sprint 11)
5. `/settings` — `Settings` — "Paramètres"

Fixed at `inset-x-0 bottom-0 z-50`, `bg-background/95` + `backdrop-blur-md` avec fallback `supports-[backdrop-filter]`, safe-area-bottom via inline `paddingBottom: env(safe-area-inset-bottom)` ([NavBar.tsx:22-23](../src/components/Layout/NavBar.tsx#L22-L23)). État actif : barre primaire top `h-0.5 w-8` + icône `scale-110` ([NavBar.tsx:42-52](../src/components/Layout/NavBar.tsx#L42-L52)).

Le badge sur `/friends` est conditionnel : visible uniquement si `pendingFriends > 0`, affiche "9+" si > 9 ([NavBar.tsx:53-60](../src/components/Layout/NavBar.tsx#L53-L60)). Le badge `newReplyCount` (réponses support) reste dans le trigger du tab "Support" du Dashboard, pas dans NavBar.

---

## 4. Pages

| Page           | File                         | Lazy | Note                                                                                                                                                                                                                                                                                           |
| -------------- | ---------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MapPage`      | `src/pages/MapPage.tsx`      | ✓    | `<PianoMap />` full-bleed + FAB `+` avec `safe-area-inset-bottom` (z-500) + `<Tutorial />`                                                                                                                                                                                                     |
| `Dashboard`    | `src/pages/Dashboard.tsx`    | ✓    | **4 tabs** (`activity`, `events`, `favorites`, `requests`). `?tab=` searchParam deep-link bidirectionnel. Sprint 3 a fusionné Communauté dans Activité via toggle interne. v7 a déplacé Amis → page standalone `/friends` et ajouté Favoris. Badges via localStorage `REQUESTS_LAST_SEEN_KEY`. |
| `FriendsPage`  | `src/pages/FriendsPage.tsx`  | ✓    | **v7 Sprint 11** — page standalone wrappant `<FriendsTab />`. Header avec back-button (cf. Sprint 6 a11y). NavBar 5e icône Users → `/friends`.                                                                                                                                                 |
| `SearchPage`   | `src/pages/SearchPage.tsx`   | ✓    | **v7 SearchTabs** — UserSearchTab (fuzzy pseudo/prénom/nom + EmailSearchDialog) + PianoSearchTab (fuzzy adresse/commentaire). Gate `USER_SEARCH_MIN_CHARS`.                                                                                                                                    |
| `SettingsPage` | `src/pages/SettingsPage.tsx` | ✓    | Sections : compte, EditNamesDialog (v7), notifications (9 toggles), theme, admin link, RGPD, logout. Imports `useFriends`.                                                                                                                                                                     |
| `UserPage`     | `src/pages/UserPage.tsx`     | ✓    | `:pseudo` param. Hooks `useProfileByPseudo` + `useUserPianos`. `<AddFriendButton />` v6.                                                                                                                                                                                                       |
| `PianoPage`    | `src/pages/PianoPage.tsx`    | ✓    | **Public read**. Owner-only edit/delete CTAs. `<PianoPresenceCounter variant="page" />` v6 + `<FavoriteButton />` v7.                                                                                                                                                                          |
| `AuthPage`     | `src/pages/AuthPage.tsx`     | ✓    | Nested sub-routes (`login`, `signup`, `confirm-pending`, `forgot`, `reset`, catchall→`login`). Users déjà loggués bouncent vers `/` **sauf** sur `/reset` et `/confirm-pending` (Supabase recovery links land already-authenticated).                                                          |
| `LegalPage`    | `src/pages/LegalPage.tsx`    | ✓    | **Publique**. 3 sub-tabs (`mentions`, `privacy`, `cgu`) via URL hash. `CookieBanner` deep-link vers `/legal#privacy`.                                                                                                                                                                          |
| `AdminPage`    | `src/pages/AdminPage.tsx`    | ✓    | `RequireAdmin`. 7 onglets en mémoire (KPIs, users, reports, events, requests, audit, **Roles** si superadmin). Tabs **non URL-synced** — backlog C.4.                                                                                                                                          |

---

## 5. State management — TanStack Query

### Conventions de query keys

Format général `[domaine, ...identifiants]` du plus général au plus spécifique :

- **Liste globale** : `['pianos']`, `['global-stats']`, `['recent-feed', limit]`, `['community-feed']`
- **Détail mono-resource** : `['piano', id]`, `['profile', pseudo]`, `['piano-updates', pianoId]`
- **Per-user** : `['my-requests', uid]`, `['my-participations', uid]`, `['notification-preferences', uid]`, `['friends', uid]`
- **Per-user + dimension** : `['friend-requests', uid, direction]`, `['friend-status', uid, targetId]`, `['piano-active-counts', uid, sortedIds]`
- **Filtres dynamiques** : `['admin-users', trimmed, filter]`, `['admin-requests', status]`, `['events', includePast ? 'all' : 'upcoming']`, `['audit-log', action, actorId]`

Préfixes en kebab-case. **Scoping privacy avec l'uid** quand la donnée varie selon le caller (présence v6 visibility-aware, friends).

### Catalogue des hooks (`src/hooks/*`)

| Hook                                                                                                           | Purpose                               | queryKey                                                                                  | staleTime                   | Optimistic        |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------- | ----------------- |
| `usePianos`                                                                                                    | liste + still_there client-side       | `['pianos']`                                                                              | défaut                      | non               |
| `usePiano` + `usePianoUpdates`                                                                                 | détail + historique                   | `['piano', id]` / `['piano-updates', id]`                                                 | défaut                      | non               |
| `useStats`                                                                                                     | KPIs globaux                          | `['global-stats']`                                                                        | défaut                      | non               |
| `useGeolocation`                                                                                               | wrapper navigator (non-TanStack)      | n/a                                                                                       | n/a                         | n/a               |
| `useOnline`                                                                                                    | online/offline event (non-TanStack)   | n/a                                                                                       | n/a                         | n/a               |
| `usePianoVisits`                                                                                               | passages d'un piano (limit 100)       | `['piano-visits', pianoId]`                                                               | défaut                      | non               |
| `usePianoSessions` + `useActivePianoIds`                                                                       | sessions d'un piano + ids actifs      | `['piano-sessions', pianoId]` / `['active-piano-ids']`                                    | 30 s                        | non               |
| `useRecentFeed`                                                                                                | feed unifié home                      | `['recent-feed', limit]`                                                                  | défaut                      | non               |
| `useCommunityFeed`                                                                                             | feed ±14j sessions+visits             | `['community-feed']`                                                                      | 30 s                        | non               |
| `useAdminKpis`                                                                                                 | 11 count queries //                   | `['admin-kpis']`                                                                          | 60 s                        | non               |
| `useAdminReports`                                                                                              | reports non résolus                   | `['admin-reports']`                                                                       | 30 s                        | non               |
| `useAdminUsers`                                                                                                | RPC `admin_list_users`                | `['admin-users', q, filter]`                                                              | 30 s                        | non               |
| `useAuditLog`                                                                                                  | journal admin (limit 200)             | `['audit-log', action, actorId]`                                                          | 10 s                        | non               |
| `useEvents` + `useMyParticipations`                                                                            | events + participations               | `['events', ...]` / `['my-participations', uid]`                                          | 30 s                        | non               |
| `useUserRequests` (Self + Admin)                                                                               | self + admin                          | `['my-requests', uid]` / `['admin-requests', status]`                                     | 30 s                        | non               |
| `useUsers` (3 hooks)                                                                                           | search pseudo + profile + user-pianos | `['users-search', q]` / `['profile', pseudo]` / `['user-pianos', uid]`                    | défaut                      | non               |
| `useNotificationPreferences`                                                                                   | 9 toggles + push                      | `['notification-preferences', uid]`                                                       | 60 s                        | **oui**           |
| **v6** `useFriends` + `useFriendRequests` + `useFriendStatus` + `useFriendActions` + `usePendingReceivedCount` | 3 lectures + 5 mutations              | `['friends', uid]` / `['friend-requests', uid, dir]` / `['friend-status', uid, targetId]` | 30-60 s                     | **oui** (triplet) |
| **v6** `usePianoPresence` (3 hooks)                                                                            | batch count + list par piano          | `['piano-active-counts', uid, ids]` / `['piano-presence-list', uid, pianoId]`             | 30 s + refetchInterval 30 s | non               |

**v7 PR-B (Sprint 11 livré)** a ajouté : `usePianoSearch`, `useEmailSearch`, `useFavorites` (+ `useIsFavorited`, `useToggleFavorite`).

### Pattern optimistic + rollback triplet (cf. `useFriends.ts`)

Toute mutation suit la même structure 4-étapes :

1. **`onMutate`** → `cancelQueries` ciblée + `getQueryData` du snapshot dans un contexte typé `{ prev, … }`
2. Mutation cache locale (filter/set) — **optimistic update**
3. **`onError(_err, _vars, ctx)`** → `setQueryData(prev)` — **rollback**
4. **`onSettled`** → invalidation cascade

Exemple `useFriends.sendRequest` ([useFriends.ts:144-158](../src/hooks/useFriends.ts#L144-L158)) : seul `friend-status` est touché optimistically, mais l'invalidation finale rafraîchit les 3 keys + presence.

### Cache invalidation cascade : predicate vs queryKey

Deux stratégies coexistent :

- **Par préfixe** (90% des cas) — `invalidateQueries({ queryKey: ['friends'] })` matche toutes les sous-clés (`['friends', uid]`). Utilisé pour les keys connues à l'avance.
- **Par predicate** — quand l'invalidation traverse plusieurs _prefixes différents_ dont on ne connaît pas les paramètres. `useFriends.invalidateAll` ([useFriends.ts:116-129](../src/hooks/useFriends.ts#L116-L129)) invalide `piano-presence-count`, `piano-presence-list`, `piano-active-counts` sans connaître ni les uids ni les piano_ids cachés.

```ts
qc.invalidateQueries({
  predicate: (q) =>
    q.queryKey[0] === 'piano-presence-count' ||
    q.queryKey[0] === 'piano-presence-list' ||
    q.queryKey[0] === 'piano-active-counts'
})
```

C'est plus coûteux (scan complet du cache) mais c'est la seule façon de purger une famille hétérogène (les sessions friends-only deviennent visibles à l'accept d'une demande).

---

## 6. Composants — bibliothèque locale

### `ui/` — primitives

Headless-ish, shadcn-flavoured mais maintenus localement. Tous utilisent `cn()` de [src/lib/utils.ts](../src/lib/utils.ts).

- **Button** ([Button.tsx:5-49](../src/components/ui/Button.tsx#L5-L49)) — `forwardRef`, CVA avec 6 `variant`s (`default|destructive|outline|secondary|ghost|link`) et 4 `size`s. Prop `loading?: boolean` → rend `…` + force `disabled`. Focus-visible ring via `ring-offset-background`.
- **Input / Label / Textarea** — `forwardRef`, passthrough des attributs HTML. `Label` a un styling `peer-disabled` pour griser quand l'input voisin est disabled.
- **Dialog** ([Dialog.tsx:4-52](../src/components/ui/Dialog.tsx#L4-L52)) — controlled (`open`, `onClose`, `title`). Listen Escape via `document.addEventListener`. Backdrop = `<button>` fullscreen invisible pour click-to-close. Bottom-sheet sur mobile (`items-end`, `rounded-t-2xl`), centré card sur `sm:`. Honors `env(safe-area-inset-bottom)`. **Pas de focus trap** — gap a11y connu (C.1 backlog).
- **Tabs** ([Tabs.tsx:33-134](../src/components/ui/Tabs.tsx#L33-L134)) — controlled (`value`/`onValueChange`). React `Context` + `useId` pour ARIA : `role="tablist"`, `role="tab"` + `aria-selected` + `aria-controls`, `role="tabpanel"` + `aria-labelledby`. Roving `tabIndex`. **Pas de `ArrowLeft/Right` keyboard handler** — gap a11y connu (C.2 backlog). `TabsList` supporte `scrollable` prop pour overflow horizontal mobile.
- **Badge** ([Badge.tsx:11-40](../src/components/ui/Badge.tsx#L11-L40)) — `Record<variant, string>` (pas CVA) pour 6 variants. Pill `rounded-full px-2 py-0.5 text-[10px]`.
- **Avatar** ([Avatar.tsx:22-63](../src/components/ui/Avatar.tsx#L22-L63)) — **pas d'image, généré** : initiale du pseudo sur gradient HSL déterministe. Hue dérivé de FNV-1a 32-bit hash du pseudo lowercase → même pseudo = même couleur partout. 5 sizes. Prop `ring` pour stack.
- **EmptyState** ([EmptyState.tsx:10-44](../src/components/ui/EmptyState.tsx#L10-L44)) — dashed-border card. Props : icon, title, description?, action? (CTA node). Évite UX dead-ends.
- **Skeleton** — one-liner wrapping `.skeleton` CSS class.
- **Switch** ([Switch.tsx:7-59](../src/components/ui/Switch.tsx#L7-L59)) — `role="switch"`, `aria-checked`. Label + description baked-in.

### Domaines

- **`Auth/`** — LoginForm, SignupForm (avec `acceptCgu` checkbox `z.literal(true)`), ForgotPasswordForm, ResetPasswordForm, ConfirmPending (cooldown 60s).
- **`Map/`** — PianoMap (v6 perf : batch `get_active_piano_counts` au lieu de N queries), PianoMarker (divIcon SVG), MapFilters (qualité × présence × date), AddPianoFlow (géoloc + drag + photo + doublons 50m), LocateMeButton.
- **`Piano/`** — PianoActivity, VisitButton (cooldown 3s), VisitorStack (RotatingHeadline 4s), SessionButton + SessionDialog (visibility `public`/`friends` v6, CTA "ajoute des amis" si N=0), SessionList, **PianoPresenceCounter** + **PresenceListDialog** (v6), PianoHistory (snapshot pseudo), PianoUpdateForm, EditPianoForm (photo rollback), DeletePianoDialog, QualityBadge, PianoNavigateButton (Apple/Google Maps UA sniff), PianoShareButton (Web Share + fallback clipboard), PianoReportButton.
- **`Layout/`** — voir section 3.
- **`Onboarding/`** — Tutorial (4 slides, localStorage flag).
- **`Settings/`** — EditPseudoDialog (UPDATE profiles), ChangePasswordDialog (verify_my_password RPC, **pas signInWithPassword**), DeleteAccountDialog (double confirm), ExportDataButton (RPC export_my_data), NotificationPreferences (9 toggles + push opt-in).
- **`Admin/`** — KpisTab, UsersTab (ban via password dialog), RolesTab (superadmin only, redirige vers UsersTab), ReportsTab (force_delete via password dialog), EventsAdminTab + NewEventDialog, RequestsAdminTab + ReplyDialog, AuditLogTab (5 actions trackées).
- **`Community/CommunityTab.tsx`** — toggle list/calendar, 14 jours horizon (mobile-fit justification).
- **`Events/`** — EventCard (shared user/admin), EventsTab.
- **`Requests/`** — MyRequestsTab (`REQUESTS_LAST_SEEN_KEY` localStorage), NewRequestDialog.
- **`Friends/` v6** — FriendsTab (Dashboard sub-tabs), FriendCard (lien profil + `UserMinus` → RemoveFriendDialog), FriendRequestCard (polymorphic via `direction`), RemoveFriendDialog (confirmation textuelle "retirer" — anti-accident, même pattern que DeleteAccountDialog), AddFriendButton (5 états derivés de `useFriendStatus`). **Known gap** : `AddFriendButton.findPendingId` est un stub retournant null (C.3 backlog) → toast fallback "ouvre dashboard".
- **`Dashboard/ActivityTab.tsx`** — default tab, stats + recent feed.

---

## 7. Backend — Supabase PostgreSQL

### Structure du schema.sql (3173 lignes après v7 + Sprint 7 sécu, 16 sections)

Le fichier est organisé en **15 sections**, mais l'ordre d'exécution est : 1→11 puis 14→15 puis 12→13. La table des matières en tête du fichier le précise.

| Section | Contenu                                                                                                                                                                                                          | Lignes          |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1       | Tables principales (profiles, pianos, piano_updates, piano_reports, piano_visits, piano_sessions)                                                                                                                | 6-61, 167-226   |
| 2       | RLS policies par table                                                                                                                                                                                           | 65-138, 210-227 |
| 3       | Helpers SECURITY DEFINER (`is_admin`, `is_superadmin`, `is_banned`, `event_has_room`)                                                                                                                            | 244-286         |
| 4       | Storage policies bucket `piano-photos`                                                                                                                                                                           | 123-137         |
| 5/6/7   | Events + event_participants + user_requests                                                                                                                                                                      | 410-541         |
| 8       | Triggers et fonctions utilitaires                                                                                                                                                                                | dispersé        |
| 9       | `audit_log` + `write_audit_log()`                                                                                                                                                                                | 1497-1536       |
| 10      | v4 Notifications (preferences, push*subscriptions, outbox, queue*\* triggers)                                                                                                                                    | 547-964         |
| 11      | v5 Durcissement (column-level grants profiles, rate_limit_buckets + enforce_rate_limit, lockout protection, re-auth password, handle_new_user trigger, RGPD anonymisation, export_my_data, retry+backoff outbox) | 1001-1788       |
| 14      | v6 Friendships (tables + helpers + RPCs + piano_sessions.visibility + friend_arriving notif)                                                                                                                     | 1790-2469       |
| 15      | v7 Recherche + favoris (extensions pg_trgm/unaccent, profiles cols, indexes GIN trgm, piano_favorites, notify_favorite_update, 6 RPCs, export étendu)                                                            | 2471-3017       |
| 16      | v7 Sprint 7 sécu — signup IP rate-limit (signup_ip_attempts table + check_signup_ip_allowed RPC + REVOKE ALL + grants service_role)                                                                              | 3018-3173       |
| 12      | Bootstrap superadmin                                                                                                                                                                                             | 3006-3012       |
| 13      | Setup post-déploiement (instructions non-SQL)                                                                                                                                                                    | 3014-3057       |

### Tables principales (synthèse)

| Table                        | PK                                    | RLS SELECT                | Notes                                                                                                     |
| ---------------------------- | ------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `profiles`                   | `id` (ref auth.users)                 | column-grants restreints  | `pseudo, created_at, role, banned_at, accept_cgu_at, accept_cgu_version, first_name (v7), last_name (v7)` |
| `pianos`                     | `id`                                  | `is_deleted=false`        | `created_by, lat, lng, address, comment, quality, photo_url, is_deleted`                                  |
| `piano_updates`              | `id`                                  | public                    | immuable. `updated_by ON DELETE SET NULL`. `author_pseudo_at_time` snapshot                               |
| `piano_reports`              | `id`                                  | own + admin               | rate-limited                                                                                              |
| `piano_visits`               | `id`                                  | public                    | immuable, rate-limited                                                                                    |
| `piano_sessions`             | `id`                                  | visibility-aware (v6)     | `visibility ('public'/'friends')` set-once via trigger BEFORE UPDATE                                      |
| `piano_favorites` (v7)       | `(piano_id, user_id)`                 | self only                 | rate-limit non utilisé (PK dédup)                                                                         |
| `signup_ip_attempts` (v7-S7) | `(ip_hash, attempted_at)`             | REVOKE ALL (service_role) | Sprint 7 sécu — track IP-based signup attempts pour rate-limit 5/24h (RPC `check_signup_ip_allowed`)      |
| `events`                     | `id`                                  | public                    | INSERT/UPDATE/DELETE admin only                                                                           |
| `event_participants`         | `(event_id, user_id)`                 | public                    | INSERT self + `event_has_room()`                                                                          |
| `user_requests`              | `id`                                  | own OR admin              | INSERT self+banned, reply via RPC `reply_to_request`                                                      |
| `notification_preferences`   | `user_id`                             | own                       | auto-créé via trigger sur signup                                                                          |
| `push_subscriptions`         | `id`                                  | own                       | endpoint unique                                                                                           |
| `notifications_outbox`       | `id`                                  | admin only                | trigger DB push, Edge Function consume                                                                    |
| `audit_log`                  | `id` (bigserial)                      | admin only                | INSERT exclusif via `write_audit_log()`                                                                   |
| `rate_limit_buckets`         | `(user_id, action, window_start)`     | aucune (revoke all)       | trigger-only                                                                                              |
| `friendships` (v6)           | `id`                                  | aucune (revoke all)       | canonical `user_a < user_b`                                                                               |
| `friendship_rejections` (v6) | `(requester_id, target_id)`           | aucune                    | cooldown 30j anti-stalking                                                                                |
| `friend_arriving_dedup` (v6) | `(recipient, sender, piano_id, hour)` | aucune                    | dedup horaire notif                                                                                       |

### Triggers exhaustifs

| Trigger                                     | Table          | Fire          | Fonction                                               | Ligne |
| ------------------------------------------- | -------------- | ------------- | ------------------------------------------------------ | ----- |
| `profiles_ensure_notif_prefs`               | profiles       | AFTER INSERT  | `ensure_notification_prefs()`                          | 574   |
| `piano_updates_notify`                      | piano_updates  | AFTER INSERT  | `queue_piano_update_notification()`                    | 707   |
| `piano_sessions_notify_conflict`            | piano_sessions | AFTER INSERT  | `queue_session_conflict_notification()`                | 762   |
| `events_notify`                             | events         | AFTER INSERT  | `queue_event_notifications()`                          | 799   |
| `pianos_rate_limit`                         | pianos         | BEFORE INSERT | `enforce_rate_limit('piano_create','5','24 hours')`    | 1189  |
| `piano_updates_rate_limit`                  | piano_updates  | BEFORE INSERT | `enforce_rate_limit('piano_update','30','24 hours')`   | 1194  |
| `piano_visits_rate_limit`                   | piano_visits   | BEFORE INSERT | `enforce_rate_limit('piano_visit','50','24 hours')`    | 1199  |
| `piano_sessions_rate_limit`                 | piano_sessions | BEFORE INSERT | `enforce_rate_limit('piano_session','10','24 hours')`  | 1204  |
| `piano_reports_rate_limit`                  | piano_reports  | BEFORE INSERT | `enforce_rate_limit('piano_report','5','24 hours')`    | 1209  |
| `user_requests_rate_limit`                  | user_requests  | BEFORE INSERT | `enforce_rate_limit('user_request','5','7 days')`      | 1214  |
| `on_auth_user_created`                      | auth.users     | AFTER INSERT  | `handle_new_user()`                                    | 1376  |
| `piano_updates_pseudo_snapshot`             | piano_updates  | BEFORE INSERT | `fill_pseudo_snapshot()`                               | 1413  |
| `piano_sessions_visibility_immutable` (v6)  | piano_sessions | BEFORE UPDATE | `reject_visibility_update()`                           | 1952  |
| `friendships_rate_limit` (v6)               | friendships    | BEFORE INSERT | `enforce_rate_limit('friend_request','20','24 hours')` | 1991  |
| `piano_sessions_queue_friend_arriving` (v6) | piano_sessions | AFTER INSERT  | `queue_friend_arriving_notification()`                 | 2068  |
| `piano_updates_queue_favorite_notif` (v7)   | piano_updates  | AFTER INSERT  | `queue_favorite_update_notification()`                 | 2601  |

---

## 8. Notifications flow (high-level)

Pattern **outbox transactionnel** :

1. INSERT déclencheur (piano_updates, piano_sessions, events, friendships, ...)
2. Trigger AFTER INSERT push 1+ rows dans `notifications_outbox` (filtre banned/opted-out côté SQL pour minimiser le bruit)
3. Supabase Database Webhook POST → Edge Function `send-notification` avec `x-webhook-secret`
4. Edge Function re-fetch la row par id depuis la DB (ne fait pas confiance au payload webhook)
5. Vérifications additionnelles (banned recipient, prefs, kind-specific re-checks comme `are_friends_safe` à delivery time)
6. Mail Resend + push web-push (selon `push_enabled`)
7. `mark_notification_sent(notif_id, err?)` — succès → `status='sent'`. Erreur → `attempts+=1`, `next_retry_at = now() + 2^attempts min` (2/4/8/16/32). À 5 attempts → `status='permanent_failure'`.

pg_cron jobs :

- `notif-retry */5 * * * *` : POST webhook pour les IDs renvoyés par `list_pending_notifications(50)`
- `notif-purge 17 3 * * *` : `purge_old_notifications()` delete sent/permanent_failure > 30j

Voir [NOTIFICATIONS.md](NOTIFICATIONS.md) pour le détail complet (9 kinds, payloads, templates, push opt-in).

---

## 9. PWA + Service Worker

`vite-plugin-pwa` avec `registerType: 'autoUpdate'`. Workbox génère `dist/sw.js` + `workbox-*.js`. Configuration ajustée v5.1 pour éviter le stale après changement majeur :

- `clientsClaim: true` — SW prend le contrôle au prochain page-load
- `skipWaiting: true` — pas d'attente que tous les tabs ferment
- `cleanupOutdatedCaches: true` — drop des caches précédents
- Stratégies `StaleWhileRevalidate` (vs `CacheFirst`) → bad cache se répare au prochain refetch

Cache différencié dans `vercel.json` : assets `immutable` 1 an, `sw.js` `max-age=0, must-revalidate` (le SW doit être revalidé pour qu'autoUpdate fonctionne).

**iOS push** : ne fonctionne qu'avec PWA installée. Android/desktop OK en onglet.

---

## 10. Edge Function — `send-notification`

[supabase/functions/send-notification/](../supabase/functions/send-notification/)

Code Deno (`@ts-nocheck` car types résolus à l'exécution). 3 fichiers :

- `index.ts` — handler webhook + flow complet (timing-safe secret + re-fetch DB + filtres + mail + push + mark_sent)
- `templates.ts` — 9 templates HTML mobile-first + `sanitizeHeader` anti-CRLF injection + `escapeHtml` + `formatDateFr`
- `README.md` — setup webhook + secrets

Secrets requis (Edge Functions > Secrets) :

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (auto-injectés)
- `WEBHOOK_SECRET` (openssl rand -base64 32)
- `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

Voir [NOTIFICATIONS.md](NOTIFICATIONS.md) pour le détail du flow.

---

## 11. Types Supabase — `src/types/database.ts`

Pattern **`type` pas `interface`** (Supabase declaration merging). Toute table a son `Row`, `Insert`, `Update`. Functions entries pour les RPCs.

Types métier exportés :

- `PianoQuality` + `PIANO_QUALITIES` + `QUALITY_LABELS` + `QUALITY_COLORS` (palette bois)
- `UserRole`, `Profile`, `EventRow`, `EventParticipant`, `UserRequest`, `NotificationPreferences`, `NotificationKind`, `PushSubscription`, `AuditLogEntry`
- `Piano`, `PianoUpdate`, `PianoReport`, `PianoVisit`, `PianoSession`, `PianoSessionVisibility`
- **v6** : `Friendship`, `FriendshipStatus`, `FriendStatus`, `FriendProfile`, `FriendRequest`, `PresenceEntry`, `PianoPresenceCount`
- **v7** : `PianoFavorite`, `UserSearchResult`, `PianoSearchResult`, `FavoriteWithPiano`

---

## 12. CSS et design tokens

- `src/index.css` — palette CSS vars HSL (`--background`, `--foreground`, `--primary`, `--border`, etc.), animations (`@keyframes` pour pulse-ring + slide-up + fade-in + skeleton shimmer), classes utilitaires (`.skeleton`, `.pulse-ring`, `.card-hover`)
- Tailwind config `tailwind.config.js` — mode `darkMode: 'class'` (toggle via `ThemeContext` qui flip `class="dark"` sur `<html>`)
- `cn()` utility ([src/lib/utils.ts](../src/lib/utils.ts)) — `clsx(...) + twMerge` pour résolution conflits
- `prettier-plugin-tailwindcss` trie les utility classes au commit

Design system "Bois de piano" — ambre (`#B5651D`) + crème (`#FAF6F1` / `#FFFDF9`) + bois (`#3F2E20`). Light/dark via CSS vars.
