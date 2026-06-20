# RPC Catalog — PianoWorld

Catalogue exhaustif des RPCs `SECURITY DEFINER` exposées via PostgREST. Toutes les RPCs respectent le template documenté dans [SECURITY.md §5](SECURITY.md#5-rpcs-security-definer--pattern) :

- `language plpgsql` (ou `sql` si lecture pure)
- `security definer`
- `set search_path = public` (anti-hijack)
- garde explicite en début de body (`auth.uid()`, `is_admin()`, `is_banned()`, etc.)
- `revoke all on function ... from public` + `grant execute to authenticated` (ou `service_role` selon le cas)

Les numéros de ligne pointent vers [supabase/schema.sql](../supabase/schema.sql) (3173 lignes au 2026-06-20). **Ils dérivent à chaque modif** — si une ligne est off de ±2, fais confiance au nom de la fonction et grep.

**Légende :**

- **Re-auth** = requiert `p_password` + `verify_my_password()`
- **Audit** = appelle `write_audit_log()` à la fin

---

## Auth helpers

| RPC                          | Ligne | Garde                 | Effet                                                                                                                         | Re-auth | Audit |
| ---------------------------- | ----: | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- | :-----: | :---: |
| `get_my_profile()`           |  1024 | `auth.uid()` not null | Renvoie la ligne complète du profil du caller (bypass column-grant restriction sur `profiles`).                               |   no    |  no   |
| `verify_my_password(p text)` |   974 | `auth.uid()` not null | Bcrypt compare via pgcrypto contre `auth.users.encrypted_password`. **Ne rotate pas les sessions** (vs `signInWithPassword`). |   n/a   |  n/a  |
| `is_admin()`                 |   245 | aucune                | `role in ('admin', 'superadmin')` du caller.                                                                                  |   n/a   |  n/a  |
| `is_superadmin()`            |   258 | aucune                | `role = 'superadmin'` du caller.                                                                                              |   n/a   |  n/a  |
| `is_banned(uid uuid)`        |   271 | aucune                | `banned_at is not null` (uid arg, défaut = `auth.uid()`).                                                                     |   n/a   |  n/a  |

---

## Admin

Tous gated par `is_admin()` ou `is_superadmin()`.

| RPC                                                          | Ligne | Garde                                                          | Effet                                                                                                         | Re-auth |  Audit  |
| ------------------------------------------------------------ | ----: | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | :-----: | :-----: |
| `admin_list_users(q text, filter text, lim int)`             |  1041 | `is_admin()`                                                   | Liste paginée des profils complets (incl. role, banned_at). Filtre `all` / `banned` / `admin`. LIMIT max 200. |   no    |   no    |
| `set_user_role(target uuid, new_role user_role)`             |  1557 | `is_superadmin()` + self interdit + last-superadmin protection | Update `profiles.role`. Empêche `cannot demote last superadmin`.                                              |   no    | **yes** |
| `set_user_banned(target uuid, banned bool, p_password text)` |  1585 | `is_admin()` + cannot ban superadmin                           | Set `banned_at = now()` ou `null`.                                                                            | **yes** | **yes** |
| `force_delete_piano(target uuid, p_password text)`           |  1626 | `is_admin()`                                                   | Soft-delete piano (`is_deleted = true`).                                                                      | **yes** | **yes** |
| `resolve_report(report_id uuid)`                             |  1612 | `is_admin()`                                                   | Set `piano_reports.resolved = true`.                                                                          |   no    | **yes** |
| `reply_to_request(request_id uuid, reply text)`              |  1644 | `is_admin()` + 1 ≤ len(reply) ≤ 2000                           | Update `user_requests.admin_reply` + `status='answered'` + enqueue notif `request_reply`.                     |   no    | **yes** |

### Notes

- `set_user_role` empêche un superadmin de se rétrograder lui-même (self) ET de rétrograder le dernier superadmin restant. Protection contre lockout total.
- `set_user_banned` ne peut pas bannir un superadmin (mais peut bannir un admin). Protection symétrique.
- `force_delete_piano` est destructif côté UI (le piano disparaît de la carte) mais soft (la row reste avec `is_deleted=true`).
- `reply_to_request` génère **une** notif outbox row dans la même transaction — atomicité garantie.

---

## User self-service

| RPC                                                       | Ligne | Garde                                     | Effet                                                                                                                                                                                                                                                                          | Re-auth | Audit |
| --------------------------------------------------------- | ----: | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-----: | :---: |
| `delete_my_account(p_password text)`                      |  1296 | `auth.uid()` not null                     | `DELETE FROM auth.users WHERE id = auth.uid()`. Cascade FKs. **Préserve l'historique** via `piano_updates.updated_by ON DELETE SET NULL` + `author_pseudo_at_time` snapshot.                                                                                                   | **yes** |  no   |
| `export_my_data()` (v7)                                   |  2956 | `auth.uid()` not null                     | Retourne jsonb avec 13 sources : user, profile, pianos, piano_updates, piano_reports, piano_visits, piano_sessions, **piano_favorites (v7)**, **friendships (v7)**, event_participants, user_requests, notification_preferences, push_subscriptions (endpoint + UA seulement). |   no    |  no   |
| `update_my_profile_names(p_first text, p_last text)` (v7) |  2833 | `auth.uid()` not null + ≤ 50 chars chaque | Self-update `profiles.first_name`/`last_name`. NULL ou string vide = clear.                                                                                                                                                                                                    |   no    |  no   |

> Note : il existe une 2e définition obsolète `export_my_data()` à la ligne 1442 (pre-v7), réécrite par la version v7 ligne 2956. Postgres garde la dernière `CREATE OR REPLACE`.

---

## Internal helpers

Ces fonctions sont utilisées par d'autres RPCs ou par les policies RLS. Quelques unes ne sont pas exposées au client (jamais `grant execute to authenticated`).

| Function                                                                      | Ligne | Returns   | Notes                                                                                                                                                                            |
| ----------------------------------------------------------------------------- | ----: | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `event_has_room(event_id uuid)`                                               |   459 | `bool`    | `participants_count < max_participants` ou `max_participants is null`. Utilisé en policy WITH CHECK pour `event_participants_insert`.                                            |
| `within_rate_limit(action_name text)`                                         |   851 | `bool`    | **Legacy `STABLE`** — gardée pour compat / non-régression silencieuse, n'est plus utilisée dans les policies depuis v5.                                                          |
| `enforce_rate_limit()`                                                        |  1098 | `trigger` | Trigger générique BEFORE INSERT. TG_ARGV = (action, max, window). Advisory lock + UPSERT atomique. Raise `P0001 rate_limit_exceeded`.                                            |
| `enforce_caller_rate_limit(p_action text, p_max int, p_window interval)` (v7) |  2627 | `void`    | Equivalent appelable depuis RPC body. Utilisé par `find_user_by_email`.                                                                                                          |
| `unaccent_immutable(text)` (v7)                                               |  2523 | `text`    | Wrapper IMMUTABLE de `unaccent('public.unaccent', $1)` — pour permettre l'utilisation dans les index expressions GIN trgm.                                                       |
| `are_friends(a uuid, b uuid)`                                                 |  1893 | `bool`    | `true` ssi accepted. **Raise `42501`** si caller pas dans `(a, b)` et pas admin (anti-graph-probing).                                                                            |
| `are_friends_safe(a uuid, b uuid)`                                            |  1919 | `bool`    | Même check **sans la garde**. Granted **uniquement à `service_role`** → utilisé par l'Edge Function pour re-vérification à delivery time de `friend_arriving`.                   |
| `write_audit_log(action text, target uuid, payload jsonb)`                    |  1536 | `void`    | INSERT dans `audit_log`. Jamais granted au client — appelée depuis d'autres RPCs `SECURITY DEFINER`.                                                                             |
| `ensure_notification_prefs()`                                                 |   560 | `trigger` | AFTER INSERT sur `profiles` → INSERT prefs row avec defaults.                                                                                                                    |
| `handle_new_user()`                                                           |  1355 | `trigger` | AFTER INSERT sur `auth.users` → lit `raw_user_meta_data->>'pseudo'`, génère fallback `user_<8 hex>`, gère collisions (50 essais), persiste `accept_cgu_at`/`accept_cgu_version`. |
| `fill_pseudo_snapshot()`                                                      |  1413 | `trigger` | BEFORE INSERT sur `piano_updates` → fige `author_pseudo_at_time = (SELECT pseudo FROM profiles WHERE id = updated_by)`.                                                          |
| `reject_visibility_update()` (v6)                                             |  1944 | `trigger` | BEFORE UPDATE sur `piano_sessions` → raise `42501` si `new.visibility <> old.visibility`. Set-once enforcement.                                                                  |
| `queue_favorite_update_notification()` (v7)                                   |  2582 | `trigger` | AFTER INSERT sur `piano_updates` → enqueue notif `piano_favorite_update` pour chaque user qui a ce piano en favori (sauf l'updater lui-même).                                    |
| `queue_friend_arriving_notification()` (v6)                                   |  2019 | `trigger` | AFTER INSERT sur `piano_sessions` → enqueue notif `friend_arriving` pour chaque ami du session-creator (dedup horaire via `friend_arriving_dedup`).                              |

---

## Notifications outbox (service_role only)

Ces RPCs ne sont **jamais** granted à `authenticated`. Elles sont appelées par l'Edge Function `send-notification` ou les jobs pg_cron via service_role.

| RPC                                               | Ligne | Garde        | Effet                                                                                                                                                                             |
| ------------------------------------------------- | ----: | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mark_notification_sent(notif_id uuid, err text)` |  1722 | service_role | Si `err is null` → `status='sent'` + `sent_at=now()`. Sinon `attempts += 1`, `next_retry_at = now() + 2^attempts min` (2/4/8/16/32). À 5 attempts → `status='permanent_failure'`. |
| `list_pending_notifications(lim int)`             |  1776 | service_role | Liste les IDs des rows `status='pending' AND next_retry_at <= now()` LIMIT `lim`. Utilisée par pg_cron `notif-retry`.                                                             |
| `purge_old_notifications()`                       |  1793 | service_role | DELETE WHERE `status IN ('sent', 'permanent_failure') AND created_at < now() - interval '30 days'`. Utilisée par pg_cron `notif-purge`.                                           |

---

## v6 — Friendships

Toutes les opérations sur `friendships`, `friendship_rejections`, `friend_arriving_dedup` passent par ces RPCs. Les tables sont REVOKE ALL côté client.

### Mutations

| RPC                                      | Ligne | Garde                                                                                       | Effet                                                                                                                                                                                                                                                                                            |  Audit  |
| ---------------------------------------- | ----: | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `send_friend_request(target uuid)`       |  2094 | auth + not banned + target≠self + not banned(target) + **not in 30-day rejection cooldown** | Advisory lock `(low, high)` canonical pair → SELECT FOR UPDATE existing → si row inverse `pending` : UPDATE→`accepted` + enqueue 2× `friend_request_accepted` avec `auto_accepted=true` (auto-accept croisé). Sinon INSERT. Enqueue `friend_request_received` pour cible. Returns friendship id. |   no    |
| `accept_friend_request(request_id uuid)` |  2182 | auth + caller in `(user_a, user_b)` + caller ≠ requester + not banned + status='pending'    | Advisory lock `('fr:'                                                                                                                                                                                                                                                                            |         | id)`→ SELECT FOR UPDATE → **idempotent** (no-op si déjà accepted) → UPDATE status='accepted' + responded_at + enqueue`friend_request_accepted` pour requester. | no  |
| `reject_friend_request(request_id uuid)` |  2232 | auth + caller in `(user_a, user_b)` + caller ≠ requester + status='pending'                 | Advisory lock + DELETE friendship row + INSERT `friendship_rejections(requester, caller, now())`. **Pas de notif** (ghost reject).                                                                                                                                                               |   no    |
| `cancel_friend_request(request_id uuid)` |  2265 | auth + caller = requester + status='pending'                                                | Advisory lock + DELETE row.                                                                                                                                                                                                                                                                      |   no    |
| `remove_friendship(other_user uuid)`     |  2293 | auth + must be `accepted` between caller and other_user                                     | Advisory lock `(low, high)` → DELETE row canonique.                                                                                                                                                                                                                                              | **yes** |

### Lectures

| RPC                                                         | Ligne | Garde                                      | Effet                                                                                                                                                                                                                       |
| ----------------------------------------------------------- | ----: | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_my_friends()`                                          |  2329 | auth                                       | Returns `table(id uuid, pseudo text, created_at timestamptz, friendship_since timestamptz)` via `friendships_symmetric` JOIN profiles. LIMIT 500. Tri `friendship_since desc`.                                              |
| `get_my_friend_requests(direction text default 'received')` |  2355 | auth + direction in `('received', 'sent')` | Returns `table(request_id, user_id, pseudo, created_at)`. `received` : requester_id ≠ caller. `sent` : requester_id = caller. Status `pending` uniquement. LIMIT 200.                                                       |
| `get_friend_status(target uuid)`                            |  2387 | auth                                       | Returns `text` ∈ `{ 'self', 'none', 'pending_sent', 'pending_received', 'friends' }`.                                                                                                                                       |
| `get_active_piano_counts(piano_ids uuid[])`                 |  2417 | granted anon + authenticated               | Returns `table(piano_id uuid, count int)`. Batch RPC pour PianoMap : 1 query → count des sessions visibles au caller (applique le **même filtre visibility** que `list_piano_presence` → pas de cardinality leak).          |
| `list_piano_presence(p_piano uuid)`                         |  2447 | granted anon + authenticated               | Returns `table(session_id, user_id, pseudo, starts_at, duration_min, visibility)`. Sessions actives + upcoming visibles : `public` OR self OR admin OR `are_friends`. LIMIT 50. JOIN profiles + filtre `banned_at IS NULL`. |

---

## v7 — Search & favorites

| RPC                                   | Ligne | Garde                                                                                                               | Effet                                                                                                                                                                                                                                                                             | Audit |
| ------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---: |
| `search_users(q text)`                |  2675 | auth + 2 ≤ len(q) ≤ 50                                                                                              | Returns `table(id, pseudo, first_name, last_name, created_at)`. Fuzzy trigram sur `pseudo + first_name + last_name` via `similarity()` ≥ 0.1 (threshold). Filtre `banned_at IS NULL`. Tri `similarity desc, pseudo asc`. LIMIT 20. Accent-insensitive via `unaccent_immutable`.   |  no   |
| `find_user_by_email(p_email text)`    |  2730 | auth + valid email shape + **rate-limit 5/24h** via `enforce_caller_rate_limit('user_search_email', 5, '24 hours')` | Returns `table(id, pseudo, first_name, last_name, created_at)`. **Exact-match strict** `lower(u.email) = lower(trim(p_email))`. **0 row si non trouvé OU banned** (pas de leak existence). **Jamais l'email** dans le retour. LIMIT 1.                                            |  no   |
| `search_pianos(q text)`               |  2771 | auth + 2 ≤ len(q) ≤ 100                                                                                             | Returns `table(id, address, comment, quality, photo_url, lat, lng, created_by, author_pseudo, created_at)`. Fuzzy `address + comment` via similarity ≥ 0.1. Filtre `is_deleted = false`. Tri `similarity desc, created_at desc`. LIMIT 30. JOIN profiles pour `author_pseudo`.    |  no   |
| `toggle_piano_favorite(p_piano uuid)` |  2868 | auth + not banned + piano exists + not deleted                                                                      | Advisory lock `(uid, 'fav', piano_id)` → check existing → if exists DELETE, else INSERT. Returns `bool` : `true` si maintenant favori, `false` si retiré. **Idempotent** (double-click safe).                                                                                     |  no   |
| `get_my_favorites()`                  |  2915 | auth                                                                                                                | Returns `table(piano_id, address, quality, photo_url, lat, lng, favorited_at, last_update_at)`. JOIN pianos LEFT JOIN LATERAL `(SELECT max(created_at) FROM piano_updates WHERE piano_id = pf.piano_id)`. Filtre `pianos.is_deleted = false`. Tri `favorited_at desc`. LIMIT 200. |  no   |

### Notes v7

- **`find_user_by_email` 0 row policy** : la réponse est identique pour "compte inexistant" et "compte banni" pour empêcher la détection d'existence via différence (timing/code).
- **`search_users` threshold 0.1** : suffisamment lâche pour matcher des typos modérés, suffisamment strict pour éviter le bruit. Calibré sur des tests manuels.
- **`get_my_favorites` LATERAL** : la sub-query LATERAL est utilisée pour récupérer le `last_update_at` par piano (utilise `pu.created_at` — bug fix Sprint 9 — voir [supabase/tests/README.md](../supabase/tests/README.md)).
- **`toggle_piano_favorite` advisory lock** : sans le lock, deux clicks rapides en parallèle pouvaient INSERT 2 rows (race sur le SELECT existing → ON CONFLICT non géré côté Postgres car la PK est défaite par 2 INSERTs simultanés avant que la 1re commit). Le lock force la sérialisation.

---

## v7 Sprint 7 sécu — Signup IP rate-limit

Section 16 de schema.sql (Sprint 7 sécu A.6.4).

| RPC                                       | Ligne | Garde                                  | Effet                                                                                                                                                                                      | Re-auth | Audit |
| ----------------------------------------- | ----: | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-----: | :---: |
| `check_signup_ip_allowed(p_ip_hash text)` |  3061 | service_role only (appelé par Edge Fn) | Advisory lock `('signup-ip', hashtext(p_ip_hash))` → count attempts last 24h → si ≥ 5 returns `false` (block) → sinon INSERT row + returns `true` (allow). Atomic count+insert under lock. |   no    |  no   |

**Flow** :

1. Edge Function `signup-protected/index.ts` reçoit l'IP du request header
2. Hash via SHA-256 + sel env (`SIGNUP_IP_HASH_SALT`) → anonymisation RGPD
3. Appel RPC `check_signup_ip_allowed(hash)` via service_role
4. Si `false` → renvoie `{ allowed: false, message: "Trop de tentatives" }` au frontend
5. AuthContext.signUp throw le message → toast user-friendly

Table `signup_ip_attempts` : REVOKE ALL (invisible client). Purge nightly via pg_cron `signup-ip-attempts-purge` (rows > 7j).

---

## Catalogue résumé par count

- **Auth helpers** : 5 (1 callable + 4 internal)
- **Admin** : 6 (tous trace audit, 3 require re-auth)
- **User self-service** : 3 (1 require re-auth)
- **Internal helpers** : 14 (4 callables `authenticated`, 10 internes/triggers/service_role)
- **Notifications outbox** : 3 (service_role only)
- **v6 friendships** : 10 (5 mutations + 5 reads, 1 audit)
- **v7 search & favorites** : 5
- **v7 Sprint 7 sécu** : 1 (check_signup_ip_allowed, service_role only)

**Total RPCs exposés `authenticated`** : ~25.
**Total RPCs internes/service_role/trigger functions** : ~16.

---

## Workflow d'ajout d'une nouvelle RPC

1. Utiliser le skill `/rpc-create` pour scaffolder (génère SQL conforme conventions).
2. Append dans `supabase/schema.sql` à la fin de la section appropriée (section 11 pour durcissement v5, 14 pour friendships v6, 15 pour search/favoris v7, 16 pour signup IP, créer une section 17+ pour vN).
3. Set search_path = public obligatoire.
4. Guard explicite (`auth.uid()`, `is_admin()`, etc.) en début de body.
5. Si destructive/admin → `perform public.write_audit_log('<action>', target, jsonb_build_object(...))` à la fin.
6. Si rate-limit nécessaire et pas de trigger row INSERT → `perform public.enforce_caller_rate_limit('<action>', max, '<window>'::interval)` en début.
7. `revoke all on function ... from public; grant execute on function ... to authenticated;` (ou `service_role`).
8. Ajouter l'entry dans `src/types/database.ts` (section `Functions:`).
9. **Snapshot RLS Vitest** : `npm test` (diff) → revue → `npm test -- -u` (baseline).
10. **pgTAP tests** (Sprint 9) : ajouter assertion dans `supabase/tests/05_rpc_admin_guards.sql` ou créer un nouveau fichier. Run `./scripts/run-pgtap.ps1`.
11. Tester en SQL Editor : auth/garde/effet/rollback.
12. Commit `feat(<scope>): rpc <name>`.
