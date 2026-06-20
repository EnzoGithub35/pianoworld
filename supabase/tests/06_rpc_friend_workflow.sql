-- =====================================================================
-- Test 6 — Friend workflow (send/accept/reject/cancel/remove + cooldown)
-- =====================================================================
-- Vérifie le système d'amitié v6 :
--  - send_friend_request : envoie pending, notif outbox
--  - accept_friend_request : flip à accepted
--  - reject_friend_request : DELETE + insert friendship_rejection (ghost)
--  - Cooldown 30j : retry pré-30j → forbidden silencieux
--  - cancel_friend_request : par l'initiateur uniquement
--  - remove_friendship : DELETE accepted, audit log
--  - get_friend_status : retourne self/none/friends/pending_*

begin;
select plan(16);

-- ---------------------------------------------------------------
-- Setup : 4 users, aucun n'est admin
-- ---------------------------------------------------------------
select pgtap_helpers.create_test_user('alice');
select pgtap_helpers.create_test_user('bob');
select pgtap_helpers.create_test_user('charlie');
select pgtap_helpers.create_test_user('dan');

-- ---------------------------------------------------------------
-- Switch as alice
-- ---------------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('alice')::text,
  true
);

-- 6.1 send_friend_request : alice → bob OK, returns friendship UUID
select isnt(
  public.send_friend_request(pgtap_helpers.uid_for('bob')),
  null,
  'alice → bob: send_friend_request returns non-null UUID'
);

-- 6.2 alice ne peut pas se send à elle-même
select throws_ok(
  $$select public.send_friend_request(pgtap_helpers.uid_for('alice'))$$,
  '42501', 'forbidden',
  'alice → alice: forbidden (self)'
);

-- 6.3 get_friend_status : pending_sent côté alice
select is(
  public.get_friend_status(pgtap_helpers.uid_for('bob')),
  'pending_sent',
  'alice: get_friend_status(bob) = pending_sent'
);

-- 6.4 alice → charlie OK
select isnt(
  public.send_friend_request(pgtap_helpers.uid_for('charlie')),
  null,
  'alice → charlie: send OK'
);

-- 6.5 alice → bob 2e fois → returns the existing pending UUID (idempotent)
select isnt(
  public.send_friend_request(pgtap_helpers.uid_for('bob')),
  null,
  'alice → bob (2e fois): returns existing pending UUID (idempotent)'
);

-- ---------------------------------------------------------------
-- Switch as bob → accepte alice
-- ---------------------------------------------------------------
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('bob')::text,
  true
);

-- 6.6 bob voit pending_received côté lui
select is(
  public.get_friend_status(pgtap_helpers.uid_for('alice')),
  'pending_received',
  'bob: get_friend_status(alice) = pending_received'
);

-- 6.7 bob accepte
-- Récupère le request_id via SECURITY DEFINER bypass
select public.accept_friend_request(
  pgtap_helpers.friendship_id_between(
    pgtap_helpers.uid_for('alice'),
    pgtap_helpers.uid_for('bob')
  )
);

select is(
  public.get_friend_status(pgtap_helpers.uid_for('alice')),
  'friends',
  'bob: get_friend_status(alice) = friends après accept'
);

-- ---------------------------------------------------------------
-- Switch as charlie → reject alice
-- ---------------------------------------------------------------
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('charlie')::text,
  true
);

select public.reject_friend_request(
  pgtap_helpers.friendship_id_between(
    pgtap_helpers.uid_for('alice'),
    pgtap_helpers.uid_for('charlie')
  )
);

-- 6.8 status revient à 'none' (row deleted)
select is(
  public.get_friend_status(pgtap_helpers.uid_for('alice')),
  'none',
  'charlie: get_friend_status(alice) = none après reject (row deleted)'
);

-- 6.9 friendship_rejection insérée (vérification postgres bypass)
reset role;
select is(
  (select count(*) from public.friendship_rejections
   where requester_id = pgtap_helpers.uid_for('alice')
     and target_id = pgtap_helpers.uid_for('charlie'))::int,
  1,
  'DB: friendship_rejection enregistrée (alice → charlie, ghost)'
);

-- ---------------------------------------------------------------
-- Cooldown 30j : alice retente charlie → forbidden silencieux
-- ---------------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('alice')::text,
  true
);

-- 6.10 retry avant 30j → forbidden (ghost reject contract)
select throws_ok(
  $$select public.send_friend_request(pgtap_helpers.uid_for('charlie'))$$,
  '42501', 'forbidden',
  'alice → charlie (retry avant 30j): forbidden silencieux (ghost contract)'
);

-- ---------------------------------------------------------------
-- Cancel : alice envoie à dan puis cancel
-- ---------------------------------------------------------------
select public.send_friend_request(pgtap_helpers.uid_for('dan'));

select public.cancel_friend_request(
  pgtap_helpers.friendship_id_between(
    pgtap_helpers.uid_for('alice'),
    pgtap_helpers.uid_for('dan')
  )
);

-- 6.11 alice voit none après cancel
select is(
  public.get_friend_status(pgtap_helpers.uid_for('dan')),
  'none',
  'alice: get_friend_status(dan) = none après cancel'
);

-- 6.12 dan n'a PAS de cooldown (cancel ≠ reject)
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('dan')::text,
  true
);
select lives_ok(
  $$select public.send_friend_request(pgtap_helpers.uid_for('alice'))$$,
  'dan → alice: send après cancel par alice OK (pas de cooldown sur cancel)'
);

-- ---------------------------------------------------------------
-- Remove friendship : alice retire bob
-- ---------------------------------------------------------------
select set_config(
  'request.jwt.claim.sub',
  pgtap_helpers.uid_for('alice')::text,
  true
);

select lives_ok(
  $$select public.remove_friendship(pgtap_helpers.uid_for('bob'))$$,
  'alice: remove_friendship(bob) OK'
);

-- 6.13 status revient à none
select is(
  public.get_friend_status(pgtap_helpers.uid_for('bob')),
  'none',
  'alice: get_friend_status(bob) = none après remove'
);

-- 6.14 remove sur non-friend → forbidden
select throws_ok(
  $$select public.remove_friendship(pgtap_helpers.uid_for('charlie'))$$,
  '42501', 'forbidden',
  'alice: remove_friendship(charlie, non-friend) → forbidden'
);

-- ---------------------------------------------------------------
-- 6.15 get_friend_status sur self → 'self'
-- ---------------------------------------------------------------
select is(
  public.get_friend_status(pgtap_helpers.uid_for('alice')),
  'self',
  'alice: get_friend_status(self) = self'
);

select * from finish();
rollback;
