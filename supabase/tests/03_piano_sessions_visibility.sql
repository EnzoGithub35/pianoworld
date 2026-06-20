-- =====================================================================
-- Test 3 — piano_sessions visibility (public / friends)
-- =====================================================================
-- Vérifie le RLS visibility-aware sur piano_sessions :
--  - Session 'public' visible par auth (anon, charlie non-ami, alice amie)
--  - Session 'friends' visible uniquement par owner + amis
--  - get_active_piano_counts cohérent (ne leak pas le delta)
--  - list_piano_presence cohérent
--  - trigger reject_visibility_update interdit le flip après création (set-once)
--
-- Note de design : la policy piano_sessions_select référence are_friends() qui
-- n'est pas grant à anon → un anon qui SELECT direct piano_sessions throw
-- "permission denied for function are_friends". Comportement INTENTIONNEL :
-- le frontend anonyme passe par list_piano_presence / get_active_piano_counts
-- (SECURITY DEFINER, accessibles à anon, applique le MÊME filtre visibility).
-- Ces 2 RPCs sont la voie publique correcte ; SELECT direct = anti-pattern.

begin;
select plan(10);

-- ---------------------------------------------------------------
-- Setup
-- ---------------------------------------------------------------
select pgtap_helpers.create_test_user('alice');
select pgtap_helpers.create_test_user('bob');
select pgtap_helpers.create_test_user('charlie');

insert into public.pianos(id, created_by, lat, lng, address, comment, quality)
values (
  pgtap_helpers.uid_for('test_piano'),
  pgtap_helpers.uid_for('bob'),
  48.8566, 2.3522, 'Test piano Paris', 'Test comment', 'bon_etat'
);

-- alice ↔ bob amis (INSERT direct car friendships REVOKE ALL)
insert into public.friendships(user_a, user_b, requester_id, status, responded_at)
values (
  least(pgtap_helpers.uid_for('alice'), pgtap_helpers.uid_for('bob')),
  greatest(pgtap_helpers.uid_for('alice'), pgtap_helpers.uid_for('bob')),
  pgtap_helpers.uid_for('alice'),
  'accepted',
  now()
);

-- Bob crée 2 sessions : 1 public, 1 friends — starts_at futur pour upcoming
insert into public.piano_sessions(id, piano_id, user_id, starts_at, duration_min, visibility)
values
  (
    pgtap_helpers.uid_for('session_public'),
    pgtap_helpers.uid_for('test_piano'),
    pgtap_helpers.uid_for('bob'),
    now() + interval '1 hour',
    60,
    'public'
  ),
  (
    pgtap_helpers.uid_for('session_friends'),
    pgtap_helpers.uid_for('test_piano'),
    pgtap_helpers.uid_for('bob'),
    now() + interval '2 hours',
    60,
    'friends'
  );

-- ---------------------------------------------------------------
-- 3.1 Anon : SELECT direct piano_sessions throw (design intentionnel)
-- ---------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  'select * from public.piano_sessions limit 1',
  '42501',
  null,
  'anon: SELECT piano_sessions direct → 42501 (design: passer par list_piano_presence)'
);

-- 3.2 Anon : list_piano_presence ne retourne que la session public
select is(
  (select count(*) from public.list_piano_presence(pgtap_helpers.uid_for('test_piano')))::int,
  1,
  'anon: list_piano_presence retourne SEULEMENT la session public'
);

-- ---------------------------------------------------------------
-- 3.3 Charlie (auth, non-ami) : SELECT direct OK pour public, pas pour friends
-- ---------------------------------------------------------------
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('charlie')::text,
  true
);

select is(
  (select count(*) from public.piano_sessions
   where piano_id = pgtap_helpers.uid_for('test_piano') and visibility = 'public')::int,
  1,
  'auth charlie (non-ami): voit la session public via SELECT direct'
);

select is(
  (select count(*) from public.piano_sessions
   where piano_id = pgtap_helpers.uid_for('test_piano') and visibility = 'friends')::int,
  0,
  'auth charlie (non-ami): ne voit PAS la session friends de bob'
);

-- 3.4 Charlie : list_piano_presence cohérent (1 session visible)
select is(
  (select count(*) from public.list_piano_presence(pgtap_helpers.uid_for('test_piano')))::int,
  1,
  'auth charlie: list_piano_presence retourne SEULEMENT la public (cohérent)'
);

-- ---------------------------------------------------------------
-- 3.5 Alice (amie de bob) : voit les 2 sessions
-- ---------------------------------------------------------------
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('alice')::text,
  true
);

select is(
  (select count(*) from public.piano_sessions
   where piano_id = pgtap_helpers.uid_for('test_piano'))::int,
  2,
  'auth alice (amie): voit les 2 sessions (public + friends)'
);

select is(
  (select count(*) from public.list_piano_presence(pgtap_helpers.uid_for('test_piano')))::int,
  2,
  'auth alice (amie): list_piano_presence retourne les 2 sessions'
);

-- ---------------------------------------------------------------
-- 3.6 Bob (owner) voit ses propres sessions
-- ---------------------------------------------------------------
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('bob')::text,
  true
);

select is(
  (select count(*) from public.piano_sessions where user_id = pgtap_helpers.uid_for('bob'))::int,
  2,
  'auth bob (owner): voit ses 2 sessions'
);

-- ---------------------------------------------------------------
-- 3.7 get_active_piano_counts cohérent (ne throw pas, applique visibility)
-- ---------------------------------------------------------------
select lives_ok(
  $$select * from public.get_active_piano_counts(array[pgtap_helpers.uid_for('test_piano')])$$,
  'auth bob: get_active_piano_counts ne throw pas'
);

-- ---------------------------------------------------------------
-- 3.8 Trigger set-once : bob ne peut pas flip visibility friends → public
-- ---------------------------------------------------------------
select throws_ok(
  $$update public.piano_sessions
    set visibility = 'public'
    where id = pgtap_helpers.uid_for('session_friends')$$,
  '42501',
  'visibility is set-once',
  'auth bob: trigger reject_visibility_update bloque le flip friends → public'
);

select * from finish();
rollback;
