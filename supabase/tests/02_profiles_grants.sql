-- =====================================================================
-- Test 2 — profiles column-level grants + search_users + admin_list_users
-- =====================================================================
-- Vérifie que les colonnes sensibles de profiles (role, banned_at,
-- first_name, last_name, accept_cgu_*) sont INVISIBLES via SELECT direct.
-- Sans ces grants, un user pourrait :
--  - Énumérer la liste des admins (cible social-eng) via select role
--  - Voir la liste des bannis via select banned_at
--  - Lire les noms réels opt-in v7 d'autres users
--
-- Couverture :
--  - SELECT direct profiles : seules colonnes (id, pseudo, created_at) OK
--  - SELECT role/banned_at/first_name/last_name → permission denied
--  - get_my_profile() : retourne profile complet pour self
--  - search_users(q) : retourne match avec first_name si renseigné
--  - admin_list_users() : reject non-admin, OK pour admin

begin;
select plan(12);

-- ---------------------------------------------------------------
-- Setup
-- ---------------------------------------------------------------
select pgtap_helpers.create_test_user('alice');
select pgtap_helpers.create_test_user('bob');
select pgtap_helpers.create_test_user('eve_admin', 'admin');

-- Alice opt-in pour first_name (v7)
update public.profiles
set first_name = 'Alice', last_name = 'Wonderland'
where id = pgtap_helpers.uid_for('alice');

-- ---------------------------------------------------------------
-- Switch as alice authenticated
-- ---------------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('alice')::text,
  true
);

-- 2.1 Colonnes safe (id, pseudo, created_at) accessibles
select lives_ok(
  'select id, pseudo, created_at from public.profiles limit 5',
  'auth: SELECT (id, pseudo, created_at) profiles OK'
);

-- 2.2 SELECT role → permission denied
select throws_ok(
  'select role from public.profiles limit 1',
  '42501',
  null,
  'auth: SELECT profiles.role → 42501 (column-level revoke)'
);

-- 2.3 SELECT banned_at → permission denied
select throws_ok(
  'select banned_at from public.profiles limit 1',
  '42501',
  null,
  'auth: SELECT profiles.banned_at → 42501'
);

-- 2.4 SELECT first_name → permission denied (v7 opt-in)
select throws_ok(
  'select first_name from public.profiles limit 1',
  '42501',
  null,
  'auth: SELECT profiles.first_name → 42501 (v7 opt-in)'
);

-- 2.5 SELECT last_name → permission denied
select throws_ok(
  'select last_name from public.profiles limit 1',
  '42501',
  null,
  'auth: SELECT profiles.last_name → 42501'
);

-- 2.6 SELECT accept_cgu_at → permission denied
select throws_ok(
  'select accept_cgu_at from public.profiles limit 1',
  '42501',
  null,
  'auth: SELECT profiles.accept_cgu_at → 42501'
);

-- 2.7 SELECT * → permission denied (au moins une colonne refusée)
select throws_ok(
  'select * from public.profiles limit 1',
  '42501',
  null,
  'auth: SELECT * profiles → 42501 (column non-grant)'
);

-- 2.8 get_my_profile() : retourne le profile complet incluant role/banned_at
select isnt(
  (select role::text from public.get_my_profile()),
  null,
  'auth alice: get_my_profile() retourne role (bypass column grants)'
);

-- 2.9 get_my_profile() retourne MA row, pas celle d'un autre
select is(
  (select id from public.get_my_profile()),
  pgtap_helpers.uid_for('alice'),
  'auth alice: get_my_profile() retourne SA row, pas une autre'
);

-- 2.10 search_users() : retourne alice quand on cherche son first_name
select ok(
  exists(
    select 1 from public.search_users('Alice')
    where id = pgtap_helpers.uid_for('alice')
  ),
  'auth: search_users(''Alice'') trouve alice via first_name v7'
);

-- 2.11 admin_list_users : forbidden pour user normal
select throws_ok(
  $$select * from public.admin_list_users('', 'all', 10)$$,
  'P0001',
  'forbidden',
  'auth normal: admin_list_users → forbidden'
);

-- ---------------------------------------------------------------
-- Switch as eve_admin
-- ---------------------------------------------------------------
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('eve_admin')::text,
  true
);

-- 2.12 admin_list_users : OK pour admin
select ok(
  (select count(*) from public.admin_list_users('', 'all', 10)) >= 3,
  'auth admin: admin_list_users() retourne au moins les 3 test users'
);

select * from finish();
rollback;
