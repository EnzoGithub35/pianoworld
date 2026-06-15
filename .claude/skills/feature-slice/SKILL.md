---
name: feature-slice
description: Guide l'ajout d'une fonctionnalité data complète sur PianoWorld de bout en bout — table + RLS + rate-limit + RPC éventuelle dans schema.sql, puis type Supabase (type, pas interface), schema zod centralisé, constantes, hook TanStack Query, snapshot RLS, et notifications si la feature en émet. Garde tous les points de synchro alignés pour éviter les oublis (le workflow le plus error-prone du projet). Use this skill when the user asks "ajoute une feature X", "nouvelle table", "nouveau type de données", "ajoute une fonctionnalité qui stocke …", or invokes /feature-slice.
---

# Feature Slice

Checklist ordonnée pour ajouter une fonctionnalité data complète sur PianoWorld sans casser un point de synchronisation. C'est le workflow le plus error-prone du projet : une feature touche SQL + types + zod + constantes + hook + snapshot, et oublier un maillon = bug silencieux ou trou de sécurité.

## When to use this skill

- L'utilisateur dit "ajoute une feature X", "nouvelle table", "nouveau type de données", "stocke X par user"
- L'utilisateur invoque `/feature-slice`
- Toute évolution qui introduit une nouvelle table ou un nouveau flux de données persisté

Pour une RPC isolée (sans nouvelle table), préférer `/rpc-create`. Pour un simple formulaire sur une table existante, ce skill reste utile pour les étapes zod/constants.

## Principe directeur

Procéder **dans l'ordre**, chaque étape en référençant l'existant. À la fin, lancer `/quality-check` (le snapshot RLS échouera tant que `-u` n'est pas fait : c'est attendu).

## Étapes (ordre imposé)

### 1. SQL — [supabase/schema.sql](../../../supabase/schema.sql)

Ajouter dans la section du domaine (ou une nouvelle section numérotée) :

- `create table if not exists public.<table> (...)` + `create index if not exists ...` (penser aux index sur les colonnes filtrées/jointes et aux index partiels `where ...`).
- `alter table ... enable row level security;`
- **Policies** selon le modèle voulu :
  - lecture publique → `for select using (true)` (ou filtre `is_deleted=false`, ou visibility-aware comme `piano_sessions`).
  - table sensible/relationnelle → **aucune policy** + `revoke all on public.<table> from anon, authenticated;` et accès exclusif via RPC SECURITY DEFINER (modèle `friendships`).
  - INSERT par self → `with check (auth.uid() = <owner_col> and not public.is_banned(auth.uid()))`.
  - UPDATE/DELETE → `using (auth.uid() = <owner_col>)` ou `using (public.is_admin())`.
- **Rate limit** (si action limitable) : `create trigger <table>_rate_limit before insert on public.<table> for each row execute function public.enforce_rate_limit('<action>', '<n>', '<fenêtre>');`
  - ⚠️ Si la colonne propriétaire n'est ni `created_by`/`updated_by`/`reported_by`/`user_id`/`requester_id`, **étendre le `coalesce` dans `enforce_rate_limit()`** pour résoudre `v_uid` sur cette table (sinon le trigger raise "cannot resolve user_id").
- **RPC** si action sensible/élevée → déléguer à `/rpc-create` (search_path, garde, grant, audit_log, re-auth).

### 2. Type Supabase — [src/types/database.ts](../../../src/types/database.ts)

- Ajouter `Row`/`Insert`/`Update` (et `Functions` si RPC) **en `type`, jamais `interface`** (sinon `insert()` infère `never[]`, cf. CLAUDE.md gotcha).
- Tenir ce fichier synchrone avec le SQL : c'est une règle dure (anti-pattern : migration sans toucher database.ts).

### 3. Schema zod — [src/lib/schemas.ts](../../../src/lib/schemas.ts)

- Créer le schema du formulaire ici (jamais inline dans un composant).
- Aligner les longueurs/bornes sur les `check (...)` SQL et sur les constantes.

### 4. Constantes — [src/lib/constants.ts](../../../src/lib/constants.ts)

- Tout magic number/string → ici.
- Si rate-limit ajouté : ajouter l'entrée dans `RATE_LIMITS` (mirror exact des arguments du trigger SQL) pour les messages d'UI.

### 5. Hook — `src/hooks/use*.ts`

- Suivre le modèle TanStack Query existant : [src/hooks/usePianos.ts](../../../src/hooks/usePianos.ts), [src/hooks/useFriends.ts](../../../src/hooks/useFriends.ts).
- Lecture via `supabase.from(...).select(...)` (ou `.rpc(...)` si table sans policy) ; mutations avec invalidation de cache + optimistic si pertinent ; erreurs via `getErrorMessage`/helpers (`src/lib/errors.ts`), logs via `logger` (`src/lib/logger.ts`).

### 6. Snapshot RLS — obligatoire

- `npm test` → le snapshot [security-snapshot.test.ts](../../../src/lib/__tests__/security-snapshot.test.ts) diverge (attendu).
- **Revue visuelle du diff** : les nouvelles tables/policies/triggers/RPCs apparaissent-elles comme prévu ? Rien d'inattendu ?
- `npm test -- -u` pour figer la baseline.
- Committer `schema.sql` **+** le `.snap` ensemble.

### 7. Notifications (si la feature en émet) — flux end-to-end

1. `alter type notification_kind add value if not exists '<kind>';` (section 14.d comme modèle ; attention : ADD VALUE doit être committé avant usage en trigger — OK dans le SQL Editor Supabase qui isole chaque statement).
2. Trigger d'enqueue (AFTER INSERT) qui insère dans `notifications_outbox` en filtrant `notification_preferences` + bannis ; snapshot des champs utiles dans le `payload` (anti-leak si compte supprimé).
3. Colonne de préférence `notify_<kind> boolean not null default true` sur `notification_preferences`.
4. `NOTIFICATION_CATEGORIES` / `NOTIFICATION_LABELS` (+ section) dans `constants.ts`.
5. Template mail/push dans [supabase/functions/send-notification/templates.ts](../../../supabase/functions/send-notification/templates.ts) + mapping kind→préférence dans `index.ts`.
6. Toggle UI dans [src/components/Settings/NotificationPreferences.tsx](../../../src/components/Settings/NotificationPreferences.tsx).

### 8. Tests & commit

- Tests `src/lib/` si logique pure ajoutée (seuil coverage `src/lib/` bloquant en CI).
- `/quality-check` pour valider typecheck/lint/test/build.
- Commit : sujet **lowercase strict** (acronymes `rls`/`rgpd`/`cgu`/`rpc` en minuscules), type `feat`, branche `feat/<slug>`, PR vers `main` (jamais de commit direct sur main).

## Output format

Dérouler la checklist appliquée à la feature demandée, en listant pour chaque étape le fichier touché + le snippet proposé, puis la todo finale :

```
## Feature: <nom>

1. schema.sql → table <x> + RLS + (rate-limit?) + (RPC?)   [snippet]
2. database.ts → Row/Insert/Update en type                 [snippet]
3. schemas.ts → <x>FormSchema                              [snippet]
4. constants.ts → <consts> (+ RATE_LIMITS si besoin)
5. hook use<X>.ts (modèle usePianos/useFriends)            [snippet]
6. ☐ npm test -- -u (snapshot RLS) + commit schema.sql + .snap
7. notifications ? [oui/non + sous-étapes]
8. ☐ /quality-check puis commit feat(<scope>): <résumé lowercase>
```

## Notes

- Points de synchro les plus oubliés : (a) `database.ts` en `type`, (b) `RATE_LIMITS` ↔ trigger SQL, (c) `coalesce` de `enforce_rate_limit` pour une colonne propriétaire non standard, (d) le `.snap` non committé.
- Ce skill orchestre ; il délègue la RPC à `/rpc-create` et la validation finale à `/quality-check`.
- Il modifie le code uniquement si l'utilisateur valide chaque étape — sinon il propose les snippets.
