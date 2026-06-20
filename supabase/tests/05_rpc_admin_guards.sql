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
select plan(14);

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

select * from finish();
rollback;
