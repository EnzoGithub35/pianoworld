-- =====================================================================
-- Test 5 — RPCs admin guards
-- =====================================================================
-- Vérifie les guards des RPCs sensibles :
--  - set_user_role : superadmin only, can't change self, can't demote last superadmin
--  - set_user_banned : admin only + password required
--  - force_delete_piano : admin only + password required
--  - resolve_report : admin only
--  - delete_my_account : password required

begin;
select plan(28);

-- ---------------------------------------------------------------
-- Setup : alice (user), bob (user), admin (admin), boss (superadmin)
-- ---------------------------------------------------------------
select pgtap_helpers.create_test_user('alice');
select pgtap_helpers.create_test_user('bob');
select pgtap_helpers.create_test_user('admin', 'admin');
select pgtap_helpers.create_test_user('boss', 'superadmin');

-- Crée 1 piano pour bob
insert into public.pianos(id, created_by, lat, lng, address, comment, quality)
values (pgtap_helpers.uid_for('p1'), pgtap_helpers.uid_for('bob'), 48.8, 2.3, 'P1', 'C', 'bon_etat');

-- ---------------------------------------------------------------
-- Switch as alice (user normal)
-- ---------------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('alice')::text,
  true
);

-- 5.1 set_user_role : forbidden pour user normal
select throws_ok(
  $$select public.set_user_role(pgtap_helpers.uid_for('bob'), 'admin'::user_role)$$,
  'P0001',
  'forbidden',
  'auth alice: set_user_role → forbidden'
);

-- 5.2 set_user_banned : forbidden pour user normal
select throws_ok(
  $$select public.set_user_banned(pgtap_helpers.uid_for('bob'), true, 'wrong-pwd')$$,
  'P0001',
  'forbidden',
  'auth alice: set_user_banned → forbidden (avant même le password check)'
);

-- 5.3 force_delete_piano : forbidden pour user normal
select throws_ok(
  $$select public.force_delete_piano(pgtap_helpers.uid_for('p1'), 'wrong-pwd')$$,
  'P0001',
  'forbidden',
  'auth alice: force_delete_piano → forbidden'
);

-- 5.4 resolve_report : forbidden
select throws_ok(
  $$select public.resolve_report('00000000-0000-0000-0000-000000000001'::uuid)$$,
  'P0001',
  'forbidden',
  'auth alice: resolve_report → forbidden'
);

-- 5.5 reply_to_request : forbidden
select throws_ok(
  $$select public.reply_to_request('00000000-0000-0000-0000-000000000001'::uuid, 'test reply')$$,
  'P0001',
  'forbidden',
  'auth alice: reply_to_request → forbidden'
);

-- 5.6 delete_my_account sans password → invalid_password
select throws_ok(
  $$select public.delete_my_account(null::text)$$,
  'P0001',
  'invalid_password',
  'auth alice: delete_my_account(null) → invalid_password'
);

-- 5.7 delete_my_account avec mauvais password → invalid_password
select throws_ok(
  $$select public.delete_my_account('wrong-pwd')$$,
  'P0001',
  'invalid_password',
  'auth alice: delete_my_account(wrong-pwd) → invalid_password'
);

-- ---------------------------------------------------------------
-- Switch as admin (admin)
-- ---------------------------------------------------------------
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('admin')::text,
  true
);

-- 5.8 admin : set_user_role still forbidden (superadmin only)
select throws_ok(
  $$select public.set_user_role(pgtap_helpers.uid_for('bob'), 'admin'::user_role)$$,
  'P0001',
  'forbidden',
  'auth admin: set_user_role → forbidden (superadmin only)'
);

-- 5.9 admin : set_user_banned avec mauvais password → invalid_password
select throws_ok(
  $$select public.set_user_banned(pgtap_helpers.uid_for('bob'), true, 'wrong-pwd')$$,
  'P0001',
  'invalid_password',
  'auth admin: set_user_banned(wrong-pwd) → invalid_password'
);

-- 5.10 admin : force_delete_piano avec mauvais password → invalid_password
select throws_ok(
  $$select public.force_delete_piano(pgtap_helpers.uid_for('p1'), 'wrong-pwd')$$,
  'P0001',
  'invalid_password',
  'auth admin: force_delete_piano(wrong-pwd) → invalid_password'
);

-- 5.11 admin : resolve_report sur ID inexistant → no-op (pas de throw)
-- update on no row matched = silently no-op. Comportement attendu.
select lives_ok(
  $$select public.resolve_report('00000000-0000-0000-0000-000000000999'::uuid)$$,
  'auth admin: resolve_report sur ID inexistant ne throw pas (no-op)'
);

-- ---------------------------------------------------------------
-- Switch as boss (superadmin)
-- ---------------------------------------------------------------
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('boss')::text,
  true
);

-- 5.12 boss : set_user_role sur self → cannot change own role
select throws_ok(
  $$select public.set_user_role(pgtap_helpers.uid_for('boss'), 'user'::user_role)$$,
  'P0001',
  'cannot change own role',
  'auth boss: set_user_role(self) → cannot change own role'
);

-- 5.13 boss : promouvoir bob en admin OK + vérif via get_my_profile (lit role)
select lives_ok(
  $$select public.set_user_role(pgtap_helpers.uid_for('bob'), 'admin'::user_role)$$,
  'auth boss: set_user_role(bob, admin) OK'
);

-- Vérification via switch to bob + get_my_profile (qui retourne role via security definer)
-- (SELECT direct role::text from public.profiles throw column-grant denied)
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('bob')::text,
  true
);

select is(
  (select role::text from public.get_my_profile()),
  'admin',
  'DB: bob est maintenant admin (vérifié via get_my_profile pour bypass column grant)'
);

-- =====================================================================
-- Chemins de succès (le fichier ne couvrait que forbidden/invalid_password)
-- =====================================================================

reset role;
select pgtap_helpers.create_test_user('dave');
select pgtap_helpers.create_test_user('erin');

insert into public.piano_reports(id, piano_id, reported_by, reason)
values (pgtap_helpers.uid_for('report1'), pgtap_helpers.uid_for('p1'), pgtap_helpers.uid_for('alice'), 'Faux signalement de test');

insert into public.user_requests(id, user_id, subject, message)
values (pgtap_helpers.uid_for('request1'), pgtap_helpers.uid_for('alice'), 'Question test', 'Message de test pour reply_to_request');

-- 5.15 verify_my_password avec le BON mot de passe → true
set local role authenticated;
select set_config('request.jwt.claim.sub', pgtap_helpers.uid_for('alice')::text, true);

select ok(
  public.verify_my_password('pgtap-test-pwd'),
  'auth alice: verify_my_password(bon mdp) → true'
);

-- Switch admin pour les succès des RPC admin
select set_config('request.jwt.claim.sub', pgtap_helpers.uid_for('admin')::text, true);

-- 5.16 set_user_banned(dave, true, bon mdp) → succès
select lives_ok(
  $$select public.set_user_banned(pgtap_helpers.uid_for('dave'), true, 'pgtap-test-pwd')$$,
  'auth admin: set_user_banned(dave, true, bon mdp) OK'
);

-- 5.17 force_delete_piano(p1, bon mdp) → succès
select lives_ok(
  $$select public.force_delete_piano(pgtap_helpers.uid_for('p1'), 'pgtap-test-pwd')$$,
  'auth admin: force_delete_piano(p1, bon mdp) OK'
);

-- 5.18 resolve_report(report1 existant) → succès
select lives_ok(
  $$select public.resolve_report(pgtap_helpers.uid_for('report1'))$$,
  'auth admin: resolve_report(report1 existant) OK'
);

-- 5.19 reply_to_request(request1 existant, reply) → succès
select lives_ok(
  $$select public.reply_to_request(pgtap_helpers.uid_for('request1'), 'Réponse admin de test')$$,
  'auth admin: reply_to_request(request1 existant) OK'
);

-- Vérifications DB (reset postgres : bypass RLS + column grants, plus simple/robuste)
reset role;
select set_config('request.jwt.claim.sub', '', true);

select ok(
  (select banned_at is not null from public.profiles where id = pgtap_helpers.uid_for('dave')),
  'DB: dave.banned_at renseigné après set_user_banned'
);

select ok(
  (select is_deleted from public.pianos where id = pgtap_helpers.uid_for('p1')),
  'DB: p1.is_deleted = true après force_delete_piano'
);

select ok(
  (select resolved from public.piano_reports where id = pgtap_helpers.uid_for('report1')),
  'DB: report1.resolved = true après resolve_report'
);

select is(
  (select status from public.user_requests where id = pgtap_helpers.uid_for('request1')),
  'answered',
  'DB: request1.status = answered après reply_to_request'
);

select is(
  (select admin_reply from public.user_requests where id = pgtap_helpers.uid_for('request1')),
  'Réponse admin de test',
  'DB: request1.admin_reply stocke bien la réponse'
);

select is(
  (select replied_by from public.user_requests where id = pgtap_helpers.uid_for('request1')),
  pgtap_helpers.uid_for('admin'),
  'DB: request1.replied_by = admin'
);

-- 5.20 delete_my_account(bon mdp) — user dédié 'erin', jamais réutilisé ailleurs
set local role authenticated;
select set_config('request.jwt.claim.sub', pgtap_helpers.uid_for('erin')::text, true);

select lives_ok(
  $$select public.delete_my_account('pgtap-test-pwd')$$,
  'auth erin: delete_my_account(bon mdp) OK'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select count(*)::int from public.profiles where id = pgtap_helpers.uid_for('erin')),
  0,
  'DB: erin absente de profiles après delete_my_account (cascade)'
);

select is(
  (select count(*)::int from auth.users where id = pgtap_helpers.uid_for('erin')),
  0,
  'DB: erin absente de auth.users après delete_my_account'
);

select * from finish();
rollback;
