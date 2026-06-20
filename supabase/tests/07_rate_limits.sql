-- =====================================================================
-- Test 7 — Rate limits anti-énumération (Sprint 5 + Sprint 7)
-- =====================================================================
-- Vérifie :
--  - find_user_by_email : exact-match strict, ne révèle pas banned, 0/1 row
--  - find_user_by_email : 5/24h limit (raise rate_limit_exceeded au 6e)
--  - check_signup_ip_allowed : 5/24h par hash IP (returns false au 6e)
--  - check_signup_ip_allowed : grant service_role only

begin;
select plan(12);

-- ---------------------------------------------------------------
-- Setup : alice (active), bob (banned)
-- ---------------------------------------------------------------
select pgtap_helpers.create_test_user('alice');
select pgtap_helpers.create_test_user('bob');
select pgtap_helpers.create_test_user('searcher');

update public.profiles set banned_at = now() where id = pgtap_helpers.uid_for('bob');

-- ---------------------------------------------------------------
-- find_user_by_email (Sprint 5)
-- ---------------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('searcher')::text,
  true
);

-- 7.1 anon ne peut PAS call find_user_by_email
-- (Switch to anon temporarily)
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select * from public.find_user_by_email('alice@pgtap.test')$$,
  '42501',
  null,
  'anon: find_user_by_email → 42501 (grant authenticated only)'
);

-- Re-switch authenticated searcher
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('searcher')::text,
  true
);

-- 7.2 find_user_by_email exact match → returns alice
select is(
  (select pseudo from public.find_user_by_email('alice@pgtap.test') limit 1),
  'alice',
  'auth: find_user_by_email(alice@pgtap.test) retourne alice'
);

-- 7.3 find_user_by_email email inexistant → 0 rows
select is(
  (select count(*) from public.find_user_by_email('nonexistent@pgtap.test'))::int,
  0,
  'auth: find_user_by_email(unknown) retourne 0 row'
);

-- 7.4 find_user_by_email sur user banned → 0 rows (ne révèle pas le ban)
select is(
  (select count(*) from public.find_user_by_email('bob@pgtap.test'))::int,
  0,
  'auth: find_user_by_email(bob banned) retourne 0 row (privacy)'
);

-- 7.5 find_user_by_email email malformé → 0 rows (early return)
select is(
  (select count(*) from public.find_user_by_email('not-an-email'))::int,
  0,
  'auth: find_user_by_email(no @) retourne 0 row'
);

-- ---------------------------------------------------------------
-- 7.6 Rate-limit 5/24h sur find_user_by_email — 6e call throw
-- ---------------------------------------------------------------
-- On vient de faire 4 calls (7.2, 7.3, 7.4, 7.5). En faire 1 de plus
-- → 5 calls total. Le 6e doit raise rate_limit_exceeded.
select count(*) from public.find_user_by_email('alice@pgtap.test'); -- 5e call

select throws_ok(
  $$select * from public.find_user_by_email('alice@pgtap.test')$$,
  'P0001',
  'rate_limit_exceeded',
  'auth: find_user_by_email 6e call dans 24h → rate_limit_exceeded'
);

-- ---------------------------------------------------------------
-- check_signup_ip_allowed (Sprint 7)
-- ---------------------------------------------------------------
-- Cette fonction est grant service_role only. authenticated/anon throw.

-- 7.7 authenticated ne peut PAS call (grant service_role only)
select throws_ok(
  $$select public.check_signup_ip_allowed('test_hash_authuser')$$,
  '42501',
  null,
  'auth: check_signup_ip_allowed → 42501 (service_role only)'
);

-- 7.8 anon non plus
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select public.check_signup_ip_allowed('test_hash_anon')$$,
  '42501',
  null,
  'anon: check_signup_ip_allowed → 42501'
);

-- ---------------------------------------------------------------
-- 7.9 service_role peut call et logique correcte (5 OK, 6e → false)
-- ---------------------------------------------------------------
reset role;
set local role service_role;

select is(
  public.check_signup_ip_allowed('pgtap_hash_test_001'),
  true,
  'service_role: 1er call → allowed=true'
);

-- Calls 2-5 OK
select count(*) from (
  select public.check_signup_ip_allowed('pgtap_hash_test_001'),
         public.check_signup_ip_allowed('pgtap_hash_test_001'),
         public.check_signup_ip_allowed('pgtap_hash_test_001'),
         public.check_signup_ip_allowed('pgtap_hash_test_001')
) as t; -- 4 more calls = 5 total

select is(
  public.check_signup_ip_allowed('pgtap_hash_test_001'),
  false,
  'service_role: 6e call dans 24h → allowed=false (rate limit hit)'
);

-- 7.10 invalid_ip_hash → throw
select throws_ok(
  $$select public.check_signup_ip_allowed(''::text)$$,
  'P0001',
  'invalid_ip_hash',
  'service_role: check_signup_ip_allowed("") → invalid_ip_hash'
);

-- 7.11 Vérification écriture en DB (5 rows pour ce hash)
reset role;
select is(
  (select count(*) from public.signup_ip_attempts where ip_hash = 'pgtap_hash_test_001')::int,
  5,
  'DB: 5 rows écrites dans signup_ip_attempts pour le hash test (les 5 allowed)'
);

select * from finish();
rollback;
