# pgTAP RLS tests — PianoWorld

Tests des policies Row-Level Security et des guards des RPCs sensibles. **C'est la seule façon de garantir que les RLS font ce qu'elles prétendent** — le snapshot Vitest valide la forme, pas le comportement.

## Couverture

| Fichier                            | Assertions | Couvre                                                                                                                                                                           |
| ---------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01_invisible_tables.sql`          | 13         | REVOKE ALL : friendships, friendship_rejections, friend_arriving_dedup, rate_limit_buckets, signup_ip_attempts. RLS policy admin-only : audit_log                                |
| `02_profiles_grants.sql`           | 12         | Column-level grants (id/pseudo/created_at visibles, role/banned_at/first_name/last_name invisibles). RPCs : get_my_profile, search_users, admin_list_users                       |
| `03_piano_sessions_visibility.sql` | 10         | RLS visibility public/friends. RPCs SECURITY DEFINER : list_piano_presence, get_active_piano_counts. Trigger reject_visibility_update (set-once)                                 |
| `04_piano_favorites.sql`           | 11         | RLS self-only. RPCs : toggle_piano_favorite (idempotent, advisory_lock, ban guard), get_my_favorites. **Bug v7 PR-A trouvé : `pu.updated_at` n'existe pas (last_update_at)**     |
| `05_rpc_admin_guards.sql`          | 14         | Guards : set_user_role (superadmin + self block), set_user_banned (admin + password), force_delete_piano (admin + password), resolve_report, reply_to_request, delete_my_account |
| `06_rpc_friend_workflow.sql`       | 16         | send/accept/reject/cancel/remove + cooldown 30j ghost-reject + get_friend_status                                                                                                 |
| `07_rate_limits.sql`               | 12         | find_user_by_email (5/24h anti-énumération + ne révèle pas banned). check_signup_ip_allowed (service_role only, 5/24h)                                                           |
| **Total**                          | **88**     |                                                                                                                                                                                  |

## Prérequis

- Extension pgTAP installée : `create extension if not exists pgtap with schema extensions;` (déjà fait en prod)
- Schema `pgtap_helpers` installé via `_setup.sql` (idempotent, à runner UNE FOIS)
- CLI Supabase loggée + projet linké

## Run

### Tous les tests (PowerShell, Windows)

```powershell
# Depuis la racine du repo
./scripts/run-pgtap.ps1
```

### Un test individuel

```powershell
$sb = "$env:USERPROFILE\scoop\shims\supabase.exe"
& $sb db query --file supabase/tests/01_invisible_tables.sql --linked
```

### Re-install des helpers (rare, si schema modifié)

```powershell
& $sb db query --file supabase/tests/_setup.sql --linked
```

## Comportement attendu

Chaque test wrappé en `BEGIN; ... ROLLBACK;` → **aucune pollution de la DB de prod**. Les `pgtap_helpers.create_test_user` créent des users `*@pgtap.test` qui sont annulés par le rollback.

Le runner affiche :

- ✅ Vert si plan(N) == actual N et toutes les assertions passent
- ❌ Rouge si une assertion fail OU si le plan est mismatch

## Bugs trouvés par ces tests (historique)

| Bug                                                                                              | Origine                                | Détection                                                                                         | Fix                                                                                              |
| ------------------------------------------------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `get_my_favorites.last_update_at` référence `pu.updated_at` (n'existe pas, c'est `created_at`)   | v7 PR-A backend (livraison schema.sql) | Détecté lors du déploiement Sprint 7 sécu via Supabase SQL Editor                                 | `fix(v7): get_my_favorites colonne pu.updated_at -> pu.created_at` (cherry-picked dans Sprint 9) |
| `queue_favorite_update_notification` référence `new.quality` (n'existe pas, c'est `new_quality`) | v7 PR-A backend (trigger fn)           | Détecté par Sprint 9 pgTAP test 04 piano_favorites (premier INSERT piano_updates avec favoriters) | Inclus dans Sprint 9                                                                             |

## Limites connues

- Pas de CI automatique (nécessite Docker ou DB de test dédiée). Run manuel après chaque modif schema.sql.
- Tests exécutés contre la DB **prod** (la seule disponible en free tier). Le rollback en fin de chaque test empêche la pollution.
- Le retour CLI `supabase db query` montre uniquement la dernière ligne. Pour un output complet, lancer via `psql` ou utiliser le runner PowerShell.

## Pattern d'un test

```sql
begin;
select plan(N);

-- 1. Setup en role postgres (par défaut)
select pgtap_helpers.create_test_user('alice');

-- 2. Switch as alice authenticated
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('alice')::text,
  true
);

-- 3. Assertions
select ok(<condition>, '<description>');
select is(<actual>, <expected>, '<description>');
select throws_ok($$<sql>$$, '<sqlstate>', '<message>', '<description>');
select lives_ok($$<sql>$$, '<description>');

select * from finish();
rollback;
```

## Réf

- pgTAP : https://pgtap.org/
- Pattern Supabase + pgTAP : https://supabase.com/docs/guides/database/extensions/pgtap
- Audit V7 + plan Sprint 9 (B.4) : `docs/SECURITY.md`
