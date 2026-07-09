-- =====================================================================
-- Test 8 — ping_health() keep-alive RPC
-- =====================================================================
-- Sprint v8 Auth Resilience : ping_health() est la cible du cron keep-alive
-- externe (GitHub Actions */10) qui empêche le projet Supabase free tier de
-- "refroidir". Vérifie que anon ET authenticated peuvent l'exécuter et que
-- le retour est bien 'ok'::text (contrat attendu par le workflow externe).

begin;
select plan(3);

-- Setup
select pgtap_helpers.create_test_user('pinger');

-- ---------------------------------------------------------------
-- 8.1 anon peut exécuter ping_health() et reçoit 'ok'
-- ---------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select is(
  public.ping_health(),
  'ok',
  'anon: ping_health() retourne ok'
);

-- ---------------------------------------------------------------
-- 8.2 authenticated peut exécuter ping_health() et reçoit 'ok'
-- ---------------------------------------------------------------
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('pinger')::text,
  true
);

select is(
  public.ping_health(),
  'ok',
  'auth pinger: ping_health() retourne ok'
);

-- ---------------------------------------------------------------
-- 8.3 Type de retour bien text
-- ---------------------------------------------------------------
select is(
  pg_typeof(public.ping_health())::text,
  'text',
  'ping_health() retourne bien un text'
);

select * from finish();
rollback;
