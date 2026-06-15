---
name: ship-it
description: Orchestre un pré-déploiement PianoWorld complet via Workflow multi-agents 3 phases — Quality (typecheck/lint/test/build en parallèle), Security (RLS/RPC/frontend/edge en parallèle), Synthèse avec verdict GO/NO-GO et checklist priorisée P0/P1/P2 de fixes requis avec file:line. Permet de valider qu'une branche est ready à merger sur main avant push. Use this skill when the user asks "ready à push", "ship check", "vérif avant deploy", "ready to ship", "audit avant PR", "tout est nickel ?", or invokes /ship-it directly.
---

# Ship-It

Orchestrateur pré-déploiement PianoWorld. Lance un Workflow en 3 phases pour valider qu'une branche est ready à merger sur main : quality (lint/types/tests/build) + security (RLS/RPC/frontend/edge) + verdict GO/NO-GO.

⚠️ **Ce skill appelle le tool Workflow (multi-agents, facturé).** Il ne doit tourner que sur invocation explicite de l'utilisateur (`/ship-it` ou demande directe). Ne pas le déclencher automatiquement.

## When to use this skill

- L'utilisateur dit "ready à push", "ship check", "vérif avant deploy", "ready to ship", "audit avant PR", "tout est nickel ?"
- L'utilisateur invoque `/ship-it` directement
- Avant la création d'une PR (en complément de la CI qui tourne après push)
- Avant de squash & merge sur main

**Différence avec `/quality-check`** :

- `/quality-check` = gate locale rapide (typecheck + lint + test + build, ~30s)
- `/ship-it` = gate locale rapide + audit sécurité multi-axes (~3-5 min)

**Différence avec `/security-audit`** :

- `/security-audit` = audit profond standalone (6 axes incluant CSP, RGPD) sans quality check
- `/ship-it` = quality check + audit ciblé sur les 4 axes critiques pour ship (RLS, RPC, frontend, edge)

## Steps

### Étape 1 — Lancer le Workflow

**Le user a explicitement opté-in via la slash-command `/ship-it`** — appel direct au Workflow tool autorisé.

Voir la section "Workflow script" ci-dessous.

### Étape 2 — Présenter le verdict

Synthèse claire : verdict GO ou NO-GO, suivi de la checklist priorisée si NO-GO.

## Workflow script

```javascript
export const meta = {
  name: 'ship-it',
  description: 'Pré-déploiement PianoWorld : quality + security + verdict',
  phases: [
    { title: 'Quality', detail: 'typecheck, lint, tests, build en parallèle' },
    { title: 'Security', detail: 'RLS, RPC, frontend, edge en parallèle' },
    { title: 'Verdict', detail: 'GO/NO-GO + checklist priorisée' }
  ]
}

const CHECK_SCHEMA = {
  type: 'object',
  required: ['ok', 'summary'],
  properties: {
    ok: { type: 'boolean' },
    summary: { type: 'string' },
    errors: { type: 'array', items: { type: 'string' } },
    metric: { type: 'string' }
  }
}

const SECURITY_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'file', 'issue', 'suggested_fix'],
        properties: {
          severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          file: { type: 'string' },
          line: { type: 'number' },
          issue: { type: 'string' },
          suggested_fix: { type: 'string' }
        }
      }
    }
  }
}

// Phase 1 — Quality (4 agents en parallèle)
phase('Quality')
const quality = await parallel([
  () =>
    agent(
      `Exécute "npm run typecheck" et rapporte le résultat.
- ok=true si exit code 0, ok=false sinon.
- summary: une phrase courte ("TS clean" ou "X erreurs TypeScript").
- errors: liste des erreurs TS (file:line + message), max 5 entries.`,
      { label: 'typecheck', phase: 'Quality', schema: CHECK_SCHEMA }
    ),
  () =>
    agent(
      `Exécute "npm run lint" et rapporte le résultat.
- ok=true si exit code 0 ET zéro warning, ok=false sinon.
- summary: une phrase courte.
- errors: liste des erreurs/warnings (file:line + rule), max 5.`,
      { label: 'lint', phase: 'Quality', schema: CHECK_SCHEMA }
    ),
  () =>
    agent(
      `Exécute "npm test" et rapporte le résultat.
- ok=true si tous tests verts ET snapshot RLS à jour.
- summary: "X/Y tests passed" ou description du fail.
- errors: si snapshot diff, dire "snapshot RLS stale — vérifier diff puis npm test -- -u". Sinon, lister les 3 premiers tests failed.`,
      { label: 'tests', phase: 'Quality', schema: CHECK_SCHEMA }
    ),
  () =>
    agent(
      `Exécute "npm run build" et rapporte le résultat.
- ok=true si build success ET taille gzip du chunk index < 100KB.
- summary: "Build OK, index XKB gzip" ou message d'erreur.
- metric: la taille gzip exacte du chunk index (ex: "25.41 KB").
- errors: erreurs de build si échec, ou warning "bundle index XKB > 100KB budget" si dépassement.`,
      { label: 'build', phase: 'Quality', schema: CHECK_SCHEMA }
    )
])

const qualityOk = quality.filter(Boolean).every((q) => q.ok)

// Phase 2 — Security (4 agents en parallèle)
phase('Security')
const security = await parallel([
  () =>
    agent(
      `Audite les RLS policies dans supabase/schema.sql.

Vérifie :
1. Policies INSERT sur tables critiques (pianos, piano_updates, piano_visits, piano_sessions, piano_reports, user_requests, event_participants, friendships) — DOIVENT exclure les bannis via 'not public.is_banned(auth.uid())'. Manquant = P1.
2. Pas de policy SELECT exposant role/banned_at de profiles à anon/authenticated (column-level grant 'id, pseudo, created_at' uniquement). Si exposé = P0.
3. Tables sensibles (rate_limit_buckets, audit_log, friendships, friendship_rejections, friend_arriving_dedup) — DOIVENT être en 'revoke all' SANS policy (accès via SECURITY DEFINER uniquement). Si une policy ou un grant les expose = P0.
4. piano_sessions_select doit rester visibility-aware (public OR self OR admin OR ami). Si la branche 'friends' fuit en public = P1.

Rapporte file (schema.sql) + line + issue + suggested_fix précis. Ne signaler QUE des écarts vérifiés.`,
      { label: 'sec:rls', phase: 'Security', schema: SECURITY_SCHEMA }
    ),
  () =>
    agent(
      `Audite les RPCs SECURITY DEFINER dans supabase/schema.sql.

Pour chaque "create [or replace] function ... security definer" :
1. DOIT avoir "set search_path = public" (ou "public, auth"). Manquant = P0.
2. DOIT avoir une garde permission (is_admin/is_superadmin/auth check). Manquant = P1.
3. DOIT avoir "grant execute ... to authenticated" ou "to service_role". Si grant à public/anon involontaire = P0.
4. Actions destructives (force_delete_*, set_user_banned, delete_my_account) DOIVENT avoir p_password + verify_my_password. Manquant = P1.
5. Actions admin (set_user_role, set_user_banned, resolve_report, force_delete_piano, reply_to_request, remove_friendship) DOIVENT appeler write_audit_log. Manquant = P2.
6. RPCs friendship (send/accept/reject/cancel_friend_request, get_friend_status, are_friends) DOIVENT garder leur garde anti-graph-probing (auth.uid() in (a,b) or is_admin). Manquant = P1.

Rapporte file:line + issue + suggested_fix.`,
      { label: 'sec:rpc', phase: 'Security', schema: SECURITY_SCHEMA }
    ),
  () =>
    agent(
      `Audite les antipatterns frontend dans src/.

Grep et rapporte (cf. CLAUDE.md "Anti-patterns à éviter") :
1. "console.log/warn/error/debug" direct utilisé hors de src/lib/logger.ts — P1.
2. "from('profiles').select(...)" qui inclut role ou banned_at dans la projection — P0.
3. "signInWithPassword" dans contexte re-auth (ChangePasswordDialog, DeleteAccountDialog) au lieu de verify_my_password — P0.
4. Schémas zod inline dans component au lieu de src/lib/schemas.ts — P2.
5. err.message direct sans helper getErrorMessage — P2.

Utilise Grep ciblé. Rapporte file:line précis. Ignorer src/lib/logger.ts et src/lib/errors.ts (fichiers d'implémentation).`,
      { label: 'sec:frontend', phase: 'Security', schema: SECURITY_SCHEMA }
    ),
  () =>
    agent(
      `Audite les Edge Functions dans supabase/functions/.

Pour chaque index.ts :
1. Webhook secret lu depuis Deno.env et comparé en timing-safe. Manquant = P0.
2. Re-fetch DB par id (ne pas trust le payload webhook). Manquant = P0.
3. Sanitization headers email via sanitizeHeader. Manquant = P1.
4. Pour le kind 'friend_arriving', re-vérification de l'amitié à delivery via are_friends_safe (anti-leak si amitié supprimée entre enqueue et envoi). Manquant = P1.
5. mark_notification_sent appelé en fin (succès et échec). Manquant = P1.
6. Catch des erreurs externes (Resend, web-push). Manquant = P2.
7. Secrets jamais loggés. Si loggé = P0.

Rapporte file:line + issue + suggested_fix.`,
      { label: 'sec:edge', phase: 'Security', schema: SECURITY_SCHEMA }
    )
])

const allFindings = security.filter(Boolean).flatMap((s) => s.findings || [])
const p0Count = allFindings.filter((f) => f.severity === 'P0').length
const p1Count = allFindings.filter((f) => f.severity === 'P1').length
const securityOk = p0Count === 0 && p1Count === 0

// Phase 3 — Verdict
phase('Verdict')
return {
  quality: { ok: qualityOk, results: quality },
  security: {
    ok: securityOk,
    findings: allFindings,
    bySeverity: {
      P0: allFindings.filter((f) => f.severity === 'P0'),
      P1: allFindings.filter((f) => f.severity === 'P1'),
      P2: allFindings.filter((f) => f.severity === 'P2'),
      P3: allFindings.filter((f) => f.severity === 'P3')
    }
  },
  verdict: qualityOk && securityOk ? 'GO' : 'NO-GO'
}
```

## Output format

Présente le verdict de manière concise, lisible d'un coup d'œil (chiffres illustratifs).

### Cas GO

```
# 🟢 Verdict ship-it : GO

## ✅ Quality (4/4)
- TypeScript : clean
- ESLint : clean
- Tests : X/Y passed
- Bundle : index 25.41 KB gzip (budget 100 KB)

## ✅ Security
Aucun finding P0 ni P1. 0 P2, 0 P3.

→ Ready à push. Crée la PR avec `gh pr create` ou via l'UI GitHub.
Rappel post-déploiement (cf. schema.sql section 13) : confirmation email Supabase, webhook outbox, secrets Edge, pg_cron retry/purge.
```

### Cas NO-GO

```
# 🔴 Verdict ship-it : NO-GO

## Quality (3/4)
- ✅ TypeScript : clean
- ✅ ESLint : clean
- ❌ Tests : 1 failed
   src/lib/__tests__/security-snapshot.test.ts — snapshot mismatch
   → Vérifier le diff schema.sql puis : npm test -- -u
- ✅ Bundle : index 25.41 KB gzip

## 🔴 Security (2 findings P0/P1)

### P0 — [src/components/Admin/UsersTab.tsx:42](../../../src/components/Admin/UsersTab.tsx#L42)
Lecture directe de profiles.role.
→ Utiliser la RPC admin_list_users() au lieu de from('profiles').select('role').

### P1 — [supabase/schema.sql:1284](../../../supabase/schema.sql#L1284)
RPC foo_bar() sans `set search_path = public`.
→ Ajouter `set search_path = public` après `security definer`.

---

## Action requise
Fix les 2 findings + régen snapshot RLS si besoin, puis re-run /ship-it.
```

Inclut TOUJOURS les findings P0 et P1 (bloquants). Les P2/P3 sont mentionnés en bas avec count uniquement, sans le détail (pour ne pas surcharger).

## Conventions PianoWorld respectées

- **Liens cliquables** au format VSCode (`[file:line](file#Lline)`)
- **Sévérité graduée** P0/P1/P2/P3 alignée avec le plan v5
- **GO/NO-GO franc** : pas de "presque" — toute P0 ou P1 = NO-GO
- **Branche solo** : ce skill ne push pas, ne merge pas, ne commit pas — il vérifie uniquement
- **Snapshot RLS** : détecté et signalé avec suggestion `-u`

## Notes

- Durée typique : ~3-5 min (4 agents quality + 4 agents security en parallèle).
- Coût : ~30-80k tokens. Acceptable pour un check pre-PR.
- Ne remplace pas la CI — la CI tourne aussi `npm audit` et bloque le merge si rouge. Ship-it est un raccourci LOCAL pour économiser un round-trip de push raté.
- Si l'utilisateur veut un audit sécurité PLUS profond (incluant CSP, RGPD), pointer vers `/security-audit`.
- Si l'utilisateur veut juste un check rapide sans security, pointer vers `/quality-check`.
