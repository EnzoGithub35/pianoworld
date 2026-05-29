-- =====================================================================
-- PianoWorld - Schéma DB + RLS + Storage
-- À exécuter dans Supabase > SQL Editor (un seul run suffit)
-- =====================================================================

-- ============================
-- 1. ENUM qualité
-- ============================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'piano_quality') then
    create type piano_quality as enum (
      'neuf', 'bon_etat', 'potable', 'desaccorde', 'desastreux', 'autre'
    );
  end if;
end$$;

-- ============================
-- 2. Tables
-- ============================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  pseudo      text not null unique check (char_length(pseudo) between 2 and 30),
  created_at  timestamptz not null default now()
);

create table if not exists public.pianos (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references public.profiles(id) on delete cascade,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  address     text not null check (char_length(address) between 1 and 500),
  comment     text not null check (char_length(comment) between 1 and 500),
  quality     piano_quality not null,
  photo_url   text,
  created_at  timestamptz not null default now(),
  is_deleted  boolean not null default false
);
create index if not exists pianos_created_by_idx on public.pianos(created_by);
create index if not exists pianos_created_at_idx on public.pianos(created_at desc);
create index if not exists pianos_geo_idx on public.pianos(lat, lng);

create table if not exists public.piano_updates (
  id           uuid primary key default gen_random_uuid(),
  piano_id     uuid not null references public.pianos(id) on delete cascade,
  updated_by   uuid not null references public.profiles(id) on delete cascade,
  still_there  boolean not null,
  new_quality  piano_quality,
  comment      text check (comment is null or char_length(comment) <= 500),
  created_at   timestamptz not null default now()
);
create index if not exists piano_updates_piano_id_idx on public.piano_updates(piano_id, created_at desc);

create table if not exists public.piano_reports (
  id           uuid primary key default gen_random_uuid(),
  piano_id     uuid not null references public.pianos(id) on delete cascade,
  reported_by  uuid not null references public.profiles(id) on delete cascade,
  reason       text not null check (char_length(reason) between 1 and 500),
  created_at   timestamptz not null default now(),
  resolved     boolean not null default false
);

-- ============================
-- 3. Row Level Security
-- ============================
alter table public.profiles      enable row level security;
alter table public.pianos        enable row level security;
alter table public.piano_updates enable row level security;
alter table public.piano_reports enable row level security;

-- profiles : lecture publique (pseudo), update par soi-même
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (true);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_delete_self on public.profiles;
create policy profiles_delete_self on public.profiles
  for delete using (auth.uid() = id);

-- pianos : lecture publique (non supprimés), CRUD par créateur
drop policy if exists pianos_select on public.pianos;
create policy pianos_select on public.pianos for select using (is_deleted = false);

drop policy if exists pianos_insert on public.pianos;
create policy pianos_insert on public.pianos
  for insert with check (auth.uid() = created_by);

drop policy if exists pianos_update_owner on public.pianos;
create policy pianos_update_owner on public.pianos
  for update using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists pianos_delete_owner on public.pianos;
create policy pianos_delete_owner on public.pianos
  for delete using (auth.uid() = created_by);

-- piano_updates : lecture publique, insert auth, immuable
drop policy if exists piano_updates_select on public.piano_updates;
create policy piano_updates_select on public.piano_updates for select using (true);

drop policy if exists piano_updates_insert on public.piano_updates;
create policy piano_updates_insert on public.piano_updates
  for insert with check (auth.uid() = updated_by);

-- piano_reports : insert auth uniquement, pas de SELECT public
drop policy if exists piano_reports_insert on public.piano_reports;
create policy piano_reports_insert on public.piano_reports
  for insert with check (auth.uid() = reported_by);

drop policy if exists piano_reports_select_own on public.piano_reports;
create policy piano_reports_select_own on public.piano_reports
  for select using (auth.uid() = reported_by);

-- ============================
-- 4. Storage bucket photos
-- ============================
insert into storage.buckets (id, name, public)
values ('piano-photos', 'piano-photos', true)
on conflict (id) do nothing;

drop policy if exists piano_photos_read on storage.objects;
create policy piano_photos_read on storage.objects
  for select using (bucket_id = 'piano-photos');

drop policy if exists piano_photos_insert on storage.objects;
create policy piano_photos_insert on storage.objects
  for insert with check (bucket_id = 'piano-photos' and auth.role() = 'authenticated');

drop policy if exists piano_photos_delete_own on storage.objects;
create policy piano_photos_delete_own on storage.objects
  for delete using (bucket_id = 'piano-photos' and auth.uid()::text = owner::text);

-- ============================
-- 5. Fonction RGPD : suppression de compte (security definer)
--    Permet à un user de supprimer son propre compte + cascade.
-- ============================
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ============================
-- 6. v2 — Activité : Passages + Sessions de présence
-- ============================

-- 6.a. Passage : "je suis passé sur ce piano"
create table if not exists public.piano_visits (
  id          uuid primary key default gen_random_uuid(),
  piano_id    uuid not null references public.pianos(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  visited_at  timestamptz not null default now()
);
create index if not exists piano_visits_piano_id_idx
  on public.piano_visits(piano_id, visited_at desc);
create index if not exists piano_visits_user_id_idx
  on public.piano_visits(user_id);

alter table public.piano_visits enable row level security;

drop policy if exists piano_visits_select on public.piano_visits;
create policy piano_visits_select on public.piano_visits for select using (true);

drop policy if exists piano_visits_insert on public.piano_visits;
create policy piano_visits_insert on public.piano_visits
  for insert with check (auth.uid() = user_id);

-- pas d'UPDATE ni DELETE : un passage est immuable (cohérent avec piano_updates)

-- 6.b. Session de présence : "je joue maintenant" ou "j'y serai à X"
create table if not exists public.piano_sessions (
  id            uuid primary key default gen_random_uuid(),
  piano_id      uuid not null references public.pianos(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  starts_at     timestamptz not null,
  duration_min  int not null check (duration_min between 5 and 240),
  created_at    timestamptz not null default now(),
  cancelled_at  timestamptz,
  -- bornes temporelles : pas dans le lointain passé, pas plus de 7 jours en avance
  constraint piano_sessions_starts_at_range
    check (starts_at >= now() - interval '1 hour'
           and starts_at <= now() + interval '7 days')
);
create index if not exists piano_sessions_piano_id_idx
  on public.piano_sessions(piano_id, starts_at);
create index if not exists piano_sessions_active_idx
  on public.piano_sessions(starts_at)
  where cancelled_at is null;

alter table public.piano_sessions enable row level security;

drop policy if exists piano_sessions_select on public.piano_sessions;
create policy piano_sessions_select on public.piano_sessions for select using (true);

drop policy if exists piano_sessions_insert on public.piano_sessions;
create policy piano_sessions_insert on public.piano_sessions
  for insert with check (auth.uid() = user_id);

-- UPDATE par owner uniquement, et uniquement pour cancelled_at (soft cancel)
drop policy if exists piano_sessions_update_cancel on public.piano_sessions;
create policy piano_sessions_update_cancel on public.piano_sessions
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists piano_sessions_delete_owner on public.piano_sessions;
create policy piano_sessions_delete_owner on public.piano_sessions
  for delete using (auth.uid() = user_id);

-- ============================
-- 7. v3 — Rôles, modération, évènements, demandes utilisateurs
-- ============================

-- 7.a. Enum user_role + extension de profiles
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('user', 'admin', 'superadmin');
  end if;
end$$;

alter table public.profiles
  add column if not exists role user_role not null default 'user',
  add column if not exists banned_at timestamptz;

-- 7.b. Helpers SECURITY DEFINER (utilisés dans les policies et RPCs)
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'superadmin')
  );
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin'
  );
$$;

create or replace function public.is_banned(uid uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select banned_at is not null from public.profiles where id = uid),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.is_banned(uuid) to authenticated;

-- 7.c. Élargir RLS profiles : admin/superadmin peut lire l'email et tout user
-- (déjà SELECT public). Ajouter une policy UPDATE admin pour cas non-RPC futurs.
-- Pour l'instant les changements sensibles passent par les RPCs ci-dessous.

-- 7.d. Réinscrire les policies INSERT existantes avec check anti-banni
-- (re-création idempotente : on drop puis crée).
drop policy if exists pianos_insert on public.pianos;
create policy pianos_insert on public.pianos
  for insert with check (
    auth.uid() = created_by and not public.is_banned(auth.uid())
  );

drop policy if exists piano_updates_insert on public.piano_updates;
create policy piano_updates_insert on public.piano_updates
  for insert with check (
    auth.uid() = updated_by and not public.is_banned(auth.uid())
  );

drop policy if exists piano_reports_insert on public.piano_reports;
create policy piano_reports_insert on public.piano_reports
  for insert with check (
    auth.uid() = reported_by and not public.is_banned(auth.uid())
  );

drop policy if exists piano_visits_insert on public.piano_visits;
create policy piano_visits_insert on public.piano_visits
  for insert with check (
    auth.uid() = user_id and not public.is_banned(auth.uid())
  );

drop policy if exists piano_sessions_insert on public.piano_sessions;
create policy piano_sessions_insert on public.piano_sessions
  for insert with check (
    auth.uid() = user_id and not public.is_banned(auth.uid())
  );

-- 7.e. Élargir SELECT de piano_reports pour les admins
drop policy if exists piano_reports_select_admin on public.piano_reports;
create policy piano_reports_select_admin on public.piano_reports
  for select using (public.is_admin());

-- 7.f. RPCs d'administration

-- Promotion / rétrogradation (superadmin uniquement)
create or replace function public.set_user_role(target uuid, new_role user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'forbidden';
  end if;
  if target = auth.uid() then
    raise exception 'cannot change own role';
  end if;
  update public.profiles set role = new_role where id = target;
end $$;

-- Bannir / débannir (admin ou superadmin, mais jamais un superadmin)
create or replace function public.set_user_banned(target uuid, banned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target_role user_role;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  select role into target_role from public.profiles where id = target;
  if target_role = 'superadmin' then
    raise exception 'cannot ban superadmin';
  end if;
  update public.profiles
  set banned_at = case when banned then now() else null end
  where id = target;
end $$;

-- Marquer un report comme traité
create or replace function public.resolve_report(report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  update public.piano_reports set resolved = true where id = report_id;
end $$;

-- Forcer suppression d'un piano (override ownership)
create or replace function public.force_delete_piano(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  update public.pianos set is_deleted = true where id = target;
end $$;

revoke all on function public.set_user_role(uuid, user_role) from public;
revoke all on function public.set_user_banned(uuid, boolean) from public;
revoke all on function public.resolve_report(uuid) from public;
revoke all on function public.force_delete_piano(uuid) from public;
grant execute on function public.set_user_role(uuid, user_role) to authenticated;
grant execute on function public.set_user_banned(uuid, boolean) to authenticated;
grant execute on function public.resolve_report(uuid) to authenticated;
grant execute on function public.force_delete_piano(uuid) to authenticated;

-- ============================
-- 8. Évènements
-- ============================

create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 120),
  description   text not null check (char_length(description) between 1 and 2000),
  location      text not null check (char_length(location) between 1 and 200),
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  max_participants int check (max_participants is null or max_participants > 0),
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now(),
  cancelled_at  timestamptz,
  constraint events_dates_ok check (ends_at is null or ends_at > starts_at)
);
create index if not exists events_starts_at_idx
  on public.events(starts_at)
  where cancelled_at is null;

create table if not exists public.event_participants (
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists event_participants_user_idx
  on public.event_participants(user_id);

alter table public.events enable row level security;
alter table public.event_participants enable row level security;

drop policy if exists events_select on public.events;
create policy events_select on public.events for select using (true);

drop policy if exists events_insert_admin on public.events;
create policy events_insert_admin on public.events
  for insert with check (public.is_admin());

drop policy if exists events_update_admin on public.events;
create policy events_update_admin on public.events
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists events_delete_admin on public.events;
create policy events_delete_admin on public.events
  for delete using (public.is_admin());

drop policy if exists event_participants_select on public.event_participants;
create policy event_participants_select on public.event_participants
  for select using (true);

-- Helper "place restante"
create or replace function public.event_has_room(eid uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select e.max_participants is null or e.max_participants > (
    select count(*) from public.event_participants where event_id = eid
  )
  from public.events e where e.id = eid;
$$;

drop policy if exists event_participants_insert on public.event_participants;
create policy event_participants_insert on public.event_participants
  for insert with check (
    auth.uid() = user_id
    and not public.is_banned(auth.uid())
    and public.event_has_room(event_id)
  );

drop policy if exists event_participants_delete on public.event_participants;
create policy event_participants_delete on public.event_participants
  for delete using (auth.uid() = user_id);

-- ============================
-- 9. Demandes utilisateurs
-- ============================

create table if not exists public.user_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  subject      text not null check (char_length(subject) between 1 and 120),
  message      text not null check (char_length(message) between 1 and 2000),
  created_at   timestamptz not null default now(),
  admin_reply  text check (admin_reply is null or char_length(admin_reply) <= 2000),
  replied_at   timestamptz,
  replied_by   uuid references public.profiles(id),
  status       text not null default 'open' check (status in ('open', 'answered'))
);
create index if not exists user_requests_user_created_idx
  on public.user_requests(user_id, created_at desc);
create index if not exists user_requests_open_idx
  on public.user_requests(created_at desc)
  where status = 'open';

alter table public.user_requests enable row level security;

drop policy if exists user_requests_select_own_or_admin on public.user_requests;
create policy user_requests_select_own_or_admin on public.user_requests
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists user_requests_insert_self on public.user_requests;
create policy user_requests_insert_self on public.user_requests
  for insert with check (
    auth.uid() = user_id and not public.is_banned(auth.uid())
  );

-- Pas d'UPDATE direct : passe par RPC reply_to_request
-- Pas de DELETE pour conserver la trace (l'admin gère ses cas)

create or replace function public.reply_to_request(request_id uuid, reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if reply is null or char_length(reply) = 0 or char_length(reply) > 2000 then
    raise exception 'invalid reply';
  end if;
  update public.user_requests
  set admin_reply = reply,
      replied_at = now(),
      replied_by = auth.uid(),
      status = 'answered'
  where id = request_id;
end $$;

revoke all on function public.reply_to_request(uuid, text) from public;
grant execute on function public.reply_to_request(uuid, text) to authenticated;

-- ============================
-- 10. Bootstrap superadmin (idempotent — à ré-exécuter après le 1er signup)
-- ============================
update public.profiles
set role = 'superadmin'
where id = (select id from auth.users where email = 'enzo.reine35@gmail.com')
  and role <> 'superadmin';
