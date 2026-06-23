# PianoWorld — Environnements (staging & production)

Mise en place de **deux environnements isolés** : un **staging** (bac à sable, ce sur quoi tu itères) et une **production** (la vraie app, ne reçoit que des releases validées).

> **Décision actée** : l'environnement actuel (`pianoworld.vercel.app` + son projet Supabase) ne porte que tes propres tests → il **devient le staging tel quel**. La **production démarre sur une base propre** (nouveau projet Supabase vierge) et une nouvelle URL (nom à décider).

---

## Vue d'ensemble

| Brique               | 🟡 Staging                               | 🟢 Production (vrai)                            |
| -------------------- | ---------------------------------------- | ----------------------------------------------- |
| Front (Vercel)       | `pianoworld.vercel.app`                  | URL à décider (domaine perso ou `*.vercel.app`) |
| Projet Vercel        | l'actuel (Production Branch → `staging`) | **nouveau** projet (Production Branch → `main`) |
| Branche git          | `staging`                                | `main`                                          |
| Projet Supabase      | **l'actuel** (#1)                        | **nouveau** (#2, schéma rejoué, base vierge)    |
| Mails (Resend)       | domaine test `onboarding@resend.dev`     | domaine vérifié (SPF/DKIM)                      |
| Secrets / clés VAPID | jeu A                                    | jeu B **distinct**                              |
| Sentry               | `environment: staging`                   | `environment: production`                       |

**Règle d'or** : staging et prod ne partagent **aucune base de données ni aucun secret**. Sinon un test sur staging peut écrire dans les vraies données ou envoyer un vrai mail.

---

## Pourquoi 2 projets Supabase (et pas juste 2 fronts)

Un « environnement » = **front Vercel + back Supabase qui vont ensemble**. Dupliquer seulement le front ne sert à rien : les deux fronts taperaient dans la même base → données de test mélangées aux vraies, mails envoyés pour de vrai depuis staging, rate-limits partagés, etc. Il faut **2 projets Supabase** (chacun a sa DB, son Auth, son Storage, ses Edge Functions, ses secrets).

> Supabase free tier permet généralement **2 projets actifs par organisation** → staging + prod tiennent en gratuit (à confirmer selon ton plan actuel). Chaque projet se met en pause après 7 j d'inactivité (le staging va souvent dormir → réveil de quelques secondes au 1er accès, non bloquant).

---

## 1. Vercel — 2 projets, 1 seul repo GitHub

Vercel autorise plusieurs projets branchés sur le même repo, chacun avec sa propre « Production Branch ».

### Projet existant → devient le STAGING

- Settings → Git → **Production Branch = `staging`**.
- Garde le domaine `pianoworld.vercel.app`.
- Variables d'environnement (scope **Production** de ce projet) → pointent vers **Supabase #1 (staging)**.

### Nouveau projet → la PRODUCTION

- New Project → importer le **même repo** GitHub → framework auto-détecté (Vite).
- Settings → Git → **Production Branch = `main`**.
- Domaine : URL à décider plus tard (cf. § domaine perso).
- Variables d'environnement → pointent vers **Supabase #2 (prod)**.

### Variables d'environnement par projet

> ⚠️ Les `VITE_*` sont injectées **au build** (pas au runtime). Chaque projet Vercel rebuild avec **ses** valeurs à chaque déploiement — c'est ce qui sépare les deux environnements.

| Variable                 | Staging (projet actuel) | Prod (nouveau projet) |
| ------------------------ | ----------------------- | --------------------- |
| `VITE_SUPABASE_URL`      | URL Supabase #1         | URL Supabase #2       |
| `VITE_SUPABASE_ANON_KEY` | anon key #1             | anon key #2           |
| `VITE_VAPID_PUBLIC_KEY`  | clé publique VAPID A    | clé publique VAPID B  |
| `VITE_SENTRY_DSN`        | (optionnel) DSN staging | (optionnel) DSN prod  |

Les branches de feature continuent de générer des **Preview deployments** (sur le projet staging) — pratique pour tester un diff avant de le merger sur `staging`.

---

## 2. Supabase — créer le projet PROD (#2) propre

À faire **une fois** sur le nouveau projet (region `eu-west-3`). C'est exactement la procédure de setup d'origine, rejouée :

1. **Schéma** : SQL Editor → exécuter l'intégralité de [supabase/schema.sql](../supabase/schema.sql) (16 sections). Crée tables, RLS, RPCs, triggers, bootstrap superadmin (section 12).
2. **Auth** : `Authentication → Providers → Email` → activer **Confirm email** ; `Authentication → URL Configuration` → **Site URL** = URL de prod + **Redirect URLs** (cf. gotcha plus bas).
3. **Storage** : vérifier le bucket `piano-photos` (créé par le schéma ; sinon le créer).
4. **Edge Functions** : `supabase link --project-ref <ref #2>` puis
   `supabase functions deploy send-notification` + `supabase functions deploy signup-protected`.
5. **Secrets Edge Functions** (valeurs **prod**, cf. matrice § 4).
6. **Database Webhook** : `Database → Webhooks` → table `notifications_outbox`, event `INSERT`, type Edge Function `send-notification`, header `x-webhook-secret` = `WEBHOOK_SECRET` **prod**.
7. **pg_cron** : recréer les jobs `notif-retry` (\*/5), `notif-purge` (nightly), `signup-ip-attempts-purge` — en pointant vers l'URL de l'Edge Function **#2** et le secret **prod**.

Détail mail/push dans [supabase/functions/send-notification/README.md](../supabase/functions/send-notification/README.md), actions post-deploy dans [docs/POST-DEPLOY.md](POST-DEPLOY.md).

---

## 3. Resend / mails — ne jamais spammer de vrais users depuis staging

- **Staging** : laisser `MAIL_FROM=onboarding@resend.dev`. Ce domaine de test **n'envoie qu'à l'adresse de ton compte Resend** → impossible d'écrire à un vrai utilisateur par accident. (Alternative : un sous-domaine `staging.<domaine>` vérifié.)
- **Prod** : domaine vérifié (SPF/DKIM/DMARC) → `MAIL_FROM=no-reply@<ton-domaine>`.
- Un seul compte Resend gratuit suffit pour les deux (100 mails/j, 3000/mois — partagés).

---

## 4. Matrice des secrets Edge Functions (à séparer)

Génère des valeurs **distinctes** par environnement (ne réutilise jamais le secret du staging en prod).

| Secret                              | Staging                         | Prod                            |
| ----------------------------------- | ------------------------------- | ------------------------------- |
| `WEBHOOK_SECRET`                    | aléatoire A                     | aléatoire B                     |
| `SIGNUP_IP_HASH_SALT`               | aléatoire A                     | aléatoire B                     |
| `RESEND_API_KEY`                    | `re_...` (peut être partagée)   | `re_...`                        |
| `MAIL_FROM`                         | `onboarding@resend.dev`         | `no-reply@<domaine>`            |
| `APP_URL`                           | `https://pianoworld.vercel.app` | URL de prod                     |
| `VAPID_PUBLIC_KEY` / `_PRIVATE_KEY` | paire A                         | paire B                         |
| `VAPID_SUBJECT`                     | `mailto:enzo.reine35@gmail.com` | `mailto:enzo.reine35@gmail.com` |
| `SUPABASE_URL` / `SERVICE_ROLE_KEY` | auto-injectés #1                | auto-injectés #2                |

Générer un secret : `openssl rand -base64 32` (ou PowerShell `[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`).
Générer une paire VAPID : `npx web-push generate-vapid-keys`.

---

## 5. Sentry (optionnel mais recommandé)

Pour que les erreurs de staging ne polluent pas celles de prod, soit **2 projets Sentry**, soit un seul avec un **tag `environment`** différent. Le plus simple : alimenter `Sentry.init({ environment })` depuis une variable d'env par environnement (ex. `import.meta.env.MODE`, ou une `VITE_APP_ENV` posée dans chaque projet Vercel). Voir [src/lib/sentry.ts](../src/lib/sentry.ts).

---

## 6. Flux git (2 environnements)

```
feat/xxx ──PR──▶ staging ──(validé sur pianoworld.vercel.app)──▶ main ──▶ PROD
                   │                                               │
                   └─ deploy auto staging                          └─ deploy auto prod
```

1. Développer sur une branche `feat/` / `fix/` (Preview deploy auto).
2. PR vers **`staging`** → merge → déploie sur `pianoworld.vercel.app` (contre Supabase staging).
3. Tester sur staging (mobile inclus).
4. Quand c'est bon : merge **`staging` → `main`** → déploie en **prod**.

Détail des conventions dans [BRANCHING.md](../BRANCHING.md) (section « Environnements »).

---

## 7. Gotchas

- ✅ **CSP déjà compatible** : [vercel.json](../vercel.json) whiteliste `https://*.supabase.co wss://*.supabase.co` (wildcard) → la 2e URL Supabase passe **sans modifier le code**.
- ⚠️ **Auth redirect URLs** : chaque projet Supabase doit avoir sa **Site URL + Redirect URLs** correspondant à SON front. Sinon les liens de confirmation/reset mènent au mauvais environnement (ou cassent).
- ⚠️ **pg_cron pointe vers le bon Edge** : en prod, l'URL de la fonction et le `WEBHOOK_SECRET` du job retry doivent être ceux du projet **#2**.
- ⚠️ **Jamais d'E2E / seed contre la prod** : `npm run test:e2e:setup` et `e2e/fixtures/seed.sql` ne visent QUE le Supabase local Docker (cf. [e2e/README.md](../e2e/README.md)).
- ⚠️ **Vite ne lit pas `.env` à chaud** ni au runtime : un changement de variable d'env nécessite un redeploy (Vercel le fait à chaque déploiement).

---

## ✅ Checklist « go live » prod

- [ ] Créer le projet Supabase #2 (eu-west-3)
- [ ] Exécuter `schema.sql` complet + activer Confirm email + Site/Redirect URLs
- [ ] Déployer les 2 Edge Functions + poser les secrets **prod** (matrice § 4)
- [ ] Créer le Database Webhook (header secret prod) + les jobs pg_cron prod
- [ ] (Prod) acheter/vérifier le domaine + DNS Resend (mails propres)
- [ ] Créer le 2e projet Vercel (repo identique, Production Branch = `main`, env → Supabase #2)
- [ ] Repointer le projet Vercel existant : Production Branch = `staging`, env → Supabase #1
- [ ] Créer + pousser la branche `staging` (`git push -u origin staging`)
- [ ] Mettre à jour la branch protection : protéger `main` ET `staging`
- [ ] Smoke test : signup → mail → push sur les DEUX environnements
