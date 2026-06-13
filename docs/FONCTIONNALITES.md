# PianoWorld — Analyse des fonctionnalités

> Document de référence décrivant **les features** de l'application, leur utilité et leurs enjeux.
> Établi par lecture directe du code (`supabase/schema.sql`, `src/lib/constants.ts`, `src/types/database.ts`, composants et hooks).
>
> ⚠️ **Note d'état** : le `CLAUDE.md` affiche encore « Statut v1 ». Le code réel est en **v4/v5** (communauté, événements, modération, notifications, durcissement sécurité). Ce document reflète l'état réel du code.

**Légende des angles** appliqués à chaque feature :

| Icône | Angle |
|---|---|
| 🎯 | **Produit / utilité** — besoin couvert, valeur utilisateur, place dans le parcours |
| ⚙️ | **Technique / contraintes** — limites, validations, dépendances externes, quotas |
| 🔒 | **Sécurité / RGPD / modération** — RLS, rôles, rate-limit, données personnelles |
| ⚠️ | **Risques / dette / à finir** — non terminé, fragilités, dépendances au free-tier |

---

## 0. Vue d'ensemble

**PianoWorld** est une **carte interactive et communautaire des pianos publics**. L'utilisateur découvre les pianos autour de lui, consulte leur état, et — surtout — **contribue** : il ajoute des pianos, met à jour leur état, signale leur disparition, planifie des sessions de jeu et participe à des événements.

- **Proposition de valeur** : transformer une donnée dispersée (« où sont les pianos en libre accès, et dans quel état ? ») en une carte vivante et fiable, maintenue par la communauté elle-même.
- **Modèle contributif** : la donnée n'est pas maintenue par une équipe centrale mais par les passants. Un piano disparu ou désaccordé est signalé par ceux qui passent devant.
- **Positionnement technique** : 100 % hébergeable sur du **free-tier** (Vercel + Supabase), mobile-first, **PWA installable**, démarrage focalisé sur Rennes mais carte ouverte partout.
- **Stack** : React 18 + Vite + TypeScript, Supabase (PostgreSQL + Auth + Storage + RLS + Edge Functions), Leaflet, TanStack Query, Tailwind, react-hook-form + zod.

Les features sont regroupées par **domaine fonctionnel**. Chaque domaine est annoté des 4 angles ci-dessus.

**Données (13 tables)** : `profiles`, `pianos`, `piano_updates`, `piano_reports`, `piano_visits`, `piano_sessions`, `events`, `event_participants`, `user_requests`, `notification_preferences`, `push_subscriptions`, `notifications_outbox`, `rate_limit_buckets`.

---

## 1. Authentification & compte

### Features
- **Inscription** (email + mot de passe + pseudo unique).
- **Connexion** (email/mot de passe).
- **Mot de passe oublié** (email → lien → nouveau mot de passe).
- **Changement de mot de passe** (utilisateur connecté, avec re-vérification de l'ancien).
- **Déconnexion**.
- **Gestion de session** (restauration au démarrage, multi-onglets, auto-déconnexion si banni).
- **Suppression de compte** (cascade complète, irréversible).
- **Export de données** (RGPD, JSON téléchargeable).
- **Édition du pseudo**.

### Analyse
- 🎯 Le compte est **minimal** (email + pseudo public) pour garder une barrière basse à la contribution. Le pseudo est l'identité publique (profils, auteurs de pianos, avatars de sessions). La lecture de la carte ne nécessite **pas** de compte ; seules les contributions le demandent.
- ⚙️ Règles de validation (`src/lib/schemas.ts`, `src/lib/constants.ts`) :
  - Pseudo **2–30 caractères**, regex `^[a-zA-Z0-9_\-.]+$`.
  - Mot de passe **≥ 8 caractères** (règle maison ; Supabase n'impose rien).
  - Unicité du pseudo : vérif best-effort côté client + garantie par le trigger SQL `handle_new_user` (suffixe `_N` en cas de collision).
  - Le profil complet (avec `role`, `banned_at`) est lu via la RPC **`get_my_profile()`** car ces colonnes sont protégées (cf. § 11).
  - Restauration de session protégée par un **safety timer de 8 s** (`AuthContext`) qui débloque l'UI si le réseau pend.
  - Changement de mot de passe : RPC **`verify_my_password(p)`** (comparaison bcrypt constant-time via pgcrypto) avant `auth.updateUser`.
  - Suppression de compte : RPC **`delete_my_account(p_password)`** (`SECURITY DEFINER`) qui supprime `auth.users` → cascade vers profiles, pianos, updates, visits, sessions, reports, requests, events + photos storage.
- 🔒 La **confirmation email est désactivée** dans Supabase (sinon `auth.uid()` est `null` au moment de l'insert du profil → échec RLS). Les actions destructrices (suppression compte) **re-demandent le mot de passe**. Un utilisateur banni (`banned_at` non nul) est **déconnecté automatiquement** au prochain changement d'état d'auth.
- ⚠️ Confirmation email désactivée = **pas de validation d'adresse** → comptes jetables / faux emails possibles, et un piège pour les notifications email (adresse non vérifiée). Le safety timer 8 s peut se déclencher au premier accès après la **pause Supabase free-tier** (7 j d'inactivité).

---

## 2. Carte & découverte

### Features
- **Carte Leaflet** avec clustering automatique (>20 markers), tuiles OSM (clair) / CARTO (sombre).
- **Markers SVG** personnalisés (touches de piano ou miniature photo, **pulse** si une session est active).
- **Filtres** : qualité × présence (« encore là » / disparu) × fraîcheur (date d'ajout).
- **Géolocalisation** (« me localiser »).
- **Géocodage** : autocomplétion d'adresse (Photon) + reverse-geocoding (Nominatim).
- **Recherche d'utilisateurs** par pseudo.

### Analyse
- 🎯 C'est **le cœur de l'app** : trouver un piano près de soi et filtrer selon l'état, la présence ou la fraîcheur de l'information. Le mode sombre et le clustering servent la lisibilité mobile.
- ⚙️ Détails (`src/components/Map/`, `src/lib/geocoding.ts`, `src/lib/constants.ts`) :
  - Centre par défaut **Rennes `48.1173, -1.6778`**, zoom **13**.
  - **Filtrage entièrement côté client** : tous les pianos non supprimés sont chargés, puis filtrés en mémoire. Le statut « encore là » est recalculé client-side à partir du dernier `piano_update`.
  - **Photon** (autocomplete) : pas de rate-limit, requête ≥ 3 caractères, ≤ 5 résultats.
  - **Nominatim** (reverse) : **1 req/s** maximum → utilisé uniquement à l'ajout d'un piano, jamais pour l'autocomplete ; fallback silencieux vers les coordonnées brutes si indisponible.
  - Recherche utilisateurs : déclenchée à **≥ 2 caractères**, **≤ 20 résultats**.
- 🔒 **Lecture publique** : carte, pianos et profils sont consultables sans compte. La policy `pianos_select` ne renvoie que `is_deleted = false`. La géolocalisation est soumise à l'autorisation navigateur (déclarée dans la `Permissions-Policy` Vercel : `geolocation=(self)`).
- ⚠️ Le **tout-client ne scale pas** : à plusieurs milliers de pianos, charger l'intégralité puis filtrer en mémoire deviendra lourd (pas de fetch par viewport / bounding box). Dépendance à **deux services tiers gratuits** (Photon, Nominatim) **sans SLA** : une panne dégrade l'ajout de piano (mais reste non bloquant grâce au fallback coords).

---

## 3. Cycle de vie d'un piano

### Features
- **Ajout** (`AddPianoFlow`) : géolocalisation + marker draggable + reverse-geocode + photo + **détection de doublon (50 m)** + confirmation si modifications non sauvegardées.
- **Édition** (`EditPianoForm`) : adresse, commentaire, qualité, photo — **mais pas la position**.
- **Suppression** (`DeletePianoDialog`) : **soft delete** (`is_deleted = true`) + suppression photo best-effort.
- **Mise à jour d'état** (`PianoUpdateForm`) : `still_there` (oui/non) + nouvelle qualité optionnelle + commentaire — **immuable**.
- **Calcul « encore là »** : dérivé côté client du dernier `piano_update`.
- **Gestion photo** (`src/lib/photo.ts`) : validation, compression, upload, suppression.
- **Signalement** (`PianoReportButton`) : motif libre.
- **Badges qualité** : 6 niveaux colorés.

### Analyse
- 🎯 C'est le **moteur contributif** de l'app : la donnée reste fraîche parce que **n'importe quel passant** peut mettre à jour l'état, signaler une disparition ou corriger l'info — sans intervention admin. L'historique des mises à jour raconte la « vie » du piano.
- ⚙️ Détails :
  - Adresse et commentaire **≤ 500 caractères** ; motif de signalement **≤ 500**.
  - Photo : input **≤ 20 Mo** → compressée client-side à **≤ 200 Ko / 1024 px / JPEG q0.8** (`browser-image-compression`). Chemin storage `{userId}/{uuid}.jpg`.
  - **Détection de doublon** : distance de Haversine, avertissement **non bloquant** si un piano existe à moins de **50 m**.
  - **Position non éditable** après création (choix de design : éviter qu'un créateur déplace un piano ailleurs).
  - `piano_updates` est **append-only** : le statut « encore là » se calcule depuis le dernier update → pas de colonne stockée, donc **pas de race de synchronisation**.
- 🔒 RLS : INSERT/UPDATE/DELETE d'un piano réservés à son **créateur** ; un utilisateur **banni** ne peut rien insérer. **Rate-limits** (trigger SQL, cf. § 11) : **5 pianos / 24 h**, **30 mises à jour / 24 h**, **5 signalements / 24 h**. Les signalements ne sont visibles que par leur auteur (et les admins).
- ⚠️ **Quota Storage Supabase 1 Go** ≈ 5000 photos (à 200 Ko) → au-delà, il faut purger manuellement. La **suppression de photo est best-effort** (n'échoue pas le delete) → des photos orphelines peuvent subsister. Le **soft delete** conserve la ligne : la purge physique reste une opération SQL manuelle.

---

## 4. Activité communautaire — passages & sessions (v2)

### Features
- **Passage** (« j'y suis passé ») : check-in en un clic, cooldown 3 s anti-spam.
- **Session** : planifier ou signaler qu'on joue (présets *maintenant* / *+30 min* / *+1 h* / personnalisé ; durée 5–240 min ; horizon +7 j).
- **Sessions actives sur la carte** : marker en **pulse**, pile d'avatars (`VisitorStack`, ≤ 5 visibles), titre rotatif (« @x y joue maintenant », rotation 4 s), rafraîchissement 30 s.
- **Feed communauté** (`useCommunityFeed`) : passages + sessions fusionnés, fenêtre **−7 j / +14 j**, vue **liste** ou **calendrier**.

### Analyse
- 🎯 Ces features **donnent vie à la carte** : au-delà de l'annuaire statique, on voit *qui joue ou jouera où*, ce qui crée des **rencontres spontanées** autour des pianos publics. C'est le pivot du passage « annuaire » → « réseau social de proximité ».
- ⚙️ Détails (`src/lib/constants.ts`, `src/hooks/`) :
  - Session : `starts_at ∈ [now − 1 h, now + 7 j]`, durée **∈ [5, 240] min** (présets 15/30/60/90/120).
  - Feed : jusqu'à **300 visites + 300 sessions** chargées, fusionnées en un type unifié, triées chronologiquement. La fin de session active (« encore ~X min ») est calculée côté client.
  - Affichage carte : `VISITS_DISPLAY_LIMIT = 5` avatars, `VISITORS_HEADLINE_ROTATION_MS = 4000`, `ACTIVE_SESSIONS_STALE_MS = 30 000`.
- 🔒 **Rate-limits** : **50 passages / 24 h**, **10 sessions / 24 h**. Le trigger `queue_session_conflict_notification` détecte les chevauchements de session sur un même piano et notifie l'autre joueur (catégorie `notify_session_conflict`).
- ⚠️ **Pas de modération du contenu** des sessions/passages (au-delà du rate-limit). La fenêtre 36 h n'est qu'un **filtre d'affichage** : les anciennes lignes `piano_visits` / `piano_sessions` **ne sont jamais purgées** → croissance continue de ces tables.

---

## 5. Événements (v3)

### Features
- **Création** (admin uniquement) : titre ≤ 120, description ≤ 2000, lieu ≤ 200, date début (+ fin optionnelle), capacité optionnelle.
- **Navigation & participation** : rejoindre / quitter, avatars d'aperçu, statuts *open* / *live* / *full* / *cancelled*.
- **Annulation** (admin) : soft via `cancelled_at`.

### Analyse
- 🎯 Les événements **animent la communauté** par des rendez-vous structurés (concerts, meetups, jam sessions) autour des pianos publics. Ils complètent les sessions spontanées par de l'organisé.
- ⚙️ Détails : `event_has_room(eid)` borne les inscriptions à `max_participants` (illimité si null). Le trigger `queue_event_notifications` prévient **tous les utilisateurs opt-in** (catégorie `notify_events`, hors créateur, hors bannis).
- 🔒 RLS : INSERT/UPDATE/DELETE sur `events` = **admin only**. La participation (`event_participants`) est self, **bloquée si banni ou si l'événement est complet**.
- ⚠️ La création est **réservée aux admins** : pas d'événements communautaires *bottom-up* (un utilisateur lambda ne peut pas créer son meetup). Le broadcast notif touche **tous** les opt-in → le coût (emails Resend) **croît linéairement** avec la base d'utilisateurs.

---

## 6. Demandes utilisateurs — support (v3)

### Features
- **Création d'une demande** : sujet ≤ 120, message ≤ 2000 ; statut `open` → `answered`.
- **Réponse admin** (RPC `reply_to_request`) ; badge « nouvelle réponse » côté utilisateur.
- **Inbox admin** : sous-onglets *à traiter* / *répondues*.

### Analyse
- 🎯 Canal de **feedback / SAV intégré** : l'utilisateur pose une question ou signale un bug sans quitter l'app, et reçoit une réponse in-app (+ notification). Évite un outil externe (email, formulaire tiers).
- ⚙️ Rate-limit **5 demandes / 7 jours**. La réponse admin déclenche une notification `request_reply`. Le badge « nouvelle réponse » compare `replied_at` à une date stockée en **localStorage** (`pianoworld:requests-last-seen`).
- 🔒 RLS : SELECT « **propre ou admin** ». La demande est **immuable** côté utilisateur après création (pas d'édition). La réponse passe par une RPC admin.
- ⚠️ **Pas de fil de discussion** : une seule réponse admin par demande (pas d'aller-retour). Le badge repose sur localStorage → **perdu** si l'utilisateur change d'appareil ou vide son navigateur.

---

## 7. Notifications (v4)

### Features
- **5 catégories de préférences** : `notify_comments`, `notify_piano_updates`, `notify_session_conflict`, `notify_request_reply`, `notify_events`.
- **Opt-in Web Push** séparé (navigateur / mobile).
- **Pipeline outbox** : triggers DB → table `notifications_outbox` → Edge Function `send-notification` → **email (Resend)** + **Web Push**.

### Analyse
- 🎯 Les notifications **ramènent l'utilisateur** dans l'app : commentaire sur son piano, conflit de session, réponse à sa demande, nouvel événement. C'est le principal levier de **rétention** et de bouclage de la boucle communautaire.
- ⚙️ Détails (`supabase/schema.sql`, `src/lib/web-push.ts`, `supabase/functions/send-notification/`) :
  - Préférences auto-créées par le trigger `profiles_ensure_notif_prefs` (tous à `true` sauf `push_enabled = false`), avec backfill côté client pour les comptes legacy.
  - Web Push : clé **VAPID** (`VITE_VAPID_PUBLIC_KEY`), souscription stockée dans `push_subscriptions` (endpoint + p256dh + auth) ; **nettoyage automatique** des souscriptions expirées (404/410).
  - **Edge Function `send-notification`** (Deno) : déclenchée par webhook sur INSERT dans `notifications_outbox`. **Idempotente** (skip si `sent_at` déjà rempli), **re-fetch des données en base** (jamais de confiance dans le payload du webhook → anti-injection), `escapeHtml` + `sanitizeHeader` (anti-XSS et anti-injection d'en-têtes mail).
  - **Resend** : 3000 mails/mois, **100/jour** en gratuit.
- 🔒 Le webhook est **fail-closed** : sans l'en-tête `x-webhook-secret`, la fonction renvoie **403**. La fonction utilise le `service_role` pour lire profil + email. Avant tout envoi, elle **respecte l'opt-out** de la catégorie et **vérifie le bannissement**.
- ⚠️ **Pas de mécanisme de retry** : si un envoi échoue, l'erreur est stockée dans `notifications_outbox.error` et il faut **ré-insérer manuellement** (pas de cron de retry en v1). En **mode test Resend** (domaine `onboarding@resend.dev`), l'envoi est **limité à sa propre adresse** → pas utilisable en prod sans domaine vérifié (SPF/DKIM/DMARC). **iOS** exige la **PWA installée** pour recevoir du push. Les tables `notifications_outbox` et `rate_limit_buckets` **grossissent sans purge**.

---

## 8. Administration & modération

### Features
- **Rôles** : `user` / `admin` / `superadmin`.
- **Dashboard `/admin`** (protégé par `RequireAdmin`).
- **KPIs** : 11 compteurs en parallèle (users, admins, nouveaux 7j/30j, bannis, pianos actifs, ajouts 7j, passages, sessions actives 24h, signalements ouverts, demandes ouvertes).
- **Gestion des utilisateurs** : recherche + filtre (tous / admins / bannis), ban/unban (avec mot de passe), promote/demote (superadmin).
- **Signalements** : *classer* (`resolve_report`) ou *supprimer le piano* (`force_delete_piano`, avec mot de passe).
- **Événements admin**, **demandes admin**, **onglet rôles** (superadmin).

### Analyse
- 🎯 La modération permet de **garder la carte propre** (faux pianos, photos inappropriées) et la **communauté saine** (bannir les abuseurs), le tout **sans accès direct à la base** — l'opérateur travaille depuis l'UI.
- ⚙️ Toutes les opérations sensibles passent par des **RPC `SECURITY DEFINER`** : `admin_list_users(q, filter, lim)`, `set_user_role`, `set_user_banned`, `force_delete_piano`, `resolve_report`, `reply_to_request`. Le rôle réel est lu via `get_my_profile()`.
- 🔒 Les actions destructrices (**ban**, **force-delete**) **re-demandent le mot de passe** de l'admin. **Protection anti-lockout** : impossible de rétrograder le **dernier superadmin** ou de **bannir un superadmin**. Le superadmin de bootstrap est `enzo.reine35@gmail.com`.
- ⚠️ **Pas de journal d'audit** des actions admin (qui a banni qui, quand). La modération est **humaine et manuelle** : aucune automatisation anti-abus au-delà du rate-limit (pas de détection de spam/contenu).

---

## 9. Légal / RGPD / consentement

### Features
- **Bandeau cookies** (`CookieBanner`) : cookies essentiels uniquement, **pas de bouton « refuser »** (rien à refuser), persistance localStorage.
- **Page légale** (`/legal`) : Mentions légales / Confidentialité / CGU (deep-linkable).
- **Export de données** (JSON) et **suppression de compte** (cascade) — déjà décrits au § 1.

### Analyse
- 🎯 Conformité **RGPD** et **confiance** : transparence sur les données collectées et les sous-traitants, droits utilisateurs accessibles directement depuis les Settings.
- ⚙️ Sous-traitants déclarés : **Supabase** (auth/DB/storage), **Vercel** (hébergement), **Sentry** (logs d'erreur). Les droits d'accès / rectification / suppression sont câblés (édition pseudo, export JSON, suppression compte).
- 🔒 **Aucun tracking ni publicité** ; seuls des cookies/localStorage essentiels (session, préférences). Données personnelles **minimales** : email (auth), pseudo (public), contenus (pianos, commentaires, sessions).
- ⚠️ **Hébergement potentiellement hors-UE** à surveiller (mention Vercel/USA dans la page légale) au regard du RGPD. Le **consentement est en localStorage uniquement** : pas de registre serveur des consentements (acceptable vu l'absence de tracking, mais à documenter).

---

## 10. PWA & offline

### Features
- **Manifest** standalone (installable iOS/Android).
- **Cache des tuiles** (Workbox) : OSM + CARTO, *CacheFirst*, 200 entrées / 30 j.
- **Mise à jour automatique** du service worker (`registerType: autoUpdate`).
- **Bandeau hors-ligne** (`OfflineBanner` + `useOnline`).

### Analyse
- 🎯 Expérience proche du **natif** : l'app s'installe sur l'écran d'accueil, et la carte reste consultable **hors-ligne** pour les tuiles déjà vues. Important pour un usage en mobilité (rue, transports).
- ⚙️ Les **en-têtes Vercel** distinguent le cache des assets (`immutable`, 1 an) du service worker (`no-cache`). La **CSP** whiteliste précisément les sources nécessaires (tuiles OSM/CARTO, Supabase, Sentry, Resend, Photon, Nominatim).
- ⚠️ **Icônes PWA PNG non générées** (`pwa-192x192.png` / `pwa-512x512.png`) → icône **générique** à l'installation (dette connue, signalée dans le `CLAUDE.md`). `useOnline` détecte la **connectivité réseau du navigateur**, pas la disponibilité réelle du serveur (un Supabase en pause apparaît « en ligne »).

---

## 11. Sécurité transversale (synthèse)

Tableau des mécanismes qui s'appliquent à **toutes** les features ci-dessus :

| Mécanisme | Détail | Enjeu |
|---|---|---|
| **RLS systématique** | Lecture publique ciblée (pianos non supprimés, profils publics) ; écriture self / owner / admin selon la table | Pas de fuite ni d'écriture non autorisée même si le client est compromis |
| **Rate-limiting par trigger** | `enforce_rate_limit()` + `pg_advisory_xact_lock` par (user, action), comptage dans `rate_limit_buckets` | Corrige le **bypass parallèle** de l'ancien `within_rate_limit()` (STABLE → même snapshot pour des inserts simultanés) |
| **Column-level security** | `profiles` n'expose que `id, pseudo, created_at` ; `role` / `banned_at` lus via RPC `get_my_profile` / `admin_list_users` | Empêche l'**énumération** des admins et des bannis |
| **Re-vérification mot de passe** | Sur `delete_my_account`, `set_user_banned`, `force_delete_piano` (RPC `verify_my_password`) | Un token volé à courte durée de vie **ne suffit pas** pour un dégât permanent |
| **Bannissement** | `is_banned(auth.uid())` dans **tous** les INSERT + auto-déconnexion | Un utilisateur banni ne peut **plus rien créer** |
| **En-têtes / CSP** | `vercel.json` : HSTS preload, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` restrictive, CSP complète | Réduit XSS, clickjacking, sniffing, fuites referrer |
| **Webhook notif fail-closed** | 403 sans `x-webhook-secret` ; re-fetch DB (anti-injection payload) | L'envoi de notifications n'est pas déclenchable par un tiers |

**Enjeu global** : le socle sécurité est **solide pour une app de cette taille**. Points d'attention résiduels : confirmation email désactivée (§ 1) et absence de journal d'audit admin (§ 8).

---

## 12. Observabilité & qualité de code

- **Logger central** (`src/lib/logger.ts`) : `debug`/`info` en dev uniquement ; `warn`/`error` → console **+ Sentry**. Scope `domaine.action` (ex. `auth.signup`, `piano.add`) pour filtrer dans Sentry. Sanitize les objets `File` avant log.
- **Sentry** (`src/lib/sentry.ts`, `main.tsx`) : `ErrorBoundary` racine, 10 % de traces, replays désactivés, actif en prod seulement (DSN optionnel).
- **Utilitaires d'erreur** (`src/lib/errors.ts`) : `getErrorMessage`, `isUniqueViolation` (23505), `isRateLimitError` (P0001), `isInvalidPassword`, `isPermissionDenied` — utilisés dans tous les formulaires pour des messages FR cohérents.

🎯 Permet de **diagnostiquer en prod** sans logs verbeux. ⚠️ Sentry free-tier = **5000 events/mois** (à surveiller si pic d'erreurs).

---

## 13. Annexes — tableaux de référence

### Rate-limits (source : trigger SQL, miroir dans `RATE_LIMITS`)

| Action | Limite |
|---|---|
| Création de piano | 5 / 24 h |
| Mise à jour d'état | 30 / 24 h |
| Passage (visite) | 50 / 24 h |
| Session | 10 / 24 h |
| Signalement | 5 / 24 h |
| Demande support | 5 / 7 jours |

### Limites de champs

| Champ | Limite |
|---|---|
| Adresse / commentaire piano / motif signalement | 500 caractères |
| Pseudo | 2–30 caractères (`^[a-zA-Z0-9_\-.]+$`) |
| Mot de passe | ≥ 8 caractères |
| Événement (titre / description / lieu) | 120 / 2000 / 200 |
| Demande (sujet / message) | 120 / 2000 |
| Photo | ≤ 200 Ko, 1024 px, JPEG q0.8 (input ≤ 20 Mo) |
| Session | durée 5–240 min, horizon +7 j |

### Niveaux de qualité (`src/types/database.ts`)

| Clé | Label | Couleur |
|---|---|---|
| `neuf` | Neuf | `#16a34a` |
| `bon_etat` | Bon état | `#84cc16` |
| `potable` | Potable | `#ca8a04` |
| `desaccorde` | Désaccordé | `#ea580c` |
| `desastreux` | Désastreux | `#b91c1c` |
| `autre` | Autre | `#78716c` |

### Rôles & permissions

| Rôle | Peut | Ne peut pas |
|---|---|---|
| **user** | Créer pianos / passages / sessions / demandes, participer aux événements | Modérer |
| **admin** | Bannir/débannir (non-superadmin), classer signalements, force-delete piano, créer/annuler événements, répondre aux demandes | Gérer les rôles, bannir un superadmin |
| **superadmin** | Tout admin + promote/demote des rôles | Être banni ou rétrogradé en tant que dernier superadmin |

### Les 13 tables

| Table | Rôle |
|---|---|
| `profiles` | Identité publique + rôle + bannissement |
| `pianos` | Pianos (soft delete) |
| `piano_updates` | Historique d'état (immuable) |
| `piano_reports` | Signalements |
| `piano_visits` | Passages (check-in) |
| `piano_sessions` | Sessions planifiées / en cours |
| `events` | Événements communautaires |
| `event_participants` | Inscriptions aux événements |
| `user_requests` | Demandes support + réponses admin |
| `notification_preferences` | 5 toggles + push opt-in par user |
| `push_subscriptions` | Souscriptions Web Push (VAPID) |
| `notifications_outbox` | File d'envoi de notifications |
| `rate_limit_buckets` | Comptage interne du rate-limiting |

### Variables d'environnement

- **Frontend** : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN` (optionnel), `VITE_VAPID_PUBLIC_KEY` (optionnel).
- **Secrets Edge Function** : `WEBHOOK_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (+ `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` auto-injectés).

---

## 14. Synthèse des enjeux

- **Produit** — L'app évolue d'un **annuaire statique** vers une **carte vivante** (sessions, événements, feed communautaire). L'enjeu central est donc la **masse critique** d'utilisateurs actifs : sans densité locale, les sessions et événements restent vides. Le démarrage géolocalisé (Rennes) sert exactement cette logique d'amorçage.
- **Technique** — Tout le design vise à **tenir sur le free-tier** : Supabase (Storage 1 Go, **pause après 7 j**), Resend (**100 mails/j**), Nominatim (**1 req/s**). Le **filtrage 100 % client** est le principal frein au passage à l'échelle (à terme : fetch par viewport, RPC d'agrégation).
- **Sécurité / RGPD** — Socle **mature** : RLS partout, rate-limit **atomique** (advisory locks), column-level security, re-authentification sur les actions destructrices, CSP durcie. Restent deux trous connus : **confirmation email désactivée** et **audit admin absent**.
- **Dette / à finir** — **Icônes PWA** à générer, **retry des notifications** échouées, **purge** des tables `notifications_outbox` / `rate_limit_buckets` / `piano_visits` / `piano_sessions`, et **désynchronisation du `CLAUDE.md`** (annonce « v1 » alors que le code est en v4/v5 — ce document tient lieu d'état réel).

---

# 15. 💡 Idées de features innovantes & inspirations marché

> **Objectif de cette catégorie** : faire passer PianoWorld d'un *annuaire utile* à un *produit attachant* — donner envie de **venir** (acquisition, viralité) **et de rester** (rétention, boucle d'engagement).
> Chaque idée précise : ce qu'elle apporte, **pourquoi elle accroche**, son **inspiration marché** (ce qui se fait de mieux ailleurs), et ce qu'elle **réutilise** dans l'existant.
> Effort indicatif : 🟢 faible (réutilise l'infra) · 🟡 moyen · 🔴 élevé.

### La boucle d'engagement visée

Aujourd'hui le parcours s'arrête vite : *je cherche un piano → je le trouve → je pars*. Les produits qui retiennent installent une **boucle** :

> **Découvrir → Contribuer → Être reconnu (XP / badge / kudos) → Être notifié (réaction, piano proche, ami actif) → Revenir.**

La majorité des idées ci-dessous servent à fermer cette boucle. Le grand atout différenciant de PianoWorld, que **aucune carte concurrente n'exploite**, c'est **le son** : un piano, ça se joue et ça s'écoute (→ section C).

---

## A. Gamification & progression — *« encore un passage et je monte de niveau »*

| Idée | Ce que c'est | Pourquoi ça retient | Inspiration | Effort |
|---|---|---|---|---|
| **Profil musicien & XP/niveaux** | Chaque contribution (ajout piano, MAJ, passage, session, photo) donne des points → niveaux *Curieux → Explorateur → Ambassadeur → Légende* | Progression visible = motivation à revenir contribuer | Strava, Duolingo, Foursquare | 🟢 (réutilise `piano_visits` / `piano_sessions` / `pianos`) |
| **Badges / hauts faits** | « 1ᵉʳ à découvrir ce piano », « 10 villes », « Accordeur » (10 désaccordés signalés), « Oiseau de nuit » (session après minuit), « Pianiste des gares » | Collection = objectif de complétion, très partageable | Swarm stickers, Geocaching, Untappd | 🟢🟡 |
| **« Maire du piano »** | Celui qui a le plus de passages sur un piano en devient le **Maire** (couronne sur la fiche), détrônable | Compétition locale = rivalité saine, on revient « défendre son titre » | Foursquare *mayorship* (mécanique culte) | 🟢 (réutilise `piano_visits`) |
| **Streaks & quotidien** | Série de jours/semaines avec activité ; « piano du jour » à découvrir | La peur de casser sa série est le moteur de rétention nº 1 | Duolingo, BeReal, Snapchat | 🟢🟡 |
| **Classements locaux** | Top contributeurs par ville/quartier, ligues hebdo | Statut social local = fierté | Strava segments, Duolingo *leagues* | 🟡 |
| **Quêtes / défis** | « Visite 3 pianos ce week-end », défis saisonniers (Fête de la Musique 21 juin) | Objectifs courts = sessions répétées | Pokémon GO *research tasks* | 🟡 |

---

## B. Social & communauté vivante — *« je ne suis pas seul sur la carte »*

| Idée | Ce que c'est | Pourquoi ça retient | Inspiration | Effort |
|---|---|---|---|---|
| **Suivre des musiciens + fil d'activité** | Follow d'autres users, feed des passages/sessions des gens suivis | Crée des liens → on revient voir « ce que font les autres » | Strava (follow + feed), Instagram | 🟡 |
| **Kudos / réactions** | Liker un passage, une session, une photo (👏 🎹 🔥) | Réciprocité sociale = boucle de notifications | Strava *kudos*, Untappd *toast* | 🟢 (réutilise notifications) |
| **Sessions « ouvertes » / jams** | Marquer une session comme *ouverte aux autres* → « je viens » + mini-chat | Transforme la carte en **lieu de rencontre réelle** | Meetup, Partiful | 🟡 (réutilise `piano_sessions`) |
| **Livre d'or du piano** | Mur de commentaires/dédicaces par piano (« j'ai joué Clair de Lune ici un soir de pluie ») | Donne une âme au lieu, contenu qui s'accumule | Atlas Obscura, livres d'or | 🟢 (petite table) |
| **Profils enrichis** | Instrument, niveau, styles joués, bio, morceaux favoris | Identité = attachement au compte | Untappd, last.fm | 🟢 |
| **Trouver un partenaire / 4 mains** | « Cherche quelqu'un pour jouer à ce piano » | Usage utilitaire fort, viralité bouche-à-oreille | BlaBlaCar (mise en relation) | 🟡 |

---

## C. 🎹 Le son : la signature unique de PianoWorld — *le « killer feature »*

> **Aucune carte concurrente (Park4Night, iOverlander…) n'a ça**, parce qu'aucune ne porte sur un *instrument*. C'est LE différenciateur, et il est cool, interactif et original.

| Idée | Ce que c'est | Pourquoi ça accroche | Inspiration | Effort |
|---|---|---|---|---|
| **Extraits audio par piano** | À un passage/une session, enregistrer **15–30 s** de ce qu'on joue → la fiche piano devient une **playlist** | « Écoute ce piano avant d'y aller » : émotion + preuve sociale + contenu infini | Untappd (check-in + média), SoundCloud, Cappuccino | 🔴 (Storage déjà là, mais lecteur + modération + quota) |
| **Mur sonore / « radio des pianos »** | Flux des derniers extraits joués dans la ville, lecture en continu | Découverte passive addictive | Spotify radio, BeReal feed | 🟡 |
| **Reconnaissance du morceau** | Détecter le morceau joué depuis l'extrait → « morceaux joués sur ce piano » | Magie + données (« le piano où on joue le plus Chopin ») | Shazam | 🔴 (IA) |
| **Défi « reprends ce morceau »** | Quelqu'un poste un extrait, les autres le reprennent sur le même ou un autre piano | Mécanique de chaîne virale | TikTok duos, Smule | 🔴 |

---

## D. Découverte & viralité — *faire venir de nouveaux utilisateurs*

| Idée | Ce que c'est | Pourquoi ça fait venir | Inspiration | Effort |
|---|---|---|---|---|
| **PianoWorld Wrapped** | Récap annuel/mensuel partageable : « Ton année : 23 pianos, 7 villes, 4 h de jeu » sous forme d'image stylée | Partage social massif = acquisition gratuite | **Spotify Wrapped**, Strava *Year in Sport* | 🟡 (frontend pur, réutilise les compteurs) |
| **Carte de session partageable** | Après une session, image générée (piano + photo + durée) à poster en story | Chaque session devient une pub | Strava (partage d'activité) | 🟢 |
| **Pages pianos publiques & SEO** | Fiches indexables par Google (« piano public gare de Rennes ») | Trafic organique entrant | TripAdvisor, AllTrails | 🟡 (réutilise `PianoPage` déjà public) |
| **Parrainage** | Inviter un ami → badge/bonus pour les deux | Croissance virale maîtrisée | Dropbox, BlaBlaCar | 🟢🟡 |
| **« Piano crawl » / itinéraires** | Parcours de plusieurs pianos (« Tournée des 5 pianos de Rennes »), à compléter | Objectif ludique + découverte de la ville | Komoot/AllTrails *routes*, Geocaching circuits | 🟡 |

---

## E. Temps réel & proximité — *ramener l'utilisateur au bon moment*

| Idée | Ce que c'est | Pourquoi ça retient | Inspiration | Effort |
|---|---|---|---|---|
| **Notifications de proximité (geofencing)** | « Un piano à 200 m que tu n'as jamais visité » | Réengagement contextuel ultra-pertinent | Foursquare/Swarm, Pokémon GO | 🟡 (réutilise le push existant) |
| **« Live now »** | Voir en direct qui joue où, sur la carte et dans un onglet dédié | Sentiment de communauté active, FOMO | BeReal, Twitch *live* | 🟢 (réutilise sessions actives + pulse déjà codé) |
| **Événements communautaires *bottom-up*** | Laisser **les users** (pas que les admins) créer des jams/mini-events | Multiplie le contenu événementiel | Meetup, Partiful | 🟢 (assouplir la RLS `events_insert_admin`) |
| **Temps forts** | Intégration Fête de la Musique, concours saisonniers, « piano de l'été » | Pics d'activité réguliers | Snapchat events, Strava challenges | 🟡 |

---

## F. Richesse de la fiche piano — *une donnée plus utile = plus de visites*

- **Attributs structurés** : type (droit / quart-de-queue / numérique), couvert / extérieur, accès 24/7, gratuit / payant, PMR, prises électriques, banc. → filtres puissants (inspiration : Park4Night, iOverlander). 🟢🟡
- **Galerie photo multi-clichés** par piano (aujourd'hui : une seule photo). 🟡
- **Histoire du piano** : qui l'a installé, anecdotes, photos avant/après. → âme du lieu (Atlas Obscura). 🟢
- **Note d'ambiance** distincte de la qualité technique : calme / passant / abrité, qualité du son. 🟢
- **Signalement enrichi** : « cassé », « fermé », « déplacé », « retiré » avec photo (au-delà du `still_there` binaire). 🟢

---

## G. Intelligence / IA — *différenciateur 2026*

- **Modération automatique des photos** : « est-ce vraiment un piano ? », détection de contenu inapproprié → soulage l'admin (qui n'a aucun audit aujourd'hui). 🟡
- **Assistant en langage naturel** : « trouve-moi un piano à queue, accordé, couvert, ouvert maintenant, près de moi ». 🔴
- **Détection de doublons intelligente** (au-delà des 50 m actuels) : même adresse, même photo. 🟡
- **Génération d'anecdote / description** à partir des photos et de la localisation. 🟢🟡

---

## H. Pérennité & partenariats — *répondre à l'enjeu free-tier*

- **Partenariats institutionnels** : gares (SNCF / *Gares & Connexions* a déjà des pianos en libre accès), mairies, conservatoires, festivals. PianoWorld peut devenir **la** carte officielle. Inspiration directe : *« Play Me, I'm Yours »* (street pianos mondial). 🟡
- **Premium doux** (sans pub) : thèmes, badges exclusifs, stats avancées, extraits audio plus longs. 🟡
- **« Adopter un piano »** : un mécène/commerce sponsorise un piano (entretien, accordage) et apparaît sur la fiche. 🟡
- **Dons / soutien** pour financer le passage au-delà du free-tier. 🟢

---

## 🏆 Récapitulatif — priorisation (impact × effort)

> Les **quick wins** réutilisent l'infra déjà en place (visits, sessions, push, profils, pages publiques) — fort impact, faible coût.

| Priorité | Feature | Impact | Effort | Réutilise |
|---|---|---|---|---|
| ⭐⭐⭐ | **Gamification (XP + badges + Maire du piano)** | Rétention forte | 🟢 | `piano_visits`, `piano_sessions`, `pianos` |
| ⭐⭐⭐ | **PianoWorld Wrapped + cartes partageables** | Acquisition virale | 🟢🟡 | Compteurs existants, frontend |
| ⭐⭐⭐ | **Événements *bottom-up* + sessions ouvertes/jams** | Communauté vivante | 🟢 | `events` (assouplir RLS), `piano_sessions` |
| ⭐⭐ | **Notifications de proximité** | Réengagement | 🟡 | Push (`push_subscriptions`) déjà codé |
| ⭐⭐ | **Kudos + suivre des musiciens** | Boucle sociale | 🟡 | Notifications, profils |
| ⭐⭐ | **Livre d'or + attributs de fiche** | Contenu + utilité | 🟢🟡 | `pianos`, petite table |
| ⭐ (pari) | **🎹 Extraits audio par piano** | Différenciateur unique | 🔴 | Storage existant + nouveau lecteur |

### Recommandation

1. **Commencer par la gamification** (XP, badges, *Maire du piano*) : effort faible car tout est déductible des tables existantes, et c'est le levier de rétention le plus prouvé du marché.
2. **Enchaîner avec le Wrapped / partage** : transforme chaque utilisateur en canal d'acquisition gratuit.
3. **Garder l'audio comme pari signature** : c'est plus lourd, mais c'est **la** feature dont aucune carte concurrente ne dispose et qui colle parfaitement à l'objet « piano ». À viser comme *vision produit* différenciante.

> ⚠️ **À cadrer avant build** : impact sur le **free-tier** (l'audio explose le quota Storage 1 Go bien plus vite que les photos ; les notifications de proximité augmentent le volume Resend/Push), et la **modération** (audio/commentaires/events ouverts = plus de contenu à modérer, alors qu'il n'y a aujourd'hui aucun audit ni automatisation).
