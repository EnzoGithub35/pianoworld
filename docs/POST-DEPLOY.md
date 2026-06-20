# PianoWorld — Post-deploy & étapes utilisateur

Ce document liste **ce que tu dois faire** côté Supabase / Vercel / GitHub après chaque merge de PR. Garde-le à jour à chaque sprint pour éviter de perdre une étape.

Dernière mise à jour : **2026-06-20** (Sprint 8 wording, Sprint 7 sécu pushé).

---

## 🟢 PRs en attente de merge

| PR                | Branche                       | Type                          | Étapes post-merge                                     | Priorité                |
| ----------------- | ----------------------------- | ----------------------------- | ----------------------------------------------------- | ----------------------- |
| Sprint 6 UX       | `feat/audit-sprint-6`         | Frontend pur                  | Aucune                                                | 🟡 si pas encore mergée |
| **Sprint 7 sécu** | `feat/audit-sprint-7-sec`     | Backend + frontend + edge fn  | **⚠️ Étapes Supabase obligatoires** ⬇️                | 🔴 fais ça en premier   |
| Sprint 8 wording  | `feat/audit-sprint-8-wording` | Frontend + Edge Function mail | **⚠️ Re-déployer Edge Function send-notification** ⬇️ | 🟡 après Sprint 7       |

Ordre recommandé : **Sprint 7 → Sprint 8** (Sprint 8 est branché depuis Sprint 7, rebase automatique propre).

---

## 🔴 Sprint 7 sécu — Actions Supabase requises

Sans ces étapes, le frontend appellera l'Edge Function `signup-protected` qui n'existe pas → **fail-open déclenche automatiquement** (le signup procède quand même). L'app reste fonctionnelle, mais la protection IP n'est pas active.

### 1. Exécuter le SQL de la section 16

1. Va sur le dashboard Supabase → **SQL Editor**
2. Copie-colle uniquement la section 16 de [supabase/schema.sql](../supabase/schema.sql) (de `-- 16. Sprint 7 sécu` jusqu'à `-- 12. Bootstrap superadmin`)
3. Exécute. Crée la table `signup_ip_attempts` + la RPC `check_signup_ip_allowed`.

### 2. Générer un sel cryptographique

```powershell
# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Ou en bash :

```bash
openssl rand -base64 32
```

Copie la sortie (32 caractères base64).

### 3. Ajouter le sel en secret Supabase

1. Dashboard Supabase → **Edge Functions → Manage secrets**
2. Add new secret :
   - Name : `SIGNUP_IP_HASH_SALT`
   - Value : `<le sel généré à l'étape 2>`
3. Save.

### 4. Déployer l'Edge Function

Depuis la racine du repo, en local :

```bash
supabase functions deploy signup-protected
```

> ⚠️ Tu auras besoin de `supabase login` la première fois et `supabase link --project-ref <ton-ref>` pour lier au projet.

### 5. (Optionnel mais recommandé) Activer la purge nightly

Dashboard → SQL Editor :

```sql
select cron.schedule('signup-ip-attempts-purge', '37 3 * * *', $$
  delete from public.signup_ip_attempts
  where attempted_at < now() - interval '7 days';
$$);
```

Sans ça, la table grossit indéfiniment (10-100 rows/jour, donc pas critique court terme, mais propre à long terme).

### Vérification (5 min)

1. Ouvre l'app en navigation privée
2. Va sur `/auth/signup`
3. Tente 6 signups consécutifs avec 6 emails fakes différents → le 6e doit afficher "Trop de tentatives depuis cette connexion. Réessaie plus tard."
4. Vérifie dans Supabase SQL Editor : `select count(*) from signup_ip_attempts;` → 5 rows

---

## 🟡 Sprint 8 wording — Re-déployer l'Edge Function mail

Sprint 8 modifie 3 strings dans [supabase/functions/send-notification/templates.ts](../supabase/functions/send-notification/templates.ts) (wording "session" → "créneau" dans les mails). Sans re-déploiement, les mails envoyés continuent à dire "session".

```bash
supabase functions deploy send-notification
```

C'est instantané, zero downtime. Les mails déjà en queue (`notifications_outbox`) seront envoyés avec le nouveau wording.

---

## 📋 Checklist générale après chaque merge

À refaire à chaque PR mergée, dans l'ordre :

- [ ] `git checkout main && git pull origin main` — sync local
- [ ] Si le PR a touché `supabase/schema.sql` → exécuter le diff SQL côté Supabase
- [ ] Si le PR a touché `supabase/functions/<fn>/` → `supabase functions deploy <fn>`
- [ ] Si le PR a touché `vercel.json` → vérifier que le redeploy automatique Vercel a passé (Dashboard Vercel)
- [ ] Si le PR a touché les `notification_preferences` colonnes → vérifier que le snapshot RLS est à jour (`npm test`)
- [ ] Test manuel de la feature livrée (cf. section verif de chaque sprint)

---

## 🗂️ Récap général — où trouver quoi

| Tu veux…                                  | Va voir                                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Migrations SQL en cours                   | [supabase/schema.sql](../supabase/schema.sql) sections 14, 15, 16                                         |
| Edge Functions                            | [supabase/functions/](../supabase/functions/) — `send-notification/`, `signup-protected/` (Sprint 7 sécu) |
| Backlog audit V7 résiduel                 | [docs/AUDIT-V7.md](AUDIT-V7.md) (si présent) ou la roadmap dans le plan file                              |
| Backlog sécurité (CSP, 2FA, push chiffré) | [docs/SECURITY.md](SECURITY.md) section "Backlog"                                                         |
| PRs Dependabot à arbitrer                 | https://github.com/EnzoGithub35/pianoworld/pulls (filter `is:pr label:dependencies`)                      |
| Vieilles branches à nettoyer              | `git branch -r                                                                                            | grep fix/` — toutes mergées via squash, safe à supprimer |

---

## ⏭️ Prochaines étapes (post merge Sprint 7 + 8)

1. **Sprint 9 sécu — A.5 CSP nonces** (P1, Large) : retirer `'unsafe-inline'` du CSP. Scope précis dans [docs/SECURITY.md](SECURITY.md) section Backlog A.5.
2. **Sprint 9 alt — Track tests** : B.4 pgTAP RLS (M) → B.3 composants/hooks MSW (L) → B.5 Playwright e2e (L).
3. **Track D dette technique** (Quick wins ~30 min total) : PWA icons + Dependabot batch safe + cleanup branches stale.

Quand tu auras décidé, on rebascule en plan mode pour designer le Sprint 9.

---

## 🧹 Sprint 10 — Actions user-side (hors-code)

Sprint 10 a livré le code (Leaflet CSS chunk + JSDoc cleanup + reconnexion toast + audit CTAs). Reste 3 actions **à exécuter par toi** quand tu as 10 minutes :

### 1. PWA PNG icons (~5 min)

Sans ces icônes, iOS et Android utilisent une icône générique à l'install PWA.

1. Va sur **https://realfavicongenerator.net**
2. Upload `public/favicon.svg`
3. Configure : Web App Manifest section → couleur background `#FAF7F0` (crème PianoWorld)
4. Download le package
5. Extrait et place dans `public/` :
   - `pwa-192x192.png`
   - `pwa-512x512.png`
6. Commit + push

### 2. Dependabot batch safe (~5 min)

Va sur https://github.com/EnzoGithub35/pianoworld/pulls et merge en batch :

**🟢 SAFE à merger** :

- `dependabot/npm_and_yarn/minor-and-patch-*` (groupé minor + patch)
- `dependabot/github_actions/actions/checkout-6`
- `dependabot/github_actions/actions/setup-node-6`
- `dependabot/npm_and_yarn/types/node-25.9.3`
- `dependabot/npm_and_yarn/vite-plugin-pwa-1.3.0`

**🔴 SKIP / attention** :

- `dependabot/npm_and_yarn/vitest-4.1.8` (majeure → risque casser snapshot RLS, attendre un sprint dédié)
- `dependabot/npm_and_yarn/lint-staged-17.0.7` (majeure → vérifier le changelog avant merge)

### 3. Cleanup branches stale (~2 min)

Après que Sprint 9 pgTAP soit mergé, exécute en local :

```bash
git push origin --delete \
  feat/audit-sprint-1 \
  feat/audit-sprint-2 \
  feat/audit-sprint-3 \
  feat/audit-sprint-4 \
  feat/audit-sprint-5 \
  feat/audit-sprint-6 \
  feat/audit-sprint-7-sec \
  feat/audit-sprint-8-wording \
  feat/audit-sprint-9-pgtap \
  chore/claude-skills \
  fix/get-my-favorites-column
```

Ces branches sont toutes mergées via squash sur main (ou superseded par Sprint 9 dans le cas de `fix/get-my-favorites-column`). Le contenu est préservé dans l'historique main.

### Bilan attendu post Sprint 10 + actions user-side

- Bundle index gzip réduit (~6 KB éco Leaflet CSS)
- Icônes PWA propres iOS/Android
- 5 PRs Dependabot fermées (deps à jour)
- Repo nettoyé (11 branches feat/audit + 1 chore + 1 fix supprimées)
- Toast reconnexion : plus de splash silencieux
- JSDoc datés cleanup
