# Security model — PianoWorld

Document de référence pour le modèle de sécurité. Pour le catalogue exhaustif des RPCs voir [RPCS.md](RPCS.md). Pour l'architecture générale voir [ARCHITECTURE.md](ARCHITECTURE.md).

Toutes les références de lignes pointent vers [supabase/schema.sql](../supabase/schema.sql).

---

## 1. Defense in depth (7 couches)

PianoWorld superpose 7 mécanismes, chacun adressant une classe de menace distincte. Aucun n'est suffisant seul — ils sont conçus pour composer.

| Couche | Mécanisme                                                   | Adresse                                                  |
| ------ | ----------------------------------------------------------- | -------------------------------------------------------- |
| 1      | **RLS policies** (sections 2, 7, 11.b, 14.c, 15.d)          | Row-level visibility côté PostgREST                      |
| 2      | **Column-level grants** (section 11.a, l. 1015-1016)        | Hide sensitive cols même quand RLS SELECT est permissive |
| 3      | **RPCs `SECURITY DEFINER`** + `set search_path = public`    | Privileged entry points pour mutations protégées         |
| 4      | **Rate-limits** (sections 11.b, 14.e, 15.g)                 | Insert-abuse, account-enumeration                        |
| 5      | **Advisory locks** (`pg_advisory_xact_lock(hashtext(...))`) | Sérialisation concurrence sans lock row                  |
| 6      | **Re-auth password** sur RPCs irréversibles                 | Cap le blast radius d'une session volée                  |
| 7      | **Audit log** (section 11.f)                                | Traçabilité actions admin destructives                   |

Sur les tables sensibles (`friendships`, `friendship_rejections`, `friend_arriving_dedup`, `rate_limit_buckets`, `audit_log`, `notifications_outbox`), le **default est REVOKE ALL** : la table est invisible côté client. L'accès passe exclusivement par des RPCs `SECURITY DEFINER`.

---

## 2. Column-level grants — `profiles`

`profiles` est la seule table publique avec colonnes sensibles. Avant v5, la policy `profiles_select USING (true)` leakait :

- La liste complète des admins → cible social-engineering
- La liste des bannis

**Section 11.a fixe** (l. 1015-1016) :

```sql
revoke select on public.profiles from anon, authenticated;
grant select (id, pseudo, created_at) on public.profiles to anon, authenticated;
```

Les joins PostgREST type `author:profiles!fk(pseudo)` continuent de fonctionner — le grant couvre les colonnes que le schéma public consomme réellement. Les colonnes privilégiées deviennent invisibles : tout `?select=*` depuis anon/auth retourne `403 permission denied for column role`.

### Lecture des colonnes restreintes

Pour lire `role`/`banned_at`/`accept_cgu_*`/`first_name`/`last_name`, les callers doivent passer par des RPCs `SECURITY DEFINER` :

- `get_my_profile()` (l. 1021) — self read
- `admin_list_users(q, filter, lim)` (l. 1038) — admin gated
- **v7** : `search_users(q)` (l. 2657), `find_user_by_email(p_email)` (l. 2712) — opt-in lookup

Le commentaire à l. 2499 expose le **contrat privacy v7** : les colonnes `first_name`/`last_name` sont opt-in storage, opt-in display, opt-in lookup. Stockées NULL par défaut ; le user les renseigne via `update_my_profile_names()`.

---

## 3. Rate-limit infrastructure

### Storage — `rate_limit_buckets` (l. 1080-1093)

PK `(user_id, action, window_start)`. RLS enabled avec **aucune policy**, tous grants révoqués → invisible côté client. Seul du code `SECURITY DEFINER` la touche.

### Trigger générique — `enforce_rate_limit()` (l. 1095-1146)

Utilisé en `BEFORE INSERT` sur toutes les tables rate-limitées. Résout `v_uid` via `NEW` row selon `TG_TABLE_NAME` (l. 1109-1117 : `pianos.created_by`, `piano_updates.updated_by`, `piano_reports.reported_by`, `user_id` pour visits/sessions/requests, et v6 `friendships.requester_id`). Prend un advisory lock `pg_advisory_xact_lock(hashtext(uid || ':' || action))` (l. 1124), upsert atomique dans le bucket, somme le windowed count, raise `P0001 rate_limit_exceeded` si dépassement.

**Pourquoi advisory lock + UPSERT atomique** : la version v4 (`within_rate_limit()`) était `STABLE` → snapshot du COUNT au début de transaction → un INSERT batch ou `Promise.all` parallèle voyait tous le même count à `max-1` et passait à travers. Le nouveau design serialize les checks par `(user, action)` sur la durée de la transaction.

### Helper RPC body — `enforce_caller_rate_limit()` (v7, l. 2609-2650)

Même logique mais appelable depuis un RPC où aucun trigger ne fire (pas d'INSERT). Introduit en v7 spécifiquement pour `find_user_by_email`. Signature : `enforce_caller_rate_limit(p_action text, p_max int, p_window interval)`. Raise `P0001 rate_limit_exceeded` sur dépassement.

### Catalogue des actions

| Action              | Max | Fenêtre |  Source | Notes                                              |
| ------------------- | --: | ------- | ------: | -------------------------------------------------- |
| `piano_create`      |   5 | 24 h    | l. 1191 | trigger `pianos`                                   |
| `piano_update`      |  30 | 24 h    | l. 1196 | trigger `piano_updates`                            |
| `piano_visit`       |  50 | 24 h    | l. 1201 | trigger `piano_visits`                             |
| `piano_session`     |  10 | 24 h    | l. 1206 | trigger `piano_sessions`                           |
| `piano_report`      |   5 | 24 h    | l. 1211 | trigger `piano_reports`                            |
| `user_request`      |   5 | 7 d     | l. 1216 | trigger `user_requests`                            |
| `friend_request`    |  20 | 24 h    | l. 1993 | trigger v6 `friendships`                           |
| `user_search_email` |   5 | 24 h    | l. 2737 | v7 — appelé depuis le body de `find_user_by_email` |

Le frontend mirror ces valeurs dans [src/lib/constants.ts](../src/lib/constants.ts) (`RATE_LIMITS`) et détecte les breaches via `isRateLimitError()` ([src/lib/errors.ts](../src/lib/errors.ts)).

---

## 4. Advisory locks

Postgres transactional advisory locks sérialisent des opérations logiquement liées sans verrouiller des rows que l'app ne possède pas. La convention de keying est `hashtext('<scope>:<id>')` pour partitionner l'espace de lock par use case.

| Site                         | Ligne | Key                          | Pourquoi                                                                                                   |
| ---------------------------- | ----: | ---------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------- |
| `enforce_rate_limit`         |  1124 | `(uid, action)`              | Empêche deux INSERTs concurrents d'observer `count = max-1` tous les deux                                  |
| `enforce_caller_rate_limit`  |  2628 | `(uid, action)`              | Même garantie pour RPC bodies (`find_user_by_email`)                                                       |
| `send_friend_request`        |  2111 | `(low, high)` canonical pair | Anti-race pour requests croisés simultanés — garantit que la branche auto-accept voit un état déterministe |
| `accept_friend_request`      |  2180 | `('fr:'                      |                                                                                                            | request_id)` | Idempotency : deux clicks tombent sur le même lock, le 2e voit `status=accepted` et returns |
| `reject_friend_request`      |  2229 | `('fr:'                      |                                                                                                            | request_id)` | Même contrat idempotency                                                                    |
| `cancel_friend_request`      |  2262 | `('fr:'                      |                                                                                                            | request_id)` | Même                                                                                        |
| `remove_friendship`          |  2296 | `(low, high)`                | Symétrique avec send (même key shape) → send + remove concurrents sérialisent                              |
| `toggle_piano_favorite` (v7) |  2865 | `(uid, 'fav', piano_id)`     | Double-click resilience : le 2e call observe le nouveau state                                              |

Tous les locks sont `pg_advisory_xact_lock` (transactional) → released automatiquement à COMMIT/ROLLBACK, ne peuvent pas leaker.

---

## 5. RPCs SECURITY DEFINER — pattern

Toute RPC privilégiée respecte ce template :

```sql
create or replace function public.<name>(<args>)
returns <type>
language plpgsql
security definer
set search_path = public  -- bloque la recherche de fonctions hijacked
[stable]                  -- si lecture pure (autorise inlining + parallélisme)
as $$
declare ...
begin
  -- 1. Auth check
  if auth.uid() is null then
    raise exception 'not authenticated' [using errcode = '42501'];
  end if;

  -- 2. Guards métier (admin? banned? owner? rate-limit?)
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_password is null or not public.verify_my_password(p_password) then
    raise exception 'invalid_password';
  end if;

  -- 3. Logique
  ...

  -- 4. Audit log si destructive
  perform public.write_audit_log('<action>', target, jsonb_build_object(...));
end$$;

revoke all on function public.<name>(<args>) from public;
grant execute on function public.<name>(<args>) to authenticated;
```

Le snapshot Vitest ([src/lib/**tests**/security-snapshot.test.ts](../src/lib/__tests__/security-snapshot.test.ts)) check :

- `set search_path = public` présent
- `language` est `plpgsql` ou `sql`
- `security definer` (vs `security invoker` = défaut)
- Grants/revokes corrects

Voir [RPCS.md](RPCS.md) pour le catalogue complet (40+ RPCs).

---

## 6. Re-auth password

Les RPCs irréversibles re-vérifient le password via `verify_my_password(p_password)` (section 10.g) qui fait un bcrypt compare server-side via `pgcrypto.crypt` contre `auth.users.encrypted_password`.

| RPC                                           | Pourquoi re-auth                                                    |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `set_user_banned(target, banned, p_password)` | Action admin destructive (peut être abusée par session volée)       |
| `force_delete_piano(target, p_password)`      | Soft-delete d'un piano (devrait être rare, on demande confirmation) |
| `delete_my_account(p_password)`               | Suppression de compte irréversible                                  |

**Pourquoi pas `signInWithPassword` côté client ?** Parce que `signInWithPassword` rotate les refresh tokens de TOUS les devices du user → log out forcé partout. `verify_my_password()` fait juste un bcrypt compare sans toucher aux sessions.

---

## 7. Audit log (`audit_log`)

[supabase/schema.sql:1497-1510](../supabase/schema.sql#L1497-L1510)

```sql
create table public.audit_log (
  id          bigserial primary key,
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  target_id   uuid,
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
```

3 indexes : `created_at desc`, `(actor_id, created_at desc)`, `(action, created_at desc)` → l'admin Audit Log tab filtre rapidement.

**RLS** : SELECT gated par `is_admin()`. **Pas de policy INSERT/UPDATE/DELETE** → la table est effectivement append-only et invisible à toute écriture client. Les insertions passent uniquement par `write_audit_log()` (l. 1521) appelée depuis d'autres RPCs `SECURITY DEFINER` qui s'exécutent comme `postgres`.

### Actions tracées

| Action                   | RPC source | Payload typique     |
| ------------------------ | ---------- | ------------------- |
| `set_user_role`          | l. 1565    | `{ new_role }`      |
| `set_user_banned`        | l. 1592    | `{ banned }`        |
| `resolve_report`         | l. 1608    | `{ piano_id }`      |
| `force_delete_piano`     | l. 1626    | `{ }`               |
| `reply_to_request`       | l. 1667    | `{ reply_len }`     |
| `remove_friendship` (v6) | l. 2306    | `{ friendship_id }` |

**Pas auditées** : `delete_my_account` (user action, pas admin), friend accept/reject/cancel (user actions), `toggle_piano_favorite`, `find_user_by_email`. Pour ce dernier le commentaire à l. 2485 expose la décision : **ne pas créer un registre d'énumération** ("qui a cherché qui par email"). Le rate-limit suffit comme dissuasion.

Tout nouveau RPC destructif doit ajouter un `perform public.write_audit_log(...)` à la fin de son body — la convention est de passer un target UUID + un petit jsonb payload.

---

## 8. Modèle RGPD

### Article 17 (droit à l'effacement)

`delete_my_account(p_password)` (l. 1293) :

1. Re-auth password obligatoire
2. `DELETE FROM auth.users WHERE id = auth.uid()`
3. Cascade via FKs `references auth.users(id) on delete cascade` :
   - `profiles`
   - `push_subscriptions`
   - `notification_preferences`
   - `rate_limit_buckets`
   - `friendships`, `friendship_rejections`, `friend_arriving_dedup` (v6)
   - `piano_favorites` (v7)
4. **Préservation de l'historique anonymisé** via le path SET NULL sur `piano_updates.updated_by` (voir §9)

La combinaison satisfait GDPR Article 17 sans détruire la valeur communautaire.

### Article 20 (portabilité des données)

`export_my_data()` (l. 2932) — voir §10.

### Anonymisation cohérente

Voir §9.

---

## 9. Anonymisation cohérente

Pattern récurrent : **survivre aux suppressions de compte sans casser l'historique**.

### `piano_updates.updated_by` — `ON DELETE SET NULL`

Section 11.e. La FK historiquement `ON DELETE CASCADE` a été changée en `ON DELETE SET NULL` (l. 1393). Pour préserver l'attribution malgré la suppression, on ajoute la colonne `author_pseudo_at_time text` (l. 1391), remplie par le trigger BEFORE INSERT `fill_pseudo_snapshot()` (l. 1413). Backfill une fois (l. 1419-1422).

Quand un user supprime son compte, son historique de MAJ survit, attribué au pseudo **figé** au moment de l'update ("@enzo (compte supprimé)" dans l'UI).

### Snapshot dans les payloads d'outbox

Même pattern v6 et v7 — les triggers `queue_*` snapshotent le pseudo + adresse dans le payload jsonb au moment de l'enqueue, **avant** la livraison par l'Edge Function. Même si le sender supprime son compte entre enqueue et delivery, le mail/push utilise le snapshot.

| Trigger                                   | Snapshot                                    |
| ----------------------------------------- | ------------------------------------------- |
| `queue_friend_arriving_notification` (v6) | `sender_pseudo`, `piano_address` (l. 2052)  |
| `queue_favorite_update_notification` (v7) | `updater_pseudo`, `piano_address` (l. 2583) |

### Soft delete pianos

`pianos.is_deleted boolean default false`. La RLS `pianos_select` filtre `is_deleted = false` (l. 89). Permet aux admins de retirer du contenu visible tout en gardant l'auditabilité. Purge physique = SQL manuel.

---

## 10. `export_my_data()` — structure RGPD complète

[supabase/schema.sql:2932-3004](../supabase/schema.sql#L2932-L3004) (étendue v7)

```jsonb
{
  exported_at,
  user: { id, email },
  profile: { ...full profile incl. first_name, last_name },
  pianos[]:               { ... t.created_by = caller },
  piano_updates[]:        { ... t.updated_by = caller },
  piano_reports[]:        { ... t.reported_by = caller },
  piano_visits[]:         { ... t.user_id = caller },
  piano_sessions[]:       { ... t.user_id = caller },
  piano_favorites[] (v7): { ... t.user_id = caller },
  friendships[] (v7):     { id, other_user_id, requester_id, status, created_at, responded_at }
                          // reshape (vs internal user_a/user_b ordering)
                          // pour que le user voie "qui je suis ami avec"
  event_participants[]:   { ... t.user_id = caller },
  user_requests[]:        { ... t.user_id = caller },
  notification_preferences: { ... },
  push_subscriptions[]:   { endpoint, user_agent, created_at, last_used_at }
                          // OMIT p256dh + auth_secret (clés de chiffrement, pas user data)
}
```

**`profile`** inclut `first_name`/`last_name` via `to_jsonb(p)` automatiquement → opt-in names sont dans l'export sans code dédié.

**Push subscriptions** : on n'exporte JAMAIS `p256dh` ni `auth_secret` (l. 2991-2997). Ces clés permettent à un acteur tiers d'envoyer des push notifications. Les omettre est cohérent avec leur statut de "secret partagé client/serveur".

---

## 11. Visibility-aware RLS (v6)

`piano_sessions.visibility text default 'public' check in ('public','friends')`. Set-once via trigger BEFORE UPDATE :

```sql
create function reject_visibility_update() returns trigger as $$
begin
  if new.visibility is distinct from old.visibility then
    raise exception 'visibility is set-once' using errcode = '42501';
  end if;
  return new;
end$$;
```

RLS SELECT visibility-aware (l. 1965-1971) :

```sql
create policy piano_sessions_select on public.piano_sessions
  for select using (
    visibility = 'public'
    or auth.uid() = user_id
    or public.is_admin()
    or (auth.uid() is not null and public.are_friends(auth.uid(), user_id))
  );
```

**Pourquoi set-once ?** Pour éviter la race avec le trigger AFTER INSERT `queue_friend_arriving_notification` : si on changeait visibility de 'friends' à 'public' après enqueue, les notifs amis seraient déjà parties.

### `are_friends(a, b)` — guard anti-graph-probing

Section 14.b (l. 1878-1896). RPC `SECURITY DEFINER stable` :

```sql
if auth.uid() not in (a, b) and not public.is_admin() then
  raise exception 'forbidden' using errcode = '42501';
end if;
return exists(
  select 1 from public.friendships
  where status = 'accepted'
    and user_a = least(a, b) and user_b = greatest(a, b)
);
```

Sans la garde, un attaquant pouvait probe le graphe d'amitié entier via `are_friends(victim_a, victim_b)` pour des victimes arbitraires. Garde refusée → erreur `forbidden`.

### `are_friends_safe(a, b)` — variant service_role only

Section 14.b (l. 1904-1920). Même check, **sans la garde caller-in-(a,b)**. Granted uniquement à `service_role` → appelable seulement par l'Edge Function pour la re-vérification à delivery time des notifs `friend_arriving`. Empêche la fuite de localisation si l'amitié a été retirée entre enqueue et delivery (race privacy P1).

---

## 12. Friendships — tables invisibles

Section 14.a (l. 1805-1839). Les 3 tables v6 sont **totalement invisibles côté client** :

```sql
alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;
-- AUCUNE policy → tout SELECT/INSERT/UPDATE/DELETE refusé côté PostgREST
```

Idem pour `friendship_rejections` et `friend_arriving_dedup`. L'accès passe **exclusivement** par les 10 RPCs v6 (voir [RPCS.md](RPCS.md)).

La vue `friendships_symmetric` (l. 1833-1839, `security_invoker = true`) symétrise UNION ALL `(user_a, user_b)` ↔ `(user_b, user_a)` — utile pour les RPCs internes. Aussi REVOKE ALL côté client.

### Anti-stalking — `friendship_rejections` cooldown 30j

Sans cooldown, un user pouvait re-envoyer une demande d'ami infiniment après chaque rejet → vecteur de harcèlement.

Section 14.a (l. 1845-1850) :

```sql
create table public.friendship_rejections (
  requester_id  uuid references profiles(id) on delete cascade,
  target_id     uuid references profiles(id) on delete cascade,
  rejected_at   timestamptz default now(),
  primary key (requester_id, target_id)
);
```

`send_friend_request(target)` (l. 2079) check ce cooldown au début. Si une row existe avec `rejected_at > now() - interval '30 days'` → raise `forbidden` **silencieux** (ghost reject — le rejeté ne sait pas pourquoi).

Purge nightly via pg_cron (à activer) : `DELETE WHERE rejected_at < now() - interval '30 days'`.

### Anti-spam — `friend_arriving_dedup` (1h)

Section 14.a (l. 1860-1866). Sans dedup, un user créant 10 sessions sur le même piano dans la journée enqueue 10× la même notif à chaque ami.

`queue_friend_arriving_notification` (l. 2004-2065) check via anti-join sur `friend_arriving_dedup` avec fenêtre 1h. Si une row `(recipient, sender, piano_id)` existe avec `last_queued_at > now() - interval '1 hour'`, skip. Sinon UPSERT après enqueue.

Purge nightly via pg_cron : `DELETE WHERE last_queued_at < now() - interval '7 days'`.

---

## 13. v7 — privacy contracts spécifiques

### `find_user_by_email` — anti account-enumeration

Email-search est un vecteur d'attaque classique. Mitigations cumulatives :

1. RPC `SECURITY DEFINER set search_path = public`
2. **Exact-match strict** : `WHERE lower(u.email) = lower(trim(p_email))` — pas de `ILIKE %`, pas de fuzzy
3. **Rate-limit 5/24h** par caller via `enforce_caller_rate_limit('user_search_email', 5, '24 hours')` (l. 2737)
4. **Auth-only** : `if auth.uid() is null then raise 'forbidden'`
5. **Pas d'audit log** : ne pas créer un registre "qui a cherché qui par email" (RGPD ; le rate-limit suffit)
6. **Réponse minimale** : retourne `(id, pseudo, first_name, last_name, created_at)`. **Jamais l'email** (le caller le connaît déjà)
7. **0 row si non trouvé OU banned** : pas de leak d'existence (même réponse pour "compte inexistant" et "compte banni")

### `first_name` / `last_name` — opt-in RGPD

- Colonnes `text` nullables, length CHECK 1-50
- **Default NULL** : nouveau user n'a rien à remplir
- **Column-grants EXCLUS** des grants anon+auth → invisibles via PostgREST direct
- Lecture **uniquement** via RPCs `get_my_profile` (self), `search_users` (search-time, retournés), `find_user_by_email` (lookup, retournés)
- Update **uniquement** via RPC `update_my_profile_names(p_first, p_last)` (l. 2812) — NULL ou string vide = clear
- Affichage : si l'user les a remplis, retournés en clair (opt-in display)
- Export RGPD : inclus automatiquement via `to_jsonb(profile)`

### `piano_favorites` — self-only classique

- PK `(piano_id, user_id)` → unicité native, dédup garantie
- RLS SELECT/INSERT/DELETE self only
- **Pas de rate-limit dédié** : la PK contraint déjà la dédup ; toggle = INSERT ou DELETE, pas de spam possible
- `toggle_piano_favorite(p_piano)` (l. 2847) advisory lock `(uid, 'fav', piano_id)` pour double-click resilience

---

## 14. Sentry scrubber PII

[src/lib/sentry.ts](../src/lib/sentry.ts) — `beforeSend` hook qui filtre les events avant envoi à Sentry :

- Strip les emails dans les messages et stack traces (regex `[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`)
- Strip les JWT tokens (regex `eyJ[\w-]+\.[\w-]+\.[\w-]+`)
- Strip les bearer tokens dans les headers
- Strip les query strings sensibles (`?token=`, `?access_token=`)

Important pour le free tier Sentry : si on leak des emails users vers Sentry, c'est une violation RGPD (data processor pas listé dans le DPA).

---

## 15. Headers de sécurité — `vercel.json`

[vercel.json](../vercel.json) configure les headers HTTP pour toutes les routes :

- **HSTS** : `max-age=63072000; includeSubDomains; preload` (2 ans, eligible HSTS preload list)
- **X-Frame-Options** : `DENY` (anti-clickjacking)
- **X-Content-Type-Options** : `nosniff`
- **Referrer-Policy** : `strict-origin-when-cross-origin`
- **Cross-Origin-Opener-Policy** : `same-origin`
- **Cross-Origin-Resource-Policy** : `same-origin`
- **Permissions-Policy** : restrictive (géoloc + caméra autorisées `self` uniquement)
- **CSP** : `connect-src` whitelist (Supabase wss+https, tile CDNs OSM+CARTO, Photon, Nominatim, Sentry, Resend API), `frame-ancestors 'none'`, `base-uri 'self'`, `upgrade-insecure-requests`

⚠️ **CSP `'unsafe-inline'` encore présent** sur `script-src` + `style-src`. A.5 du backlog : nonces via Vercel Edge middleware.

---

## 16. Threat model et backlog risques

### Mitigés

| Menace                               | Couche                                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| SQL injection                        | PostgREST + parameterized queries, jamais de string concat dans les RPCs                                                           |
| XSS                                  | React JSX escape par défaut ; `escapeHtml()` + `sanitizeHeader()` dans templates Edge Function ; CSP                               |
| CSRF                                 | Pas de cookie de session (JWT en Authorization header) → CSRF non applicable                                                       |
| Account enumeration via signup       | Supabase fait du rate-limit côté serveur ; messages d'erreur génériques (ForgotPassword affiche toujours "si un compte existe...") |
| Account enumeration via email lookup | v7 — rate-limit 5/24h + 0 row pour non trouvé/banné                                                                                |
| Brute force password                 | Supabase auth rate-limit côté serveur                                                                                              |
| Session theft → action irréversible  | Re-auth password sur RPCs critiques                                                                                                |
| RLS bypass via column-level leak     | column-grants restrictifs sur profiles                                                                                             |
| Friend graph probing                 | `are_friends()` guard anti-leak                                                                                                    |
| Notif spam intra-piano               | `friend_arriving_dedup` 1h                                                                                                         |
| Anti-stalking ami                    | `friendship_rejections` cooldown 30j                                                                                               |
| Header injection mail (CRLF)         | `sanitizeHeader()` dans templates.ts strip tous controls ASCII 0x00-0x1F + 0x7F                                                    |
| Push notification spam tier          | Limites Supabase free tier + auto-cleanup 404/410                                                                                  |
| RLS bypass via batch INSERT          | `enforce_rate_limit` advisory lock                                                                                                 |
| Cross-request race friend            | `send_friend_request` advisory lock canonical pair + auto-accept croisé                                                            |
| Cardinality leak (count vs items)    | `get_active_piano_counts` applique le même filtre visibility que `list_piano_presence`                                             |

### Sprint 7 sécu — livré

- ✅ **A.7 EXIF strip upload** : `compressPhoto` re-encode l'image en JPEG via canvas avec `preserveExif: false` explicite ([src/lib/photo.ts](../src/lib/photo.ts)). Le re-encode élimine GPS/device/IPTC/XMP. Test régression dans [photo.test.ts](../src/lib/__tests__/photo.test.ts) vérifie que la lib est bien appelée avec le flag.
- ✅ **A.6.4 rate-limit signup par IP** : Edge Function [`signup-protected`](../supabase/functions/signup-protected/index.ts) hash l'IP (SHA-256 + sel env) → RPC `check_signup_ip_allowed` (advisory lock atomic count+insert) → 5 tentatives / 24h. Fail-open si Edge Function indispo (Supabase Auth rate-limit reste actif). Frontend câblé dans `AuthContext.signUp`. Purge nightly pg_cron documentée.

### Backlog (P1/P2/P3)

- **A.1.2 chiffrement `push_subscriptions`** (P3) : `p256dh`/`auth_secret` stockées en clair. Vault Supabase nécessaire (pas dispo free tier).
- **A.5 CSP nonces** (P1, Large) : retirer `'unsafe-inline'` du `script-src` + `style-src`. **Scope précis :**
  - **`style-src`** : 15 occurrences de `style={{...}}` inline dans le code (safe-area-inset-\* sur AppShell/NavBar/Tutorial/Dialog/banners + QualityBadge dynamic backgroundColor). Soit migrer vers Tailwind arbitrary classes `[padding-bottom:env(safe-area-inset-bottom)]` + CSS vars pour QualityBadge, soit accepter hashes CSP (incompatible avec valeurs runtime).
  - **`script-src`** : Vite injecte des scripts inline au build (entry chunks) + Sentry init inline. Nonces générés par Vercel Edge middleware (au request time) injectés dans le HTML servi + dans le header CSP. Plugin Vite ou `vite-plugin-csp` pour injecter `nonce="__NONCE__"` au build, substitué par l'Edge middleware au runtime.
  - **Effort réel** : multi-jours (refactor 15 inline styles + Vercel middleware + tests Lighthouse + vérif Sentry).
- **A.6.3 2FA TOTP admin** (P3) : Supabase MFA disponible mais non câblé pour admin uniquement.
- **B.4 tests pgTAP RLS** (P2) : `supabase test db` pour valider les policies par INSERT/SELECT depuis différents rôles.

### Non couvert (out of scope)

- **DDoS** : Vercel / Cloudflare l'absorbent largement ; pas de protection applicative.
- **MITM** : HSTS preload + TLS 1.2+ par défaut côté hébergeur.
- **Vulnérabilités deps** : Dependabot weekly + `npm audit` en CI (continue-on-error informatif).
- **Backup** : Supabase free tier auto-backup quotidien rétention 7j ; pas de stratégie restore documentée.
