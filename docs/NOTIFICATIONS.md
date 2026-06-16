# Notification system — PianoWorld

Document de référence pour le système de notifications mail + push : outbox transactionnel, retry/backoff/DLQ, Edge Function `send-notification`, 9 kinds, templates HTML anti-injection.

Pour la sécurité globale voir [SECURITY.md](SECURITY.md). Pour les RPCs voir [RPCS.md](RPCS.md). Pour les paramètres user voir [src/components/Settings/NotificationPreferences.tsx](../src/components/Settings/NotificationPreferences.tsx).

---

## 1. Architecture outbox

Pattern **outbox transactionnel** : chaque trigger DB pousse une row dans [`notifications_outbox`](../supabase/schema.sql) au sein de la transaction métier. Si la transaction commit, la notif est garantie enqueued ; si rollback, rien n'est enqueued. Pas de risque de notif fantôme.

### Table `notifications_outbox` ([schema.sql:641-654](../supabase/schema.sql#L641-L654))

```sql
create table public.notifications_outbox (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references profiles(id) on delete cascade,
  kind          notification_kind not null,
  payload       jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  sent_at       timestamptz,
  error         text,
  -- v5 additions (retry/backoff/DLQ)
  status        text not null default 'pending'
                check (status in ('pending', 'sent', 'permanent_failure')),
  attempts      int not null default 0,
  next_retry_at timestamptz not null default now()
);
```

Indexes :

- `notifications_outbox_pending_idx` partial `WHERE status = 'pending'` (utilisé par `list_pending_notifications`)
- `notifications_outbox_recipient_idx` `(recipient_id, created_at desc)`
- `notifications_outbox_status_idx` `(status, next_retry_at)` (utilisé par pg_cron retry)

**RLS** : SELECT admin only ([schema.sql:660-661](../supabase/schema.sql#L660-L661)). L'Edge Function bypass via `service_role`.

### Database Webhook

Supabase Database Webhook POST chaque INSERT vers l'Edge Function `send-notification` avec header `x-webhook-secret`. Configuration dans Supabase Dashboard → Database → Webhooks ([README setup](../supabase/functions/send-notification/README.md)).

### Retry / backoff / DLQ

`mark_notification_sent(notif_id, err)` ([schema.sql:1707-1754](../supabase/schema.sql#L1707-L1754)) :

- **Succès** (err null) → `status='sent'`, `sent_at=now()`
- **Erreur** → `attempts += 1`, `next_retry_at = now() + (2 ^ attempts) min` = 2, 4, 8, 16, 32 min
- **À 5 attempts** → `status='permanent_failure'` (DLQ — Dead Letter Queue)

### pg_cron jobs

À activer dans Supabase Dashboard → Database → Extensions → `pg_cron` + `pg_net`. SQL dans le commentaire section 13 de schema.sql :

```sql
select cron.schedule('notif-retry', '*/5 * * * *', $$
  select net.http_post(
    url := '<EDGE_FUNCTION_URL>/send-notification',
    headers := jsonb_build_object(
      'x-webhook-secret', '<WEBHOOK_SECRET>',
      'content-type', 'application/json'
    ),
    body := jsonb_build_object('record', jsonb_build_object('id', id))
  )
  from public.list_pending_notifications(50);
$$);

select cron.schedule('notif-purge', '17 3 * * *', $$
  select public.purge_old_notifications();
$$);
```

- **notif-retry** : toutes les 5 min, POST le webhook avec les IDs renvoyés par `list_pending_notifications(50)` (rows `status='pending' AND next_retry_at <= now()`).
- **notif-purge** : nightly à 03:17 UTC, DELETE des rows `sent` ou `permanent_failure` plus vieilles que 30 jours.

---

## 2. 9 notification kinds (post v7)

L'enum `notification_kind` ([schema.sql:631-637](../supabase/schema.sql#L631-L637) + extensions v6 et v7) compte 9 valeurs :

| Kind                           | Trigger source                                                                    | Payload                                                                                                   | Template                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `piano_comment`                | `queue_piano_update_notification` (branche avec comment)                          | `piano_id, piano_address, update_id, still_there, new_quality, comment, updated_by`                       | [templates.ts:120](../supabase/functions/send-notification/templates.ts#L120) |
| `piano_update`                 | `queue_piano_update_notification` (branche sans comment)                          | idem                                                                                                      | [templates.ts:142](../supabase/functions/send-notification/templates.ts#L142) |
| `session_conflict`             | `queue_session_conflict_notification`                                             | `piano_id, piano_address, session_id, other_user_id, their_starts_at, their_duration_min, my_starts_at`   | [templates.ts:159](../supabase/functions/send-notification/templates.ts#L159) |
| `request_reply`                | inline dans `reply_to_request`                                                    | `request_id, subject, reply`                                                                              | [templates.ts:176](../supabase/functions/send-notification/templates.ts#L176) |
| `event_created`                | `queue_event_notifications`                                                       | `event_id, title, location, starts_at`                                                                    | [templates.ts:194](../supabase/functions/send-notification/templates.ts#L194) |
| `friend_arriving` (v6)         | `queue_friend_arriving_notification`                                              | `piano_id, piano_address, session_id, starts_at, duration_min, sender_user_id, sender_pseudo, visibility` | [templates.ts:212](../supabase/functions/send-notification/templates.ts#L212) |
| `friend_request_received` (v6) | inline dans `send_friend_request`                                                 | `friendship_id, requester_id, requester_pseudo`                                                           | [templates.ts:240](../supabase/functions/send-notification/templates.ts#L240) |
| `friend_request_accepted` (v6) | inline dans `send_friend_request` (auto-accept croisé) et `accept_friend_request` | `friendship_id, other_user_id, other_pseudo, auto_accepted`                                               | [templates.ts:280](../supabase/functions/send-notification/templates.ts#L280) |
| `piano_favorite_update` (v7)   | `queue_favorite_update_notification`                                              | `piano_id, piano_address, update_id, updater_user_id, updater_pseudo, quality, still_there`               | [templates.ts:257](../supabase/functions/send-notification/templates.ts#L257) |

---

## 3. Triggers `queue_*` — décharge côté SQL

Pattern privilégié : **filtrer côté SQL avant l'enqueue** pour minimiser le bruit dans l'outbox. Les `queue_*` sont presque tous **set-based** (un seul `INSERT ... SELECT`) et joignent `notification_preferences` + `profiles` pour appliquer banned + pref off directement.

### `queue_piano_update_notification` ([schema.sql:666-704](../supabase/schema.sql#L666-L704))

AFTER INSERT sur `piano_updates`. Skip si pas de créateur ou si l'updater est le créateur. Switch `kind` selon présence de `comment` : `piano_comment` si `new.comment IS NOT NULL`, sinon `piano_update`.

### `queue_session_conflict_notification` ([schema.sql:712-759](../supabase/schema.sql#L712-L759))

AFTER INSERT sur `piano_sessions`. Détecte les chevauchements via `tstzrange && tstzrange` (overlap operator Postgres). Pour chaque session sur le même piano qui chevauche, enqueue une notif `session_conflict` au user de cette session existante (filtré banned + pref off).

### `queue_event_notifications` ([schema.sql:771-796](../supabase/schema.sql#L771-L796))

AFTER INSERT sur `events`. **Set-based** : un seul `INSERT ... SELECT ... FROM profiles INNER JOIN notification_preferences ... WHERE notify_events = true` → fan-out à tous les users non bannis avec pref activée.

### `queue_request_reply` (inline)

Pas un trigger mais inline dans la RPC `reply_to_request` ([schema.sql:829-840](../supabase/schema.sql#L829-L840)). Enqueue une notif `request_reply` pour l'auteur de la demande à la fin de la mutation.

### `queue_friend_arriving_notification` (v6, [schema.sql:2004-2065](../supabase/schema.sql#L2004-L2065))

AFTER INSERT sur `piano_sessions`. **Set-based avec CTE `eligibles`** :

1. JOIN `friendships_symmetric` pour récupérer la liste des amis du sender
2. JOIN `notification_preferences np` filter `np.notify_friend_arriving = true`
3. JOIN `profiles recipient` filter `recipient.banned_at IS NULL`
4. JOIN `profiles sender` filter `sender.banned_at IS NULL`
5. **Anti-join `friend_arriving_dedup`** avec fenêtre 1h pour la déduplication horaire

```sql
LEFT JOIN public.friend_arriving_dedup d
       ON d.recipient_id = fs.friend_id
      AND d.sender_id    = new.user_id
      AND d.piano_id     = new.piano_id
      AND d.last_queued_at > now() - interval '1 hour'
WHERE ...
  AND d.recipient_id IS NULL  -- only enqueue if no recent dedup row
```

6. UPSERT dans `friend_arriving_dedup` pour chaque row effectivement enqueued.

**Snapshot critique** : le payload jsonb contient `sender_pseudo` (snapshotté via `JOIN profiles sender`) et `piano_address` (snapshotté via subquery). Si le sender supprime son compte entre enqueue et delivery, l'Edge Function peut quand même rendre un mail avec le pseudo correct.

Skip si :

- `new.cancelled_at IS NOT NULL`
- `new.starts_at < now() - interval '5 minutes'` (anti-backfill)
- `new.visibility = 'public'` ? Non — visibility `public` fait quand même fan-out aux amis (logique : tu veux que tes amis sachent où tu vas jouer, même si la session est publique).

### `queue_favorite_update_notification` (v7, [schema.sql:2567-2596](../supabase/schema.sql#L2567-L2596))

AFTER INSERT sur `piano_updates`. **Set-based** :

```sql
INSERT INTO notifications_outbox (recipient_id, kind, payload)
SELECT pf.user_id, 'piano_favorite_update',
       jsonb_build_object(
         'piano_id',       new.piano_id,
         'piano_address',  (SELECT address FROM pianos WHERE id = new.piano_id),
         'update_id',      new.id,
         'updater_user_id', new.updated_by,
         'updater_pseudo', upd.pseudo,
         'quality',        new.quality,
         'still_there',    new.still_there
       )
FROM piano_favorites pf
JOIN profiles recipient ON recipient.id = pf.user_id
JOIN notification_preferences np ON np.user_id = pf.user_id
LEFT JOIN profiles upd ON upd.id = new.updated_by
WHERE pf.piano_id = new.piano_id
  AND pf.user_id <> COALESCE(new.updated_by, '00000000-...'::uuid)  -- exclude updater
  AND recipient.banned_at IS NULL
  AND np.notify_favorite_update = true;
```

Snapshot `piano_address` + `updater_pseudo` dans le payload (même pattern que v6).

**Pas de dedup pour favoris** v7 : on assume que le piano n'est pas mis à jour souvent. Si un piano "populaire" reçoit beaucoup d'updates, le risque d'outbox bloat existe — voir backlog dans [SECURITY.md §16](SECURITY.md#16-threat-model-et-backlog-risques) (option : table `favorite_update_dedup` similar à v6 si observed).

---

## 4. Edge Function `send-notification` — flow

[supabase/functions/send-notification/index.ts](../supabase/functions/send-notification/index.ts)

Code Deno (`@ts-nocheck` car types résolus à l'exécution). Flow détaillé :

### 1. POST + secret timing-safe ([index.ts:280-287](../supabase/functions/send-notification/index.ts#L280-L287))

```ts
if (!WEBHOOK_SECRET) return new Response('not configured', { status: 503 })
const provided = req.headers.get('x-webhook-secret') ?? ''
if (!timingSafeEqual(provided, WEBHOOK_SECRET)) {
  return new Response('forbidden', { status: 403 })
}
```

`timingSafeEqual` ([index.ts:87-94](../supabase/functions/send-notification/index.ts#L87-L94)) — XOR byte-by-byte sans early-return pour empêcher les timing attacks. Fail-closed si `WEBHOOK_SECRET` absent (refuse 503 plutôt qu'ouvrir).

### 2. Re-fetch row from DB ([index.ts:170-187](../supabase/functions/send-notification/index.ts#L170-L187))

```ts
const recordId: string = body?.record?.id
const { data: row } = await supabase
  .from('notifications_outbox')
  .select('*')
  .eq('id', recordId)
  .maybeSingle()
```

**Principe critique** : on n'utilise QUE `body.record.id` du payload webhook. Tout le reste vient d'un SELECT service_role. Cela empêche toute injection même si :

- Le secret webhook fuite
- Un attaquant rejoue une ancienne requête
- Le payload webhook est manipulé

Si `row.sent_at IS NOT NULL` → idempotent skip (webhook rejoué).

### 3. Filtre banned recipient ([index.ts:189-202](../supabase/functions/send-notification/index.ts#L189-L202))

SELECT `profiles` pour `banned_at`. Si banni → `markSent('recipient banned')`.

### 4. Filtre prefs ([index.ts:204-214](../supabase/functions/send-notification/index.ts#L204-L214))

SELECT `notification_preferences` du recipient. Lookup `KIND_TO_PREF[kind]` → si false → `markSent('opted-out')`.

### 5. Re-vérification spécifique kind ([index.ts:216-239](../supabase/functions/send-notification/index.ts#L216-L239))

Pour `friend_arriving`, appel `are_friends_safe(sender, recipient)` à delivery time pour bloquer la fuite de localisation si l'amitié a été retirée entre enqueue et delivery :

```ts
if (row.kind === 'friend_arriving') {
  const { data: stillFriends } = await supabase.rpc('are_friends_safe', {
    a: row.payload.sender_user_id,
    b: row.recipient_id
  })
  if (!stillFriends) {
    await markSent(row.id, 'no-longer-friends')
    return
  }
}
```

`are_friends_safe` est l'unique variant granted à `service_role` (sans la garde anti-graph-probing de `are_friends`).

### 6. Mail Resend ([index.ts:96-117](../supabase/functions/send-notification/index.ts#L96-L117))

```ts
await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${RESEND_API_KEY}`, ... },
  body: JSON.stringify({
    from: `PianoWorld <${MAIL_FROM}>`,
    to: [email],
    subject: mail.subject,   // sanitized via sanitizeHeader
    html: mail.html
  })
})
```

Subject **toujours** passé par `sanitizeHeader()` (templates.ts) pour bloquer header injection.

### 7. Push web-push ([index.ts:119-159](../supabase/functions/send-notification/index.ts#L119-L159))

Conditionné par `prefs.push_enabled`. Pour chaque endpoint :

```ts
await webpush.sendNotification(
  { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_secret } },
  JSON.stringify({ title, body, url }),
  { TTL: 86_400 }
)
```

Sur 404/410 → DELETE de la souscription (endpoint expiré côté navigateur).

### 8. `mark_notification_sent` ([index.ts:161-163](../supabase/functions/send-notification/index.ts#L161-L163))

Succès ou erreur concaténée pour déclencher retry/backoff côté SQL.

---

## 5. KIND_TO_PREF map

[index.ts:58-70](../supabase/functions/send-notification/index.ts#L58-L70) :

```ts
const KIND_TO_PREF: Record<NotificationKind, string> = {
  piano_comment: 'notify_comments',
  piano_update: 'notify_piano_updates',
  session_conflict: 'notify_session_conflict',
  request_reply: 'notify_request_reply',
  event_created: 'notify_events',
  // v6 — système d'amitié
  friend_arriving: 'notify_friend_arriving',
  friend_request_received: 'notify_friend_request_received',
  friend_request_accepted: 'notify_friend_request_accepted',
  // v7 — pianos favoris
  piano_favorite_update: 'notify_favorite_update'
}
```

Si une `kind` n'est pas dans la map → l'Edge Function loggue mais n'envoie pas (fail-safe).

---

## 6. Préférences user — 9 toggles

Stockées dans `notification_preferences` (1 row par user). Auto-créée par trigger `ensure_notification_prefs()` sur signup. Defaults : tous `true` sauf `push_enabled` (false — opt-in explicite).

UI : [src/components/Settings/NotificationPreferences.tsx](../src/components/Settings/NotificationPreferences.tsx) regroupe par section via `NOTIFICATION_SECTION_OF` ([src/lib/constants.ts:120-130](../src/lib/constants.ts#L120-L130)) :

| Section               | Toggles                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------- |
| **Mes pianos**        | `notify_comments`, `notify_piano_updates`                                                    |
| **Sessions de piano** | `notify_session_conflict`                                                                    |
| **Communauté**        | `notify_events`, `notify_request_reply`                                                      |
| **Amis**              | `notify_friend_arriving`, `notify_friend_request_received`, `notify_friend_request_accepted` |

Le toggle séparé `push_enabled` gouverne uniquement le canal push (le mail part toujours si la catégorie est ON). Affiché à part dans Settings.

Optimistic update via `useNotificationPreferences` ([src/hooks/useNotificationPreferences.ts](../src/hooks/useNotificationPreferences.ts)) — merge `prev + patch` en cache, rollback `prev` en `onError`, invalidation finale en `onSettled`.

### ⚠️ Transitional state v7 PR-A

**`notify_favorite_update`** existe en DB ([schema.sql:2560-2561](../supabase/schema.sql#L2560-L2561)) + dans `KIND_TO_PREF` (Edge Function) + dans `DEFAULTS` ([useNotificationPreferences.ts:24](../src/hooks/useNotificationPreferences.ts#L24)) — mais n'est **PAS** encore enregistré dans `NOTIFICATION_CATEGORIES` ([src/lib/constants.ts:92-102](../src/lib/constants.ts#L92-L102)) côté UI.

**Conséquence** : tant que PR-B v7 n'est pas mergée, le toggle n'apparaît pas dans Settings → Notifications. Les users reçoivent les notifs MAJ favoris (default `true`) sans pouvoir opt-out via UI. À fixer dans PR-B v7 en ajoutant l'entry au tableau `NOTIFICATION_CATEGORIES` + `NOTIFICATION_LABELS` + `NOTIFICATION_SECTION_OF` (section `pianos`).

---

## 7. Push opt-in flow

[src/lib/web-push.ts](../src/lib/web-push.ts)

### Pré-requis VAPID

Générer les clés une fois :

```bash
npx web-push generate-vapid-keys
```

Stocker la clé publique dans `VITE_VAPID_PUBLIC_KEY` (.env client) et les deux clés côté Edge Function secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).

### `subscribeToPush(userId)` ([web-push.ts:56-121](../src/lib/web-push.ts#L56-L121))

1. Check `pushSupported()` ([web-push.ts:18-22](../src/lib/web-push.ts#L18-L22)) : `serviceWorker` + `PushManager` + `Notification` API présents
2. `Notification.requestPermission()` — bail si refusé
3. `serviceWorker.ready` → `reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
4. Upsert `push_subscriptions(user_id, endpoint, p256dh, auth_secret, user_agent)` avec `onConflict: 'endpoint'`

### `unsubscribeFromPush(userId)` ([web-push.ts:124-150](../src/lib/web-push.ts#L124-L150))

1. `sub.unsubscribe()`
2. DELETE filtré par `(user_id, endpoint)`

### UI

Toggle dans [src/components/Settings/NotificationPreferences.tsx:41-74](../src/components/Settings/NotificationPreferences.tsx#L41-L74) :

```tsx
async function handlePushToggle(enabled: boolean) {
  setPushBusy(true)
  try {
    if (enabled) await subscribeToPush(user.id)
    else await unsubscribeFromPush(user.id)
    await update({ push_enabled: enabled }) // optimistic via useNotificationPreferences
  } finally {
    setPushBusy(false)
  }
}
```

### iOS Safari

Push notifications fonctionnent **uniquement** avec PWA installée ("Ajouter à l'écran d'accueil"). Pas en onglet Safari classique. Indicateur dans [NotificationPreferences.tsx:114](../src/components/Settings/NotificationPreferences.tsx#L114) qui détecte iOS standalone mode.

---

## 8. Templates HTML

[supabase/functions/send-notification/templates.ts](../supabase/functions/send-notification/templates.ts)

### Shell email ([templates.ts:61-91](../supabase/functions/send-notification/templates.ts#L61-L91))

```ts
function shell(title: string, bodyHtml: string, cta?: { label: string; url: string })
```

Coquille email mobile-first :

- Palette "bois de piano" : `#FAF6F1` (crème background), `#FFFDF9` (card), `#3F2E20` (texte), `#B5651D` (ambre primary)
- Container `max-width: 520px` (lisible mobile + desktop)
- CTA button stylé inline si fourni
- Footer rappelant le chemin "Paramètres → Notifications" pour opt-out

### Anti-injection

**`escapeHtml(s)`** ([templates.ts:93-100](../supabase/functions/send-notification/templates.ts#L93-L100)) — escape `&<>"'` pour tout body HTML.

**`sanitizeHeader(input)`** ([templates.ts:53-59](../supabase/functions/send-notification/templates.ts#L53-L59)) — appelée sur tout `subject:`, `pushTitle`, `pushBody` :

1. Supprime tous les contrôles ASCII `0x00-0x1F` + `0x7F` (via `CONTROL_CHARS_PATTERN` construit dynamiquement pour éviter les bytes bruts dans le source, [templates.ts:40-45](../supabase/functions/send-notification/templates.ts#L40-L45))
2. Collapse les espaces multiples
3. Tronque à `HEADER_MAX_LENGTH = 180`

**Pourquoi critique** : Resend ne ré-encode pas le subject. Sans `sanitizeHeader`, un `\r\n` dans une chaîne user-supplied permettrait header injection (`Bcc:`, `X-Hidden:`, etc.).

### `formatDateFr(iso)` ([templates.ts:102-111](../supabase/functions/send-notification/templates.ts#L102-L111))

`d.toLocaleString('fr-FR', { weekday, day, month, hour, minute })` pour `session_conflict`, `event_created`, `friend_arriving` futur.

### Cas particuliers de wording

**`friend_arriving`** ([templates.ts:212-239](../supabase/functions/send-notification/templates.ts#L212-L239)) — recalcule **isLive** à delivery time :

```ts
const isLive =
  !isNaN(startsMs) && startsMs <= nowMs && nowMs <= startsMs + durMin * 60_000
const verb = isLive ? 'joue actuellement' : 'va jouer'
```

Le mail rendu reflète l'état au moment de la livraison, pas de l'enqueue.

**`friend_request_accepted`** ([templates.ts:280-305](../supabase/functions/send-notification/templates.ts#L280-L305)) — switch subject + body selon `payload.auto_accepted` (cas auto-accept croisé v6 [schema.sql:2124-2141](../supabase/schema.sql#L2124-L2141)) :

- `auto_accepted = true` → "Vous avez tous les deux voulu vous ajouter en même temps — vous êtes maintenant amis ! 🎉"
- `auto_accepted = false` → "@X a accepté ta demande d'ami."

---

## 9. Test & debug

### Local dev — pas d'envoi réel

L'Edge Function n'est pas appelée en local par défaut (pas de webhook configuré sur le Supabase local). Pour tester :

```bash
supabase functions serve send-notification --env-file .env.local
# Dans un autre terminal :
curl -X POST http://localhost:54321/functions/v1/send-notification \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"record": {"id": "<outbox_uuid>"}}'
```

### Inspecter l'outbox

```sql
-- Notifs récentes
SELECT id, recipient_id, kind, status, attempts, error, created_at, sent_at
FROM notifications_outbox
ORDER BY created_at DESC
LIMIT 20;

-- Stuck retries
SELECT * FROM notifications_outbox
WHERE status = 'pending' AND attempts > 0
ORDER BY next_retry_at;

-- DLQ
SELECT * FROM notifications_outbox
WHERE status = 'permanent_failure'
ORDER BY created_at DESC;
```

### Re-trigger une notif manuellement

```sql
-- Reset attempts pour rejouer
UPDATE notifications_outbox
SET status = 'pending', attempts = 0, next_retry_at = now(), error = null
WHERE id = '<uuid>';
```

Au prochain pg_cron run (5 min), elle sera re-tentée.

### Tests Vitest (à venir)

`templates.ts` est pure-function donc testable. Tests à écrire (backlog B.3) :

- `sanitizeHeader` : input avec `\r\n` → output sans
- `sanitizeHeader` : input avec ASCII control chars → output strip
- `sanitizeHeader` : input >180 chars → truncated `…`
- `escapeHtml` : `<script>` → `&lt;script&gt;`
- `renderMail('friend_arriving', { startsAt: live }, ...)` → verb "joue actuellement"
- `renderMail('friend_request_accepted', { auto_accepted: true }, ...)` → subject avec "🎉"
