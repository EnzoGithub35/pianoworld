-- =====================================================================
-- Test 4 — piano_favorites self-only + toggle idempotent
-- =====================================================================
-- Vérifie :
--  - RLS self-only : Alice ne voit pas les favoris de Bob
--  - toggle_piano_favorite : idempotent (advisory_xact_lock)
--  - banned : un banni ne peut pas toggle
--  - get_my_favorites : retourne les favoris du caller
--  - get_my_favorites : last_update_at fonctionne (RÉGRESSION du bug Sprint 7)

begin;
select plan(11);

-- ---------------------------------------------------------------
-- Setup
-- ---------------------------------------------------------------
select pgtap_helpers.create_test_user('alice');
select pgtap_helpers.create_test_user('bob');
select pgtap_helpers.create_test_user('mallory_banned');
update public.profiles set banned_at = now() where id = pgtap_helpers.uid_for('mallory_banned');

-- Crée 2 pianos
insert into public.pianos(id, created_by, lat, lng, address, comment, quality)
values
  (pgtap_helpers.uid_for('p1'), pgtap_helpers.uid_for('bob'), 48.8, 2.3, 'Piano 1', 'C1', 'bon_etat'),
  (pgtap_helpers.uid_for('p2'), pgtap_helpers.uid_for('bob'), 48.9, 2.4, 'Piano 2', 'C2', 'neuf');

-- Bob favorite ses 2 pianos (INSERT direct postgres bypass)
insert into public.piano_favorites(piano_id, user_id, created_at)
values
  (pgtap_helpers.uid_for('p1'), pgtap_helpers.uid_for('bob'), now() - interval '2 days'),
  (pgtap_helpers.uid_for('p2'), pgtap_helpers.uid_for('bob'), now() - interval '1 day');

-- Bob update p1 (pour tester get_my_favorites.last_update_at, le bug Sprint 7)
insert into public.piano_updates(piano_id, updated_by, still_there, new_quality, comment)
values
  (pgtap_helpers.uid_for('p1'), pgtap_helpers.uid_for('bob'), true, 'neuf', 'Réaccordé');

-- ---------------------------------------------------------------
-- Switch as alice authenticated
-- ---------------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('alice')::text,
  true
);

-- 4.1 RLS self-only : alice ne voit pas les favoris de bob
select is(
  (select count(*) from public.piano_favorites where user_id = pgtap_helpers.uid_for('bob'))::int,
  0,
  'auth alice: ne voit PAS les favoris de bob (RLS self-only)'
);

-- 4.2 toggle_piano_favorite : alice favorite p1 → returns true
select is(
  public.toggle_piano_favorite(pgtap_helpers.uid_for('p1')),
  true,
  'auth alice: toggle_piano_favorite(p1) → true (ajouté)'
);

-- 4.3 alice voit son favori (compté = 1)
select is(
  (select count(*) from public.piano_favorites where user_id = pgtap_helpers.uid_for('alice'))::int,
  1,
  'auth alice: voit son 1 favori'
);

-- 4.4 toggle_piano_favorite : 2e call → returns false (retiré)
select is(
  public.toggle_piano_favorite(pgtap_helpers.uid_for('p1')),
  false,
  'auth alice: toggle_piano_favorite(p1) 2e call → false (retiré)'
);

-- 4.5 alice n'a plus de favoris
select is(
  (select count(*) from public.piano_favorites where user_id = pgtap_helpers.uid_for('alice'))::int,
  0,
  'auth alice: 0 favoris après toggle off'
);

-- 4.6 toggle sur piano inexistant → throw
select throws_ok(
  $$select public.toggle_piano_favorite('00000000-0000-0000-0000-000000000099'::uuid)$$,
  'P0001',
  'piano_not_found',
  'auth alice: toggle sur piano inexistant → piano_not_found'
);

-- ---------------------------------------------------------------
-- 4.7 get_my_favorites : returns 0 pour alice
-- ---------------------------------------------------------------
select is(
  (select count(*) from public.get_my_favorites())::int,
  0,
  'auth alice: get_my_favorites() retourne 0 (pas de favori)'
);

-- ---------------------------------------------------------------
-- Switch as bob
-- ---------------------------------------------------------------
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('bob')::text,
  true
);

-- 4.8 Bob voit ses 2 favoris via SELECT direct (self-only RLS)
select is(
  (select count(*) from public.piano_favorites)::int,
  2,
  'auth bob: voit ses 2 favoris via SELECT direct (RLS self-only)'
);

-- 4.9 get_my_favorites : retourne 2 rows pour bob
select is(
  (select count(*) from public.get_my_favorites())::int,
  2,
  'auth bob: get_my_favorites() retourne ses 2 favoris'
);

-- 4.10 RÉGRESSION fix Sprint 7 — last_update_at fonctionne sur p1
-- Bug : ancien code disait `pu.updated_at` qui n'existe pas → erreur 42703.
-- Test : on cherche le favori p1 qui a 1 update, last_update_at doit être non-null.
select isnt(
  (select last_update_at from public.get_my_favorites() where piano_id = pgtap_helpers.uid_for('p1')),
  null,
  'RÉGRESSION Sprint 7: get_my_favorites.last_update_at non-null pour p1 (fix pu.created_at)'
);

-- ---------------------------------------------------------------
-- 4.11 Banned : mallory ne peut pas toggle
-- ---------------------------------------------------------------
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('mallory_banned')::text,
  true
);

select throws_ok(
  $$select public.toggle_piano_favorite(pgtap_helpers.uid_for('p1'))$$,
  'P0001',
  'banned',
  'auth mallory_banned: toggle_piano_favorite → banned (raise)'
);

select * from finish();
rollback;
