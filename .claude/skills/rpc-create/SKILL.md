---
name: rpc-create
description: Scaffolding interactif d'une nouvelle RPC PostgreSQL SECURITY DEFINER pour PianoWorld. Pose 4 questions ciblées (nom, permission, paramètres, audit_log), génère le SQL complet conforme aux conventions (set search_path = public, guard permission, grant authenticated, wrapper audit_log si destructive), prépare l'edit pour schema.sql et types/database.ts, et rappelle les étapes post-création (snapshot RLS, re-auth password). Use this skill when the user asks "nouvelle RPC", "ajoute une RPC pour X", "scaffold RPC", "create rpc", or invokes /rpc-create directly. Use whenever a new SECURITY DEFINER function is needed côté Supabase.
---

# RPC Create

Guide interactif pour ajouter une RPC PostgreSQL `SECURITY DEFINER` à PianoWorld sans oublier une convention critique.

## When to use this skill

- L'utilisateur dit "nouvelle RPC", "ajoute une RPC pour X", "scaffold une fonction Supabase", "create rpc"
- L'utilisateur invoque `/rpc-create`
- L'utilisateur veut ajouter une fonction côté DB qui nécessite des privilèges élevés (admin, superadmin) ou qui doit contourner RLS pour une opération précise (re-auth password, lecture column-restricted, accès à une table sans policy comme `friendships`)

## Pourquoi ce skill plutôt qu'un edit direct

Le pattern PianoWorld pour une RPC SECURITY DEFINER est strict (cf. [supabase/schema.sql](../../../supabase/schema.sql) sections 11.c, 11.f, 14.g et CLAUDE.md "RPCs sensibles") :

1. `language plpgsql security definer set search_path = public`
2. Garde de permission en début de body (`if not is_admin() then raise 'forbidden'; end if;`)
3. `grant execute on function ... to authenticated` (jamais `public` ni `anon`)
4. Pour les actions destructives : param `p_password text` + appel `verify_my_password(p_password)`
5. Pour les actions admin : appel `write_audit_log('action', target, payload)` en fin
6. Pour les RPCs touchant un graphe relationnel (amitiés) : garde anti-graph-probing + `pg_advisory_xact_lock` sur les mutations
7. Mise à jour de `src/types/database.ts` (Functions.X avec Args + Returns) en `type`, jamais `interface`
8. Régénération du snapshot RLS Vitest (`npm test -- -u`)

Oublier une étape = vulnérabilité. Ce skill formalise la checklist.

## Steps

### Étape 1 — Collecte des inputs

Demande d'abord le **nom** snake_case dans le chat (trop libre pour des options), puis utilise `AskUserQuestion` (1 message, 3 questions paquet) :

**Question 2 — Permission** (header: "Permission")

- `auth` — n'importe quel user authentifié
- `is_admin()` — admin ou superadmin uniquement
- `is_superadmin()` — superadmin uniquement
- `service_role only` — appel interne (Edge Function), aucun grant authenticated

**Question 3 — Action destructive (re-auth requis)** (header: "Destructive")

- `Oui — re-auth password requis` — ajoute `p_password text` + `verify_my_password()`
- `Non — lecture ou action réversible`

**Question 4 — Audit log** (header: "Audit log")

- `Oui — action admin tracée` — ajoute `perform write_audit_log(...)` en fin
- `Non — action user ou lecture`

### Étape 2 — Demande des paramètres et du return type

En texte libre dans le chat :

> Paramètres (ex: `target uuid, new_status text default 'open'`) :
> Type de retour (ex: `void`, `uuid`, `jsonb`, `setof public.profiles`) :

### Étape 3 — Génération SQL

Template à interpoler. Remplacer chaque placeholder.

```sql
-- À ajouter dans supabase/schema.sql dans la section du domaine concerné

create or replace function public.{{NAME}}({{PARAMS_WITH_PASSWORD_IF_DESTRUCTIVE}})
returns {{RETURN_TYPE}}
language plpgsql
security definer
set search_path = public
as $$
{{DECLARE_IF_NEEDED}}
begin
  -- Garde permission
{{GUARD}}

  -- Re-auth password si destructive
{{REAUTH_CHECK}}

  -- TODO: implémenter le body
{{BODY_PLACEHOLDER}}

  -- Audit log si action admin
{{AUDIT_LOG_CALL}}
end
$$;

revoke all on function public.{{NAME}}({{PARAM_SIGNATURE}}) from public, anon;
grant execute on function public.{{NAME}}({{PARAM_SIGNATURE}}) to {{GRANT_TARGET}};
```

**Substitutions selon les choix** :

| Choix                          | Substitution                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Permission `auth`              | `GUARD` = vérif `if auth.uid() is null then raise exception 'forbidden' using errcode = '42501'; end if;`                                |
| Permission `is_admin()`        | `GUARD` = `  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;`                                 |
| Permission `is_superadmin()`   | `GUARD` = `  if not public.is_superadmin() then raise exception 'forbidden' using errcode = '42501'; end if;`                            |
| Permission `service_role only` | `GUARD` = vide, `GRANT_TARGET` = `service_role` (jamais `authenticated`)                                                                 |
| Destructive = Oui              | `REAUTH_CHECK` = `  if p_password is null or not public.verify_my_password(p_password) then raise exception 'invalid_password'; end if;` |
| Destructive = Non              | `REAUTH_CHECK` = vide                                                                                                                    |
| Audit log = Oui                | `AUDIT_LOG_CALL` = `  perform public.write_audit_log('{{NAME}}', {{TARGET_OR_NULL}}, jsonb_build_object({{PARAMS_AS_JSONB}}));`          |
| Audit log = Non                | `AUDIT_LOG_CALL` = vide                                                                                                                  |

Si `service_role only` : `GRANT_TARGET = service_role` ; sinon `authenticated`.

> 💡 Si la RPC mute une paire d'utilisateurs (amitiés) ou un compteur partagé, ajouter `perform pg_advisory_xact_lock(hashtext(...));` au début du body pour sérialiser les accès concurrents (cf. send_friend_request / enforce_rate_limit).

### Étape 4 — Snippet types/database.ts

Génère le fragment à ajouter dans `Database['public']['Functions']` :

```ts
{{NAME}}: {
  Args: {
{{ARGS_TYPESCRIPT}}
  }
  Returns: {{RETURN_TYPESCRIPT}}
}
```

Mapping des types Postgres → TS :

| Postgres                | TypeScript                                          |
| ----------------------- | --------------------------------------------------- |
| `uuid`                  | `string`                                            |
| `text`                  | `string`                                            |
| `int`, `bigint`         | `number`                                            |
| `boolean`               | `boolean`                                           |
| `timestamptz`           | `string`                                            |
| `jsonb`                 | `Json`                                              |
| `void`                  | `undefined` (convention Supabase)                   |
| `setof public.profiles` | `Database['public']['Tables']['profiles']['Row'][]` |

### Étape 5 — Checklist post-création

```
✅ SQL généré ci-dessus → à appendre dans supabase/schema.sql section appropriée
✅ Types TypeScript ci-dessus → à insérer dans src/types/database.ts (Functions)

Puis :
1. Exécute le SQL dans Supabase SQL Editor (ou push migration)
2. Régénère le snapshot RLS : npm test -- -u (cf. CLAUDE.md gotcha "Snapshot RLS")
3. Commit : feat(rpc): add {{name}} for {{purpose}}   ← sujet lowercase strict
```

Si destructive : ajouter "⚠️ Côté frontend, ce RPC nécessite un dialog de re-auth password — voir [DeleteAccountDialog.tsx](../../../src/components/Settings/DeleteAccountDialog.tsx) comme exemple."

Si audit log : ajouter "📋 Vérifie que le tab [AuditLogTab.tsx](../../../src/components/Admin/AuditLogTab.tsx) affiche bien la nouvelle action — sinon ajoute son label dans le mapping."

## Output format

L'output est en deux blocs séparés :

```
## SQL à appendre dans supabase/schema.sql
\`\`\`sql
[SQL complet généré]
\`\`\`

## TypeScript à ajouter dans src/types/database.ts
\`\`\`typescript
[fragment Functions]
\`\`\`

## Checklist post-création
1. ☐ Run le SQL dans Supabase SQL Editor
2. ☐ npm test -- -u (régen snapshot RLS)
3. ☐ Commit avec message conventional commit (sujet lowercase)
[+ items conditionnels selon destructive/audit_log]
```

## Conventions PianoWorld respectées

- **search_path** : toujours `set search_path = public` (+ `auth` si accès `auth.users`)
- **security definer** : toujours
- **Garde permission** : `is_admin()` / `is_superadmin()` / `auth.uid()` selon le besoin
- **Re-auth password** : pour les destructives, via `verify_my_password()` (cf. CLAUDE.md "Pas de signInWithPassword pour re-auth")
- **Audit log** : `write_audit_log()` pour toutes les actions admin
- **Grants** : `authenticated` pour user-facing, `service_role` pour Edge Functions ; `revoke all from public, anon` d'abord
- **Anti-graph-probing + advisory lock** : pour les RPCs relationnelles (cf. section 14.g)

## Notes

- Ce skill ne touche PAS le fichier schema.sql directement. Il génère le snippet à copier-coller — l'utilisateur garde le contrôle sur la section où l'insérer.
- Le snapshot RLS est sensible : toute RPC ajoutée fait diverger `security-snapshot.test.ts`. C'est attendu et l'utilisateur doit le valider visuellement avant le `-u`.
- Pour modifier une RPC existante (ex: ajouter un paramètre), ce skill n'est pas le bon outil — utiliser Edit directement et régénérer le snapshot. Attention : changer la signature crée une nouvelle fonction → revoke/grant l'ancienne ET la nouvelle (cf. section 11.c pour le pattern).
