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

| Clé | Valeur |
|---|---|
| `WEBHOOK_SECRET` | string aléatoire généré ci-dessus |
| `RESEND_API_KEY` | `re_...` |
| `MAIL_FROM` | `onboarding@resend.dev` (test) ou `no-reply@<domain>` |
| `APP_URL` | `https://pianoworld.vercel.app` (ton URL de prod) |
| `VAPID_PUBLIC_KEY` | clé publique générée |
| `VAPID_PRIVATE_KEY` | clé privée générée |
| `VAPID_SUBJECT` | `mailto:enzo.reine35@gmail.com` |

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

1. Crée un piano avec un compte A
2. Avec un compte B, mets à jour le piano avec un commentaire
3. Le compte A reçoit un mail (et un push si activé sur le navigateur)

## Debug

Logs de l'Edge Function : `supabase functions logs send-notification`

Outbox SQL : `select * from notifications_outbox order by created_at desc limit 20;`
Si `sent_at` reste `null` plus de quelques secondes → vérifier les logs.
Si `error` est rempli → message d'erreur Resend/Push.

## Architecture

```
Trigger DB → notifications_outbox INSERT → Webhook → cette Function
   ├─ fetch profile + prefs
   ├─ skip si pref désactivée
   ├─ Resend (mail)
   ├─ web-push (push, si push_enabled)
   └─ mark_notification_sent (sent_at / error)
```

Idempotence : le webhook ne re-déclenche pas. Si l'envoi échoue, `error` est rempli et il faudra ré-insérer manuellement (ou faire un cron de retry — pas en v1).
