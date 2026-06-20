# PianoWorld — Actions post-deploy & opérationnel

Ce document liste **les actions hors-code à faire côté Supabase / Vercel / GitHub** après chaque merge sur main, le **backlog opérationnel** (PWA icons, cleanup branches, Dependabot), et les **archives** des sprints récents (Sprint 7-11 livrés).

Dernière mise à jour : **2026-06-20** (Sprint 11 E2E Playwright livré, Sprints 7-11 tous fusionnés sur main).

---

## Status des Sprints (juin 2026)

| Sprint            | Branche                       | Type                     | Status   | Actions post-merge   |
| ----------------- | ----------------------------- | ------------------------ | -------- | -------------------- |
| Sprint 6 UX       | `feat/audit-sprint-6`         | Frontend pur             | ✅ mergé | Aucune               |
| Sprint 7 sécu     | `feat/audit-sprint-7-sec`     | Backend + Edge Function  | ✅ mergé | ⚠️ **Voir Annexe A** |
| Sprint 8 wording  | `feat/audit-sprint-8-wording` | Frontend + Edge Function | ✅ mergé | ⚠️ **Voir Annexe B** |
| Sprint 9 pgTAP    | `feat/audit-sprint-9-pgtap`   | Tests SQL                | ✅ mergé | Aucune               |
| Sprint 10 hygiène | `feat/audit-sprint-10`        | Frontend hygiène         | ✅ mergé | ⚠️ **Voir Annexe C** |
| Sprint 11 E2E     | `feat/audit-sprint-11-e2e`    | Tests E2E + CI           | ✅ mergé | Aucune               |

> Si tu as cloné le repo après le 2026-06-20, les annexes A/B/C s'appliquent à ton environnement Supabase (déployer Edge Functions, ajouter secrets, etc.). Si tu maintiens l'environnement existant, les annexes A et B ont déjà été exécutées.

---

## ⏭️ Backlog actif post-Sprint 11

Items restants après Sprint 11. Source canonique : [CLAUDE.md § Sprints récents (6-11)](../CLAUDE.md). Détail sécurité dans [docs/SECURITY.md § Backlog](SECURITY.md).

| #     | Item                                                           | Effort | Priorité                 |
| ----- | -------------------------------------------------------------- | ------ | ------------------------ |
| A.1.2 | Chiffrement `push_subscriptions` (Vault Supabase)              | M      | P3 — non dispo free tier |
| A.5   | CSP nonces (retirer `'unsafe-inline'`, Vercel middleware Edge) | L      | **P1** sécu              |
| A.6.3 | 2FA TOTP admin (Supabase MFA)                                  | M      | P3                       |
| B.3   | Component/hook tests Vitest + MSW                              | L      | P2                       |
| C.1   | Dialog focus trap (a11y)                                       | S      | P2                       |
| C.2   | Tabs ArrowLeft/Right keyboard handler (a11y)                   | S      | P2                       |
| C.3   | `AddFriendButton.findPendingId` stub null (UX dégradée)        | S      | P2                       |
| C.4   | AdminPage tabs URL-synced (refresh perd l'onglet)              | S      | P3                       |
| PWA   | Icons PNG `pwa-192x192.png` + `pwa-512x512.png` à générer      | XS     | P2 user-side             |

Pour démarrer un sprint sur un de ces items, ouvrir une branche `feat/audit-sprint-<n>-<topic>` (cf. [BRANCHING.md](../BRANCHING.md) convention).

---

## 📋 Checklist générale après chaque merge

À refaire à chaque PR mergée, dans l'ordre :

- [ ] `git checkout main && git pull origin main` — sync local
- [ ] Si le PR a touché `supabase/schema.sql` → exécuter le diff SQL côté Supabase (SQL Editor)
- [ ] Si le PR a touché `supabase/functions/<fn>/` → `supabase functions deploy <fn>`
- [ ] Si le PR a touché `vercel.json` → vérifier que le redeploy auto Vercel a passé (Dashboard Vercel)
- [ ] Si le PR a touché les colonnes `notification_preferences` → snapshot RLS à jour (`npm test`)
- [ ] Si le PR a touché `playwright.config.ts` ou specs E2E → run `npm run test:e2e` localement
- [ ] Test manuel de la feature livrée

---

## 🗂️ Où trouver quoi rapidement

| Tu veux…                        | Va voir                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| Migrations SQL en cours         | [supabase/schema.sql](../supabase/schema.sql) sections 14, 15, 16                         |
| Edge Functions déployées        | [supabase/functions/](../supabase/functions/) — `send-notification/`, `signup-protected/` |
| Catalogue RPCs SECURITY DEFINER | [docs/RPCS.md](RPCS.md)                                                                   |
| Backlog sécurité détaillé       | [docs/SECURITY.md](SECURITY.md) § Backlog                                                 |
| PRs Dependabot à arbitrer       | https://github.com/EnzoGithub35/pianoworld/pulls (filter `is:pr label:dependencies`)      |
| Stratégie de tests (3 tiers)    | [docs/TESTING.md](TESTING.md)                                                             |
| Status Sprints 6-11             | [CLAUDE.md § Sprints récents](../CLAUDE.md)                                               |

---

## Annexe A — Sprint 7 sécu : actions Supabase (historique)

> Toutes ces étapes ont été exécutées sur l'environnement principal le 2026-06-20. À refaire uniquement pour un nouveau projet Supabase.

### 1. Exécuter le SQL de la section 16

1. Dashboard Supabase → **SQL Editor**
2. Copier la section 16 de [supabase/schema.sql](../supabase/schema.sql) (de `-- 16. Sprint 7 sécu` jusqu'à `-- 12. Bootstrap superadmin`)
3. Exécuter — crée la table `signup_ip_attempts` + la RPC `check_signup_ip_allowed`.

### 2. Générer un sel cryptographique

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Ou en bash :

```bash
openssl rand -base64 32
```

### 3. Ajouter le sel en secret Supabase

Dashboard Supabase → **Edge Functions → Manage secrets** :

- Name : `SIGNUP_IP_HASH_SALT`
- Value : `<le sel généré>`

### 4. Déployer l'Edge Function

```bash
supabase functions deploy signup-protected
```

### 5. (Optionnel) Activer la purge nightly

Dashboard → SQL Editor :

```sql
select cron.schedule('signup-ip-attempts-purge', '37 3 * * *', $$
  delete from public.signup_ip_attempts
  where attempted_at < now() - interval '7 days';
$$);
```

### Vérification (5 min)

1. Ouvre l'app en navigation privée
2. Va sur `/auth/signup`
3. Tente 6 signups consécutifs avec 6 emails fakes différents → le 6e doit afficher "Trop de tentatives depuis cette connexion."
4. SQL Editor : `select count(*) from signup_ip_attempts;` → 5 rows

---

## Annexe B — Sprint 8 wording : re-déploiement Edge Function mail (historique)

Sprint 8 a modifié 3 strings dans [supabase/functions/send-notification/templates.ts](../supabase/functions/send-notification/templates.ts) (wording "session" → "créneau"). Sans re-déploiement, les mails continuent à dire "session".

```bash
supabase functions deploy send-notification
```

Instantané, zero downtime.

---

## Annexe C — Sprint 10 : actions user-side optionnelles (encore en attente côté user)

Sprint 10 a livré le code (Leaflet CSS lazy chunk + JSDoc cleanup + reconnexion toast + audit CTAs). Restent 3 actions **non-bloquantes** à exécuter si tu as 10 minutes :

### 1. PWA PNG icons (~5 min)

Sans ces icônes, iOS et Android utilisent une icône générique à l'install PWA.

1. Va sur https://realfavicongenerator.net
2. Upload `public/favicon.svg`
3. Web App Manifest section → couleur background `#FAF7F0` (crème PianoWorld)
4. Download le package
5. Place dans `public/` : `pwa-192x192.png`, `pwa-512x512.png`
6. Commit + push

### 2. Dependabot batch safe (~5 min)

GH dashboard https://github.com/EnzoGithub35/pianoworld/pulls :

**🟢 SAFE à merger** :

- `dependabot/npm_and_yarn/minor-and-patch-*` (groupé minor + patch)
- `dependabot/github_actions/actions/checkout-6`
- `dependabot/github_actions/actions/setup-node-6`
- `dependabot/npm_and_yarn/types/node-25.9.3`
- `dependabot/npm_and_yarn/vite-plugin-pwa-1.3.0`

**🔴 SKIP / attention** :

- `dependabot/npm_and_yarn/vitest-4.1.8` (majeure → risque snapshot RLS)
- `dependabot/npm_and_yarn/lint-staged-17.0.7` (majeure → vérifier changelog)

### 3. Cleanup branches stale (~2 min)

Après que Sprint 11 soit confirmé mergé en local :

```bash
git push origin --delete \
  feat/audit-sprint-1 feat/audit-sprint-2 feat/audit-sprint-3 \
  feat/audit-sprint-4 feat/audit-sprint-5 feat/audit-sprint-6 \
  feat/audit-sprint-7-sec feat/audit-sprint-8-wording \
  feat/audit-sprint-9-pgtap feat/audit-sprint-10 feat/audit-sprint-11-e2e \
  chore/claude-skills fix/get-my-favorites-column
```

13 branches à supprimer (toutes squash/merge sur main).

---

## Annexe D — Sprint 11 E2E : pas d'action Supabase prod requise

Sprint 11 ne touche pas `schema.sql` ni les Edge Functions → **rien à déployer côté Supabase prod**.

Pour lancer les tests E2E en local (optionnel) :

```powershell
# Prérequis : Docker Desktop, Supabase CLI (scoop install supabase), psql
npx playwright install chromium
npm run test:e2e:setup    # boot Supabase local + apply schema + seed
npm run test:e2e          # headless
npm run test:e2e:ui       # UI interactif debug
```

Détail dans [e2e/README.md](../e2e/README.md) et [docs/TESTING.md](TESTING.md).

### Lancer manuellement le workflow CI

GitHub UI → Actions → "E2E Playwright" → Run workflow. Ou :

```bash
gh workflow run "E2E Playwright"
```

Le workflow tourne aussi automatiquement chaque nuit à **03:30 UTC**. Trace artifact uploadé en cas d'échec (téléchargeable depuis Actions, rétention 7j).
