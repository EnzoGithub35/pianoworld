-- =====================================================================
-- pgTAP helpers — Sprint 9 RLS tests
-- =====================================================================
-- Crée le schema `pgtap_helpers` avec 2 fonctions :
--   - uid_for(label) : hash déterministe → UUID (safe à grant)
--   - create_test_user(label, role) : crée auth.users + profile (admin-only)
--
-- À runner UNE FOIS via `supabase db query --file _setup.sql --linked`.
--
-- Sécurité prod : grant minimal. `create_test_user` n'est pas grant
-- (postgres-only). Un user normal NE PEUT PAS créer de test users.
--
-- Pattern d'usage dans chaque test file :
--
--   begin;
--   select plan(N);
--
--   -- 1. Setup (en role postgres par défaut)
--   select pgtap_helpers.create_test_user('alice');
--   select pgtap_helpers.create_test_user('bob');
--
--   -- 2. Switch as alice authenticated
--   set local role authenticated;
--   select set_config(
--     'request.jwt.claim.sub',
--     pgtap_helpers.uid_for('alice')::text,
--     true
--   );
--   -- ... tests ...
--
--   -- 3. Switch as anon
--   reset role;
--   select set_config('request.jwt.claim.sub', '', true);
--   set local role anon;
--   -- ... tests ...
--
--   -- 4. Reset à postgres pour cleanup ou nouvelles INSERTs
--   reset role;
--
--   select * from finish();
--   rollback;

create schema if not exists pgtap_helpers;
grant usage on schema pgtap_helpers to anon, authenticated, service_role;

-- ---------------------------------------------------------------
-- uid_for(label) : dérive un UUID déterministe d'un label texte.
-- IMMUTABLE → safe à exposer à tous les rôles (juste un hash).
-- ---------------------------------------------------------------
create or replace function pgtap_helpers.uid_for(label text)
returns uuid
language sql
immutable
as $$
  select (
    substr(md5('pgtap-' || label), 1, 8) || '-' ||
    substr(md5('pgtap-' || label), 9, 4) || '-' ||
    substr(md5('pgtap-' || label), 13, 4) || '-' ||
    substr(md5('pgtap-' || label), 17, 4) || '-' ||
    substr(md5('pgtap-' || label), 21, 12)
  )::uuid;
$$;

grant execute on function pgtap_helpers.uid_for(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------
-- create_test_user(label, role) : crée un user auth + son profile.
-- Trigger on_auth_user_created → handle_new_user → INSERT profile.
--
-- ⚠️ ADMIN-ONLY : pas de grant. Un user via PostgREST NE PEUT PAS
-- l'appeler. Seul un caller superuser (postgres role, ce qui est le
-- cas avec `supabase db query --linked`) peut.
-- ---------------------------------------------------------------
create or replace function pgtap_helpers.create_test_user(
  label text,
  user_role text default 'user'
)
returns uuid
language plpgsql
as $$
declare
  v_uid uuid := pgtap_helpers.uid_for(label);
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    raw_app_meta_data,
    created_at,
    updated_at
  )
  values (
    v_uid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    label || '@pgtap.test',
    extensions.crypt('pgtap-test-pwd', extensions.gen_salt('bf', 4)),
    now(),
    jsonb_build_object('pseudo', label),
    '{}'::jsonb,
    now(),
    now()
  );

  -- Le trigger handle_new_user a créé le profile avec role 'user' par défaut.
  if user_role <> 'user' then
    update public.profiles set role = user_role::user_role where id = v_uid;
  end if;

  return v_uid;
end$$;

-- Pas de GRANT → admin-only (postgres ou service_role).

-- ---------------------------------------------------------------
-- friendship_id_between(a, b) : SECURITY DEFINER pour lookup l'UUID
-- d'une friendship entre 2 users sans être bloqué par le REVOKE ALL.
-- Utilisé dans les tests friend workflow pour récupérer le request_id
-- à passer à accept/reject/cancel sans devoir reset role.
--
-- Pas de raison de leak en prod : la fonction prend 2 UUIDs et retourne
-- juste l'ID de la friendship (ou null). Pas plus d'info que ce que
-- get_friend_status retourne déjà.
-- ---------------------------------------------------------------
create or replace function pgtap_helpers.friendship_id_between(a uuid, b uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.friendships
  where user_a = least(a, b)
    and user_b = greatest(a, b)
  limit 1;
$$;

grant execute on function pgtap_helpers.friendship_id_between(uuid, uuid) to anon, authenticated, service_role;
