-- =====================================================================
-- Test 1 — Tables REVOKE ALL (invisibles via PostgREST)
-- =====================================================================
-- Vérifie que les tables sensibles avec REVOKE ALL throw bien 'permission
-- denied' quand un user authentifié ou anon tente un SELECT/INSERT direct.
-- Si une de ces tables devenait accidentellement lisible (REVOKE oublié),
-- tout son contenu serait scrapable depuis le frontend = leak majeur.

begin;
select plan(13);

-- ---------------------------------------------------------------
-- Setup (role postgres)
-- ---------------------------------------------------------------
select pgtap_helpers.create_test_user('alice');
select pgtap_helpers.create_test_user('eve_admin', 'admin');

-- Insère une row d'audit_log en postgres (bypass RLS) pour tester
-- les accès par role plus bas.
insert into public.audit_log(actor_id, action, target_id, payload)
values (
  pgtap_helpers.uid_for('eve_admin'),
  'pgtap_test_action',
  pgtap_helpers.uid_for('alice'),
  '{"pgtap_test": true}'
);

-- ---------------------------------------------------------------
-- Switch as alice authenticated
-- ---------------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('alice')::text,
  true
);

-- 1.1 friendships : REVOKE ALL → permission denied
select throws_ok(
  'select * from public.friendships limit 1',
  '42501',
  null,
  'auth: SELECT friendships → 42501'
);

select throws_ok(
  $$insert into public.friendships(user_a, user_b, requester_id)
    values('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'auth: INSERT friendships direct → 42501'
);

-- 1.2 friendship_rejections
select throws_ok(
  'select * from public.friendship_rejections limit 1',
  '42501',
  null,
  'auth: SELECT friendship_rejections → 42501'
);

-- 1.3 friend_arriving_dedup
select throws_ok(
  'select * from public.friend_arriving_dedup limit 1',
  '42501',
  null,
  'auth: SELECT friend_arriving_dedup → 42501'
);

-- 1.4 rate_limit_buckets
select throws_ok(
  'select * from public.rate_limit_buckets limit 1',
  '42501',
  null,
  'auth: SELECT rate_limit_buckets → 42501'
);

-- 1.5 signup_ip_attempts (Sprint 7)
select throws_ok(
  'select * from public.signup_ip_attempts limit 1',
  '42501',
  null,
  'auth: SELECT signup_ip_attempts (Sprint 7) → 42501'
);

-- 1.6 audit_log : RLS using is_admin() — alice (user normal) voit 0 rows
select ok(
  (select count(*) from public.audit_log where action = 'pgtap_test_action') = 0,
  'auth normal: audit_log filtre via policy is_admin() (0 rows visibles)'
);

-- ---------------------------------------------------------------
-- Switch as anon (visiteur)
-- ---------------------------------------------------------------
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select throws_ok(
  'select * from public.friendships limit 1',
  '42501',
  null,
  'anon: SELECT friendships → 42501'
);

select throws_ok(
  'select * from public.signup_ip_attempts limit 1',
  '42501',
  null,
  'anon: SELECT signup_ip_attempts → 42501'
);

select throws_ok(
  'select * from public.rate_limit_buckets limit 1',
  '42501',
  null,
  'anon: SELECT rate_limit_buckets → 42501'
);

select ok(
  (select count(*) from public.audit_log where action = 'pgtap_test_action') = 0,
  'anon: audit_log filtre via policy is_admin() (0 rows visibles)'
);

-- ---------------------------------------------------------------
-- Switch as eve_admin authenticated → admin doit voir l'audit_log
-- ---------------------------------------------------------------
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('eve_admin')::text,
  true
);

select ok(
  (select count(*) from public.audit_log where action = 'pgtap_test_action') >= 1,
  'admin: voit la row pgtap_test dans audit_log (policy is_admin())'
);

-- ---------------------------------------------------------------
-- Re-switch as alice → confirmer toujours pas de leak audit_log
-- ---------------------------------------------------------------
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('alice')::text,
  true
);

select ok(
  (select count(*) from public.audit_log where action = 'pgtap_test_action') = 0,
  'auth alice (re-switch): toujours 0 rows audit_log même si admin a inséré'
);

select * from finish();
rollback;
