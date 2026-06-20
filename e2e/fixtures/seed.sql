-- =====================================================================
-- PianoWorld — E2E seed (Sprint 11)
-- =====================================================================
-- Applique APRES schema.sql sur la DB locale Supabase. Crée 2 users
-- fixtures (alice, bob) + 1 piano fixture à Rennes pour les golden paths
-- 02-update-piano et 05-friend-workflow.
--
-- Usage : psql -h localhost -p 54322 -U postgres -d postgres -f seed.sql
-- (idempotent : DELETE puis INSERT)
-- =====================================================================

-- 1. Nettoyage idempotent
delete from auth.users where email in ('alice.e2e@pianoworld.test', 'bob.e2e@pianoworld.test');
-- Le cascade ON DELETE supprime aussi profiles, pianos owned, etc.

-- 2. Alice — user fixture (utilisé comme owner du piano fixture)
-- Mot de passe bcrypt pour 'TestPass123!' — généré offline.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token,
  email_change, email_change_token_new, recovery_token
) values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'alice.e2e@pianoworld.test',
  crypt('TestPass123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('pseudo', 'alice_e2e', 'accept_cgu_version', 1),
  now(), now(),
  '', '', '', ''
);

-- 3. Bob — second user fixture (pour friend-workflow)
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token,
  email_change, email_change_token_new, recovery_token
) values (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'bob.e2e@pianoworld.test',
  crypt('TestPass123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('pseudo', 'bob_e2e', 'accept_cgu_version', 1),
  now(), now(),
  '', '', '', ''
);

-- 4. Vérifie que le trigger handle_new_user a bien créé les profiles.
do $$
begin
  if not exists (select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111') then
    raise exception 'Trigger handle_new_user non déclenché pour alice — vérifier schema.sql';
  end if;
end $$;

-- 5. Piano fixture à Rennes (Place Sainte-Anne) — owner alice.
insert into public.pianos (
  id, lat, lng, type, quality, address, comment, photo_url, created_by, created_at
) values (
  '33333333-3333-3333-3333-333333333333',
  48.1136, -1.6790,
  'public',
  'good',
  'Place Sainte-Anne, 35000 Rennes',
  'Piano fixture E2E — ne pas modifier hors test 03.',
  null,
  '11111111-1111-1111-1111-111111111111',
  now()
);

-- 6. Acceptation CGU pour les 2 users (déjà mis dans raw_user_meta_data mais
-- on s'assure de la cohérence côté profiles).
update public.profiles
set accept_cgu_at = now()
where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);
