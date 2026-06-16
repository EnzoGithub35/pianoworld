---
name: security-audit
description: Audit sécurité approfondi de PianoWorld via Workflow multi-agents parallèles couvrant 6 axes (RLS policies, RPCs SECURITY DEFINER, antipatterns frontend, Edge Functions, CSP headers vercel.json, complétude RGPD export_my_data). Retourne un rapport priorisé P0/P1/P2/P3 avec file:line et fix concret pour chaque finding. Accepte un argument optionnel pour cibler un seul axe (rls, rpc, frontend, edge, csp, rgpd). Use this skill when the user asks "audit sécurité", "security audit", "check RLS", "vérif security", "trouve les trous de sécu", "/security-audit", or after merging a feature with DB migration.
---

# Security Audit

Audit de sécurité standalone et approfondi de PianoWorld. Plus profond que la phase Security de `/ship-it` car il scan aussi les CSP headers, la complétude RGPD, et les snapshots historiques. Lancé périodiquement (1×/semaine, après ajout de RPC majeure, avant ouverture publique).

⚠️ **Ce skill appelle le tool Workflow (multi-agents, facturé).** Il ne tourne que sur invocation explicite (`/security-audit` ou demande directe). Ne pas le déclencher automatiquement.

## When to use this skill

- L'utilisateur dit "audit sécurité", "security audit", "check sécurité", "vérif security", "trouve les trous"
- L'utilisateur invoque `/security-audit` (sans arg = tous axes) ou `/security-audit <axe>` (un seul axe)
- Après le merge d'une PR qui touche `schema.sql`, `vercel.json`, ou `supabase/functions/`
- Avant l'ouverture publique de l'app
- Si l'utilisateur partage un finding de sécurité (CVE, issue GH) et veut vérifier l'impact

## Arguments

L'utilisateur peut taper :

- `/security-audit` → tous les axes (6 agents en parallèle, ~3-5 min)
- `/security-audit rls` → uniquement l'axe RLS
- `/security-audit rpc` → uniquement les RPCs SECURITY DEFINER
- `/security-audit frontend` → uniquement les antipatterns front
- `/security-audit edge` → uniquement les Edge Functions
- `/security-audit csp` → uniquement les CSP / headers vercel.json
- `/security-audit rgpd` → uniquement la complétude `export_my_data`

Si l'argument n'est pas reconnu, fallback sur "tous les axes".

## Steps

### Étape 1 — Parser l'argument

- Si argument vide ou "all" → mode complet
- Sinon, mode ciblé (1 axe)

### Étape 2 — Lancer le Workflow

**Le user a explicitement opté-in via la slash-command** — appel direct au Workflow tool autorisé. Voir "Workflow script" ci-dessous.

### Étape 3 — Synthèse et présentation

Affiche le rapport final structuré par sévérité.

## Workflow script

```javascript
export const meta = {
  name: 'security-audit',
  description: 'Audit sécurité multi-axes PianoWorld',
  phases: [
    { title: 'Audit', detail: 'Scan parallèle des 6 axes' },
    { title: 'Synthèse', detail: 'Agrégation et priorisation des findings' }
  ]
}

const FINDING_SCHEMA = {
  type: 'object',
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
    },
    notes: { type: 'string' }
  },
  required: ['findings']
}

const targetAxis = args?.axis || 'all'
const axes =
  targetAxis === 'all' ? ['rls', 'rpc', 'frontend', 'edge', 'csp', 'rgpd'] : [targetAxis]

const PROMPTS = {
  rls: `Audite les Row Level Security policies dans supabase/schema.sql.

Vérifie spécifiquement :
1. Chaque policy INSERT sur tables critiques (pianos, piano_updates, piano_visits, piano_sessions, piano_reports, user_requests, event_participants, friendships) DOIT exclure les bannis via 'not public.is_banned(auth.uid())'.
2. La table 'profiles' NE DOIT PAS avoir de policy SELECT exposant role/banned_at à anon/authenticated — accès via RPC get_my_profile() (self) ou admin_list_users() (admin). Les column-level grants doivent restreindre à 'id, pseudo, created_at'.
3. Les tables sensibles (rate_limit_buckets, audit_log, notifications_outbox, friendships, friendship_rejections, friend_arriving_dedup) ne doivent pas avoir de policy SELECT pour authenticated/anon — 'revoke all' + accès via SECURITY DEFINER uniquement.
4. piano_sessions_select DOIT rester visibility-aware (visibility='public' OR self OR is_admin OR are_friends). Une session 'friends' ne doit jamais fuiter en public. Le trigger reject_visibility_update (set-once) doit exister.
5. Chaque policy UPDATE/DELETE doit avoir un check approprié (created_by = auth.uid() ou is_admin()).

Rapporte chaque écart avec file (supabase/schema.sql) + line approximative + sévérité P0 (exposition de donnée sensible) / P1 (contournement de banned check ou fuite visibility) / P2 (policy trop large mais limitée par autres) / P3 (style).

IMPORTANT : ne signale que des écarts VÉRIFIÉS dans le code — pas d'invention.`,

  rpc: `Audite les fonctions SECURITY DEFINER dans supabase/schema.sql.

Pour chaque 'create [or replace] function public.X(...) ... security definer' :
1. DOIT avoir 'set search_path = public' (ou 'public, auth') dans sa déclaration (sinon search_path mutable = vulnérabilité connue).
2. DOIT avoir une garde permission au début (is_admin(), is_superadmin(), ou vérif auth.uid()).
3. DOIT avoir 'grant execute on function ... to authenticated' (ou 'service_role' si interne) APRÈS le 'revoke all from public, anon'.
4. Si action irréversible (force_delete_*, set_user_banned, delete_my_account) : DOIT prendre p_password text et appeler verify_my_password.
5. Si action admin (set_user_role, set_user_banned, resolve_report, force_delete_piano, reply_to_request, remove_friendship) : DOIT appeler write_audit_log(...).
6. RPCs friendship (send/accept/reject/cancel_friend_request, get_friend_status, are_friends, get_my_friends, list_piano_presence, get_active_piano_counts) : vérifier la garde anti-graph-probing (le caller doit être endpoint ou admin) et le pg_advisory_xact_lock sur les mutations. are_friends_safe DOIT être grant service_role uniquement (jamais authenticated).

Sévérité : P0 (search_path manquant ou grant à public/anon), P1 (garde permission manquante, audit_log manquant pour action admin, graph-probing possible), P2 (re-auth password manquant sur destructive), P3 (style).

Lis attentivement les sections 9, 10, 11, 12, 14 de schema.sql qui contiennent les RPCs. Sois précis sur file:line.`,

  frontend: `Audite les antipatterns frontend dans src/.

Grep et rapporte les violations des règles CLAUDE.md :
1. 'console.log/warn/error/debug' direct utilisé HORS de src/lib/logger.ts (seul autorisé). Sévérité P1.
2. 'from(\\'profiles\\').select' qui inclut 'role' ou 'banned_at' dans la projection (au lieu de la RPC get_my_profile ou admin_list_users). Sévérité P0.
3. 'signInWithPassword' utilisé dans un contexte de re-auth (ChangePasswordDialog, DeleteAccountDialog, settings sensibles) au lieu de la RPC verify_my_password. Sévérité P0.
4. Magic numbers/strings qui devraient être dans src/lib/constants.ts (heuristique : tout nombre > 100 ou string qui apparaît 3+ fois). Sévérité P3.
5. err.message direct sans isInstanceOf Error ou getErrorMessage helper. Sévérité P2.
6. Schémas zod inline dans un component au lieu de src/lib/schemas.ts. Sévérité P2.
7. Accès direct à la table friendships via supabase.from('friendships') côté client (doit passer par les RPCs send/accept/get_my_friends, etc.). Sévérité P1.

Utilise Grep pour chaque pattern. Rapporte file:line précis. Ne pas signaler les vrais usages dans src/lib/logger.ts ou src/lib/errors.ts (fichiers d'implémentation).`,

  edge: `Audite les Edge Functions dans supabase/functions/.

Pour chaque fichier index.ts :
1. Le webhook secret DOIT être lu depuis Deno.env.get(...) et comparé en temps constant (timingSafeEqual).
2. La fonction DOIT re-fetch la ligne depuis la DB par id (ne pas faire confiance au payload du webhook).
3. Tous les headers email (subject, from, etc.) DOIVENT passer par sanitizeHeader pour éviter l'injection CRLF.
4. Pour le kind 'friend_arriving', l'amitié DOIT être re-vérifiée à delivery via are_friends_safe (anti-leak si amitié supprimée entre l'enqueue du trigger et l'envoi).
5. Le mark_notification_sent DOIT être appelé en fin (succès ou échec) pour le retry/backoff.
6. Les inputs externes (resend response, web-push) DOIVENT être catchés et loggés sans crash.
7. Les secrets ne DOIVENT JAMAIS être loggés ou inclus dans une error response.

Sévérité : P0 (secret loggé, payload trust sans re-fetch, leak amitié), P1 (sanitization manquante, mark_sent oublié), P2 (catch missing), P3 (log verbosity).

Lis supabase/functions/send-notification/index.ts et templates.ts en priorité.`,

  csp: `Audite la CSP et les headers de sécurité dans vercel.json.

Pour 'Content-Security-Policy' :
1. img-src DOIT inclure les domaines de tuiles utilisés (basemaps.cartocdn.com, tile.openstreetmap.org) + le bucket Storage Supabase.
2. connect-src DOIT inclure le domaine Supabase (xxx.supabase.co), Sentry (ingest.*.sentry.io), Photon (photon.komoot.io), Nominatim (nominatim.openstreetmap.org).
3. script-src ne doit PAS avoir 'unsafe-inline' en prod publique.
4. style-src 'unsafe-inline' est acceptable pour Tailwind à court terme.

Pour les headers généraux :
- 'Strict-Transport-Security' DOIT être max-age >= 31536000.
- 'X-Frame-Options' DOIT être DENY ou SAMEORIGIN.
- 'X-Content-Type-Options' DOIT être nosniff.
- 'Referrer-Policy' DOIT être strict-origin-when-cross-origin ou plus strict.
- COOP/COEP/CORP : présents (cf. v4/v5).

Cross-référence avec src/lib/supabase.ts (URL Supabase), src/lib/sentry.ts (DSN Sentry), src/lib/geocoding.ts (Photon + Nominatim), src/components/Map/PianoMap.tsx (tile URLs).

Sévérité : P0 (domaine connect-src manquant = app cassée silencieusement), P1 (HSTS faible, unsafe-inline script en prod), P2 (X-Frame absent), P3 (Referrer-Policy faible).`,

  rgpd: `Audite la complétude de la RPC export_my_data dans supabase/schema.sql.

Méthodologie :
1. Liste toutes les tables qui ont une FK vers profiles(id) — grep "references public.profiles" dans schema.sql.
2. Liste les tables ramenées par la RPC export_my_data (lis sa définition).
3. Diff : toute table FK profiles ABSENTE de export_my_data = finding RGPD art.20.

Tables attendues (v5/v6) : pianos, piano_updates, piano_visits, piano_sessions, piano_reports, event_participants, user_requests, push_subscriptions (endpoints sans clés), notification_preferences. Considérer aussi friendships/friendship_rejections (données relationnelles touchant le user).

Vérifie aussi :
- snapshot pseudo dans piano_updates.author_pseudo_at_time existe (trigger BEFORE INSERT).
- piano_updates.updated_by est on delete set null (pas cascade) pour préserver l'historique.
- Le cooldown anti-stalking friendship_rejections respecte la minimisation (purge pg_cron mensuelle, cf. section 13).
- Le scrubber PII Sentry (src/lib/sentry.ts) couvre email + JWT.

Sévérité : P1 (table absente de l'export = non-conformité), P2 (snapshot pseudo manquant, purge non planifiée), P3 (cascade trop agressive).`
}

phase('Audit')
const results = await parallel(
  axes.map(
    (axis) => () =>
      agent(PROMPTS[axis], {
        label: `audit:${axis}`,
        phase: 'Audit',
        schema: FINDING_SCHEMA
      }).then((r) => ({ axis, ...r }))
  )
)

phase('Synthèse')
const allFindings = results
  .filter(Boolean)
  .flatMap((r) => (r.findings || []).map((f) => ({ ...f, axis: r.axis })))

const bySeverity = {
  P0: allFindings.filter((f) => f.severity === 'P0'),
  P1: allFindings.filter((f) => f.severity === 'P1'),
  P2: allFindings.filter((f) => f.severity === 'P2'),
  P3: allFindings.filter((f) => f.severity === 'P3')
}

return {
  axesScanned: axes,
  totalFindings: allFindings.length,
  bySeverity,
  raw: results
}
```

## Output format

Présente le résultat structuré par sévérité :

```
# Audit sécurité PianoWorld

Axes scannés : rls, rpc, frontend, edge, csp, rgpd
Total findings : 7

## 🔴 P0 — À fixer avant toute mise en prod publique (2)

### [supabase/schema.sql:1284](../../../supabase/schema.sql#L1284) — RPC `foo_bar` sans `set search_path = public`
→ Ajouter `set search_path = public` après `security definer`.

### [src/components/Admin/UsersTab.tsx:42](../../../src/components/Admin/UsersTab.tsx#L42) — Lecture directe de `profiles.role`
→ Utiliser la RPC `admin_list_users()` au lieu de `from('profiles').select('role')`.

## 🟠 P1 — À traiter cette semaine (3)
[...]

## 🟡 P2 — Backlog moyen (1)
[...]

## 🔵 P3 — Style / cosmétique (1)
[...]

---

### Notes
- 1 axe n'a renvoyé aucun finding : edge.
```

Si zéro finding global : "✅ Audit clean sur les {N} axes scannés. Aucun écart aux conventions PianoWorld détecté."

## Conventions PianoWorld respectées

- **Liens fichiers cliquables** au format VSCode `[file.ts:42](../../../file.ts#L42)`.
- **Pas d'invention** : chaque finding doit être vérifiable dans le code par l'utilisateur.
- **Sévérité P0/P1/P2/P3** alignée avec le plan v5.
- **Antipatterns référencés** au CLAUDE.md (logger, errors, signInWithPassword, RPC pour role/banned_at).

## Notes

- Durée typique mode complet : ~3-5 min (6 agents parallèles).
- Durée typique mode ciblé : ~30s-1min.
- Coût : ~50-100k tokens en mode complet. Acceptable pour un usage hebdomadaire.
- Ce skill ne fixe rien automatiquement. Il rapporte. Le fix reste à l'utilisateur (qui peut ensuite lancer `/ship-it` pour vérifier).
- Si l'agent CSP signale un domaine connect-src manquant, vérifier d'abord que le domaine est réellement utilisé (peut être un faux positif si une lib a changé d'URL récemment).
- Croiser systématiquement avec le snapshot RLS (`src/lib/__tests__/security-snapshot.test.ts`) : tout écart structurel devrait y apparaître comme diff.
