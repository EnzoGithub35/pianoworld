# send-notification — Edge Function PianoWorld

Webhook handler déclenché par Supabase Database Webhook sur `INSERT` dans la table `notifications_outbox`. Envoie un mail (Resend) + un push (Web Push API) à l'utilisateur destinataire selon ses préférences.

## Setup (une fois)

### 1. Compte Resend

1. Crée un compte sur [resend.com](https://resend.com) (gratuit, 3000 mails/mois, 100/jour)
2. `Settings → API Keys → Create API Key` → copie la clé (`re_...`)
3. **Domaine** :
   - **Pour démarrer** : laisser `MAIL_FROM=onboarding@resend.dev`. Tu ne pourras envoyer qu'à l'adresse mail de ton compte Resend (= test mode).
   - **Pour la prod** : ajoute un domaine dans Resend, configure les DNS (SPF/DKIM/DMARC), puis change `MAIL_FROM=no-reply@<ton-domaine>`.

### 2. Générer les clés VAPID pour le Web Push

```bash
npx web-push generate-vapid-keys
```

Garde les deux clés. La **publique** va aussi côté frontend (variable `VITE_VAPID_PUBLIC_KEY` dans `.env`).

### 3. Générer un secret de webhook

Sans secret, l'Edge Function refuse toutes les requêtes (mode "fail closed"). Génère un secret aléatoire :

```bash
openssl rand -base64 32
# ou en PowerShell :
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Garde le résultat. Il sera utilisé dans 2 endroits : (a) secrets de l'Edge Function, (b) header HTTP du webhook Supabase.

### 4. Configurer les secrets de la fonction

Dans Supabase Dashboard → `Edge Functions → Manage secrets` :

| Clé                 | Valeur                                                |
| ------------------- | ----------------------------------------------------- |
| `WEBHOOK_SECRET`    | string aléatoire généré ci-dessus                     |
| `RESEND_API_KEY`    | `re_...`                                              |
| `MAIL_FROM`         | `onboarding@resend.dev` (test) ou `no-reply@<domain>` |
| `APP_URL`           | `https://pianoworld.vercel.app` (ton URL de prod)     |
| `VAPID_PUBLIC_KEY`  | clé publique générée                                  |
| `VAPID_PRIVATE_KEY` | clé privée générée                                    |
| `VAPID_SUBJECT`     | `mailto:enzo.reine35@gmail.com`                       |

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont auto-injectés.

### 5. Déployer la fonction

```bash
supabase functions deploy send-notification
```

### 6. Configurer le webhook Supabase

Dashboard Supabase → `Database → Webhooks → Create webhook` :

- Name : `send_notifications`
- Table : `public.notifications_outbox`
- Events : `INSERT`
- Type : `Supabase Edge Functions`
- Edge Function : `send-notification`
- Method : `POST`
- **HTTP Headers** : ajouter `x-webhook-secret` = même valeur que `WEBHOOK_SECRET` ci-dessus

Sans le header `x-webhook-secret`, la fonction retourne `403 Forbidden`.

### 7. Variable d'environnement frontend

Dans `.env` du projet React :

```
VITE_VAPID_PUBLIC_KEY=<clé publique VAPID>
```

Redémarre `npm run dev` après modification.

## Tester

### Test basique v1-v4

1. Crée un piano avec un compte A
2. Avec un compte B, mets à jour le piano avec un commentaire
3. Le compte A reçoit un mail (et un push si activé sur le navigateur)

### Tests v6 (amitié)

1. **friend_request_received** : compte A envoie demande à B → B reçoit notif + mail
2. **friend_request_accepted** : B accepte → A reçoit notif (cas auto-accept croisé = 2× notif si A avait envoyé pendant que B envoyait aussi)
3. **friend_arriving** : A et B sont amis, A démarre un créneau sur un piano → B reçoit notif "A arrive sur <piano>" (dedup horaire via `friend_arriving_dedup` + re-vérif amitié à delivery time via `are_friends_safe`)

### Test v7 (favoris)

1. A favorise un piano via FavoriteButton (`toggle_piano_favorite`)
2. B (créateur ou autre user) update ce piano via `piano_updates`
3. A reçoit notif `piano_favorite_update` (trigger `queue_favorite_update_notification` enqueue 1 row par favoriter sauf l'updater lui-même)

## Debug

Logs de l'Edge Function : `supabase functions logs send-notification`

Outbox SQL (v5+ avec colonnes retry) :

```sql
select id, kind, status, attempts, sent_at, error, next_retry_at
from notifications_outbox
order by created_at desc
limit 20;
```

- `status` ∈ `pending` / `sent` / `permanent_failure` (DLQ après 5 tentatives)
- `attempts` 0..5 — incrémenté à chaque retry
- `next_retry_at` — quand le pg_cron `notif-retry` réessaiera (backoff 2/4/8/16/32 min)
- `error` — message Resend/Push si fail

Si une row reste `pending` indéfiniment :

1. Vérifier que pg_cron `notif-retry` est actif (`select * from cron.job;`)
2. Vérifier les logs Edge Function pour erreurs réseau / config secrets
3. Manuellement déclencher : `select * from list_pending_notifications(50);`

## Architecture v5+

```
Trigger DB → notifications_outbox INSERT (status='pending') → Webhook → cette Function
   ├─ fetch row depuis DB (jamais le payload webhook — anti tampering)
   ├─ fetch recipient profile + prefs
   ├─ skip si pref désactivée (KIND_TO_PREF map) OR banned
   ├─ re-vérif spécifique (friend_arriving check are_friends_safe à delivery time)
   ├─ Resend (mail) — si error → propagé à mark_notification_sent
   ├─ web-push (push, si push_enabled + endpoint subscription valide)
   └─ mark_notification_sent(notif_id, err)
        ├─ err null → status='sent', sent_at=now()
        └─ err set → attempts++, next_retry_at = now() + (2^attempts) min
                       └─ si attempts >= 5 → status='permanent_failure' (DLQ)
```

**Retry loop** : pg_cron `notif-retry` _/5 _ \* \* \* :

1. `list_pending_notifications(50)` retourne les IDs `status='pending' AND next_retry_at <= now()`
2. Pour chaque ID, re-POST le webhook (via `net.http_post`)
3. La fonction Edge re-tente → re-call `mark_notification_sent`

**Purge** : pg_cron `notif-purge` nightly DELETE rows `status IN ('sent', 'permanent_failure') AND created_at < now() - interval '30 days'`.

Voir [docs/NOTIFICATIONS.md](../../../docs/NOTIFICATIONS.md) pour l'architecture complète (templates par kind, queue triggers SQL, RLS, RGPD).
