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
-- 10. v4 — Préférences de notifications + Push + Outbox + Rate limits
-- ============================

-- 10.a. Préférences de notification (1 ligne par user, créée automatiquement)
create table if not exists public.notification_preferences (
  user_id                 uuid primary key references public.profiles(id) on delete cascade,
  notify_comments         boolean not null default true,
  notify_session_conflict boolean not null default true,
  notify_request_reply    boolean not null default true,
  notify_events           boolean not null default true,
  notify_piano_updates    boolean not null default true,
  push_enabled            boolean not null default false,
  updated_at              timestamptz not null default now()
);

-- Auto-création des prefs au signup (via trigger sur profiles)
create or replace function public.ensure_notification_prefs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences(user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end$$;

drop trigger if exists profiles_ensure_notif_prefs on public.profiles;
create trigger profiles_ensure_notif_prefs
  after insert on public.profiles
  for each row execute function public.ensure_notification_prefs();

-- Backfill : créer une ligne pour les profils déjà existants
insert into public.notification_preferences(user_id)
select id from public.profiles
on conflict (user_id) do nothing;

alter table public.notification_preferences enable row level security;

drop policy if exists notif_prefs_select_own on public.notification_preferences;
create policy notif_prefs_select_own on public.notification_preferences
  for select using (auth.uid() = user_id);

drop policy if exists notif_prefs_insert_own on public.notification_preferences;
create policy notif_prefs_insert_own on public.notification_preferences
  for insert with check (auth.uid() = user_id);

drop policy if exists notif_prefs_update_own on public.notification_preferences;
create policy notif_prefs_update_own on public.notification_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 10.b. Push subscriptions (Web Push API)
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth_secret  text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_sub_select_own on public.push_subscriptions;
create policy push_sub_select_own on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists push_sub_insert_own on public.push_subscriptions;
create policy push_sub_insert_own on public.push_subscriptions
  for insert with check (
    auth.uid() = user_id and not public.is_banned(auth.uid())
  );

drop policy if exists push_sub_delete_own on public.push_subscriptions;
create policy push_sub_delete_own on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- 10.c. Outbox des notifications (lue par Edge Function via webhook)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_kind') then
    create type notification_kind as enum (
      'piano_comment',
      'piano_update',
      'session_conflict',
      'request_reply',
      'event_created'
    );
  end if;
end$$;

create table if not exists public.notifications_outbox (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind         notification_kind not null,
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  error        text
);
create index if not exists notifications_outbox_pending_idx
  on public.notifications_outbox(created_at)
  where sent_at is null;
create index if not exists notifications_outbox_recipient_idx
  on public.notifications_outbox(recipient_id, created_at desc);

alter table public.notifications_outbox enable row level security;

-- Lecture admin uniquement (debug). L'Edge Function utilise service_role.
drop policy if exists notif_outbox_select_admin on public.notifications_outbox;
create policy notif_outbox_select_admin on public.notifications_outbox
  for select using (public.is_admin());

-- 10.d. Triggers : queue les notifications dans l'outbox

-- Sur piano_updates : notifier le créateur du piano (sauf si c'est lui-même qui MAJ)
create or replace function public.queue_piano_update_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_piano_creator uuid;
  v_piano_address text;
  v_kind notification_kind;
begin
  select created_by, address into v_piano_creator, v_piano_address
  from public.pianos where id = new.piano_id and is_deleted = false;

  if v_piano_creator is null or v_piano_creator = new.updated_by then
    return new;
  end if;

  -- Si un commentaire est présent → kind = piano_comment (priorité pour le mail)
  v_kind := case when new.comment is not null and char_length(new.comment) > 0
                 then 'piano_comment'::notification_kind
                 else 'piano_update'::notification_kind end;

  insert into public.notifications_outbox(recipient_id, kind, payload)
  values (
    v_piano_creator,
    v_kind,
    jsonb_build_object(
      'piano_id', new.piano_id,
      'piano_address', v_piano_address,
      'update_id', new.id,
      'still_there', new.still_there,
      'new_quality', new.new_quality,
      'comment', new.comment,
      'updated_by', new.updated_by
    )
  );
  return new;
end$$;

drop trigger if exists piano_updates_notify on public.piano_updates;
create trigger piano_updates_notify
  after insert on public.piano_updates
  for each row execute function public.queue_piano_update_notification();

-- Sur piano_sessions : notifier les users qui ont une session chevauchante sur le même piano
create or replace function public.queue_session_conflict_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_overlap record;
  v_piano_address text;
begin
  if new.cancelled_at is not null then
    return new;
  end if;

  select address into v_piano_address
  from public.pianos where id = new.piano_id and is_deleted = false;

  if v_piano_address is null then
    return new;
  end if;

  for v_overlap in
    select s.user_id, s.starts_at, s.duration_min
    from public.piano_sessions s
    where s.piano_id = new.piano_id
      and s.id <> new.id
      and s.user_id <> new.user_id
      and s.cancelled_at is null
      and tstzrange(s.starts_at, s.starts_at + make_interval(mins => s.duration_min)) &&
          tstzrange(new.starts_at, new.starts_at + make_interval(mins => new.duration_min))
  loop
    insert into public.notifications_outbox(recipient_id, kind, payload)
    values (
      v_overlap.user_id,
      'session_conflict',
      jsonb_build_object(
        'piano_id', new.piano_id,
        'piano_address', v_piano_address,
        'session_id', new.id,
        'other_user_id', new.user_id,
        'their_starts_at', new.starts_at,
        'their_duration_min', new.duration_min,
        'my_starts_at', v_overlap.starts_at
      )
    );
  end loop;
  return new;
end$$;

drop trigger if exists piano_sessions_notify_conflict on public.piano_sessions;
create trigger piano_sessions_notify_conflict
  after insert on public.piano_sessions
  for each row execute function public.queue_session_conflict_notification();

-- Sur events : notifier tous les users (sauf le créateur)
-- Filtre par préférence `notify_events` pour respecter le consentement RGPD.
-- La jointure inner sur notification_preferences garantit qu'on ne queue rien
-- pour un user qui a coché "off". Le trigger profiles_ensure_notif_prefs garantit
-- qu'une ligne prefs existe pour tout profile actif.
create or replace function public.queue_event_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cancelled_at is not null then return new; end if;

  insert into public.notifications_outbox(recipient_id, kind, payload)
  select
    p.id,
    'event_created'::notification_kind,
    jsonb_build_object(
      'event_id', new.id,
      'title', new.title,
      'location', new.location,
      'starts_at', new.starts_at
    )
  from public.profiles p
  inner join public.notification_preferences np on np.user_id = p.id
  where p.id <> new.created_by
    and p.banned_at is null
    and np.notify_events = true;
  return new;
end$$;

drop trigger if exists events_notify on public.events;
create trigger events_notify
  after insert on public.events
  for each row execute function public.queue_event_notifications();

-- Étendre reply_to_request pour pusher dans l'outbox
create or replace function public.reply_to_request(request_id uuid, reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_subject text;
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
  where id = request_id
  returning user_id, subject into v_user_id, v_subject;

  if v_user_id is not null then
    insert into public.notifications_outbox(recipient_id, kind, payload)
    values (
      v_user_id,
      'request_reply',
      jsonb_build_object(
        'request_id', request_id,
        'subject', v_subject,
        'reply', reply
      )
    );
  end if;
end$$;

-- 10.e. Rate limits (enforcés au niveau RLS via fonction within_rate_limit)
-- Conventions de limites (modifiables ici sans toucher l'app) :
--   piano_create  : 5 / 24h
--   piano_update  : 30 / 24h
--   piano_visit   : 50 / 24h
--   piano_session : 10 / 24h
--   piano_report  : 5 / 24h
--   user_request  : 5 / 7j
create or replace function public.within_rate_limit(action_name text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
  v_max int;
  v_window interval;
begin
  if v_uid is null then return false; end if;

  case action_name
    when 'piano_create' then
      v_max := 5; v_window := interval '24 hours';
      select count(*) into v_count from public.pianos
        where created_by = v_uid and created_at >= now() - v_window;
    when 'piano_update' then
      v_max := 30; v_window := interval '24 hours';
      select count(*) into v_count from public.piano_updates
        where updated_by = v_uid and created_at >= now() - v_window;
    when 'piano_visit' then
      v_max := 50; v_window := interval '24 hours';
      select count(*) into v_count from public.piano_visits
        where user_id = v_uid and visited_at >= now() - v_window;
    when 'piano_session' then
      v_max := 10; v_window := interval '24 hours';
      select count(*) into v_count from public.piano_sessions
        where user_id = v_uid and created_at >= now() - v_window;
    when 'piano_report' then
      v_max := 5; v_window := interval '24 hours';
      select count(*) into v_count from public.piano_reports
        where reported_by = v_uid and created_at >= now() - v_window;
    when 'user_request' then
      v_max := 5; v_window := interval '7 days';
      select count(*) into v_count from public.user_requests
        where user_id = v_uid and created_at >= now() - v_window;
    else
      return false;
  end case;

  return v_count < v_max;
end$$;

grant execute on function public.within_rate_limit(text) to authenticated;

-- Réinscrire les policies INSERT avec le check rate-limit en plus
drop policy if exists pianos_insert on public.pianos;
create policy pianos_insert on public.pianos
  for insert with check (
    auth.uid() = created_by
    and not public.is_banned(auth.uid())
    and public.within_rate_limit('piano_create')
  );

drop policy if exists piano_updates_insert on public.piano_updates;
create policy piano_updates_insert on public.piano_updates
  for insert with check (
    auth.uid() = updated_by
    and not public.is_banned(auth.uid())
    and public.within_rate_limit('piano_update')
  );

drop policy if exists piano_visits_insert on public.piano_visits;
create policy piano_visits_insert on public.piano_visits
  for insert with check (
    auth.uid() = user_id
    and not public.is_banned(auth.uid())
    and public.within_rate_limit('piano_visit')
  );

drop policy if exists piano_sessions_insert on public.piano_sessions;
create policy piano_sessions_insert on public.piano_sessions
  for insert with check (
    auth.uid() = user_id
    and not public.is_banned(auth.uid())
    and public.within_rate_limit('piano_session')
  );

drop policy if exists piano_reports_insert on public.piano_reports;
create policy piano_reports_insert on public.piano_reports
  for insert with check (
    auth.uid() = reported_by
    and not public.is_banned(auth.uid())
    and public.within_rate_limit('piano_report')
  );

drop policy if exists user_requests_insert_self on public.user_requests;
create policy user_requests_insert_self on public.user_requests
  for insert with check (
    auth.uid() = user_id
    and not public.is_banned(auth.uid())
    and public.within_rate_limit('user_request')
  );

-- 10.f. RPC marque outbox comme envoyé (appelée par Edge Function via service_role
-- mais sécurité belt-and-suspenders au cas où)
create or replace function public.mark_notification_sent(notif_id uuid, err text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications_outbox
  set sent_at = now(), error = err
  where id = notif_id;
end$$;

revoke all on function public.mark_notification_sent(uuid, text) from public;
-- Pas de grant à authenticated : service_role uniquement

-- 10.g. Vérification du mot de passe courant (utilisée par ChangePasswordDialog).
-- Évite de devoir refaire un signInWithPassword côté client, qui rotate le
-- refresh token et déconnecte les autres devices/onglets.
-- Sécurité : security definer + lecture restreinte au seul auth.users.id =
-- auth.uid(). Le hash ne sort jamais de la fonction. pgcrypto.crypt() compare
-- en temps constant.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.verify_my_password(p text)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_hash text;
begin
  if auth.uid() is null then
    return false;
  end if;
  if p is null or char_length(p) = 0 then
    return false;
  end if;
  -- v7+ : rate-limit dur 10/h pour stopper le brute-force online.
  -- Référence late-bound vers enforce_caller_rate_limit (déclaré section 15.g).
  perform public.enforce_caller_rate_limit('verify_password', 10, '1 hour'::interval);
  select encrypted_password into v_hash
  from auth.users
  where id = auth.uid();
  if v_hash is null then
    return false;
  end if;
  return v_hash = extensions.crypt(p, v_hash);
end$$;

revoke all on function public.verify_my_password(text) from public;
grant execute on function public.verify_my_password(text) to authenticated;

-- ============================
-- 11. v5 — Durcissement P0
-- ============================

-- 11.a. Column-level grants sur profiles
-- Avant : `profiles_select USING (true)` exposait role et banned_at à anon.
-- → liste publique des admins (ciblage social-eng) + liste des bannis.
--
-- Stratégie : on garde la RLS permissive (joins PostgREST type
-- `author:profiles!fk(pseudo)` doivent continuer à marcher), mais on retire
-- le droit SELECT sur les colonnes sensibles via GRANT colonne-level.
--
-- Lecture self/admin : passe par les deux RPCs SECURITY DEFINER ci-dessous,
-- qui contournent l'absence de grant en s'exécutant comme `postgres`.
revoke select on public.profiles from anon, authenticated;
grant select (id, pseudo, created_at) on public.profiles to anon, authenticated;

-- RPC self : remplace AuthContext.fetchProfile pour permettre la lecture
-- complète de la ligne du user courant (role, banned_at). Toute valeur null
-- = user non authentifié ou profile manquant.
create or replace function public.get_my_profile()
returns public.profiles
language sql
security definer
stable
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

revoke all on function public.get_my_profile() from public;
grant execute on function public.get_my_profile() to authenticated;

-- RPC admin : liste paginée + filtrée des profils complets (avec role et
-- banned_at). Réservé admin/superadmin. La projection email reste à null —
-- l'email vit dans auth.users, accessible uniquement via admin API côté
-- Edge Function.
create or replace function public.admin_list_users(
  q text default '',
  filter text default 'all',
  lim int default 50
) returns setof public.profiles
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if lim is null or lim < 1 or lim > 200 then
    lim := 50;
  end if;
  return query
    select * from public.profiles
    where (q = '' or pseudo ilike '%' || q || '%')
      and (
        filter = 'all'
        or (filter = 'banned' and banned_at is not null)
        or (filter = 'admin' and role in ('admin', 'superadmin'))
      )
    order by created_at desc
    limit lim;
end$$;

revoke all on function public.admin_list_users(text, text, int) from public;
grant execute on function public.admin_list_users(text, text, int) to authenticated;

-- RPC admin : agrège les 11 KPIs du dashboard ("Vue d'ensemble") en 1 seul
-- aller-retour. Remplace d'anciennes requêtes directes `profiles.select('*')`
-- filtrées sur role/banned_at côté client, qui échouaient en 403 (colonnes
-- exclues du grant 11.a) — cf. useAdminKpis.ts.
create or replace function public.admin_kpis()
returns table (users_total int, users_new_7d int, users_new_30d int, users_banned int, users_admin int, pianos_total int, pianos_new_7d int, visits_total int, sessions_active int, reports_open int, requests_open int)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return query
  select
    (select count(*)::int from public.profiles),
    (select count(*)::int from public.profiles where created_at >= now() - interval '7 days'),
    (select count(*)::int from public.profiles where created_at >= now() - interval '30 days'),
    (select count(*)::int from public.profiles where banned_at is not null),
    (select count(*)::int from public.profiles where role in ('admin', 'superadmin')),
    (select count(*)::int from public.pianos where is_deleted = false),
    (select count(*)::int from public.pianos where is_deleted = false and created_at >= now() - interval '7 days'),
    (select count(*)::int from public.piano_visits),
    (select count(*)::int from public.piano_sessions
       where cancelled_at is null and starts_at >= now() - interval '24 hours' and starts_at <= now()),
    (select count(*)::int from public.piano_reports where resolved = false),
    (select count(*)::int from public.user_requests where status = 'open');
end$$;

revoke all on function public.admin_kpis() from public;
grant execute on function public.admin_kpis() to authenticated;

-- 11.b. Rate limiting bulletproof
-- Avant : within_rate_limit() était STABLE → snapshot du COUNT au début de
-- transaction. Un INSERT batch ou Promise.all parallèle voit toujours le
-- même count et passe à travers la limite.
--
-- Stratégie : trigger BEFORE INSERT générique enforce_rate_limit() qui prend
-- un advisory lock par (user, action) puis UPSERT atomique dans une table
-- dédiée. La table est verrouillée pendant la durée du check → impossible
-- de bypasser via parallélisme ou batch.

create table if not exists public.rate_limit_buckets (
  user_id      uuid not null references auth.users(id) on delete cascade,
  action       text not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (user_id, action, window_start)
);
create index if not exists rate_limit_buckets_lookup_idx
  on public.rate_limit_buckets(user_id, action, window_start);

alter table public.rate_limit_buckets enable row level security;
-- Aucune policy : nul ne peut lire/écrire directement. Le trigger
-- enforce_rate_limit (SECURITY DEFINER) gère tout côté serveur.
revoke all on public.rate_limit_buckets from anon, authenticated;

create or replace function public.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action  text     := TG_ARGV[0];
  v_max     int      := TG_ARGV[1]::int;
  v_window  interval := TG_ARGV[2]::interval;
  v_uid     uuid;
  v_bucket  timestamptz;
  v_total   int;
begin
  v_uid := coalesce(
    case when TG_TABLE_NAME = 'pianos' then (row_to_json(NEW)->>'created_by')::uuid end,
    case when TG_TABLE_NAME = 'piano_updates' then (row_to_json(NEW)->>'updated_by')::uuid end,
    case when TG_TABLE_NAME = 'piano_reports' then (row_to_json(NEW)->>'reported_by')::uuid end,
    case when TG_TABLE_NAME in ('piano_visits', 'piano_sessions', 'user_requests')
      then (row_to_json(NEW)->>'user_id')::uuid end,
    -- v6 : table friendships utilise requester_id (l'initiateur de la demande).
    case when TG_TABLE_NAME = 'friendships' then (row_to_json(NEW)->>'requester_id')::uuid end
  );
  if v_uid is null then
    raise exception 'rate_limit: cannot resolve user_id on table %', TG_TABLE_NAME;
  end if;

  -- Sérialise les checks par (user, action) sur la durée de la transaction.
  -- Empêche que deux INSERT concurrents voient tous les deux count = max-1.
  perform pg_advisory_xact_lock(hashtext(v_uid::text || ':' || v_action));

  v_bucket := date_trunc('minute', now());

  insert into public.rate_limit_buckets(user_id, action, window_start, count)
  values (v_uid, v_action, v_bucket, 1)
  on conflict (user_id, action, window_start)
  do update set count = public.rate_limit_buckets.count + 1;

  select coalesce(sum(count), 0) into v_total
  from public.rate_limit_buckets
  where user_id = v_uid
    and action = v_action
    and window_start >= now() - v_window;

  if v_total > v_max then
    raise exception 'rate_limit_exceeded'
      using errcode = 'P0001', hint = v_action;
  end if;
  return NEW;
end$$;

revoke all on function public.enforce_rate_limit() from public;

-- Remplace l'ancien within_rate_limit dans les policies INSERT.
-- On enlève l'ancien check côté policy (mais on garde la fonction
-- within_rate_limit pour compat / non-régression silencieuse).
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

drop policy if exists piano_reports_insert on public.piano_reports;
create policy piano_reports_insert on public.piano_reports
  for insert with check (
    auth.uid() = reported_by and not public.is_banned(auth.uid())
  );

drop policy if exists user_requests_insert_self on public.user_requests;
create policy user_requests_insert_self on public.user_requests
  for insert with check (
    auth.uid() = user_id and not public.is_banned(auth.uid())
  );

-- Triggers BEFORE INSERT : un par table * action.
drop trigger if exists pianos_rate_limit on public.pianos;
create trigger pianos_rate_limit
  before insert on public.pianos
  for each row execute function public.enforce_rate_limit('piano_create', '5', '24 hours');

drop trigger if exists piano_updates_rate_limit on public.piano_updates;
create trigger piano_updates_rate_limit
  before insert on public.piano_updates
  for each row execute function public.enforce_rate_limit('piano_update', '30', '24 hours');

drop trigger if exists piano_visits_rate_limit on public.piano_visits;
create trigger piano_visits_rate_limit
  before insert on public.piano_visits
  for each row execute function public.enforce_rate_limit('piano_visit', '50', '24 hours');

drop trigger if exists piano_sessions_rate_limit on public.piano_sessions;
create trigger piano_sessions_rate_limit
  before insert on public.piano_sessions
  for each row execute function public.enforce_rate_limit('piano_session', '10', '24 hours');

drop trigger if exists piano_reports_rate_limit on public.piano_reports;
create trigger piano_reports_rate_limit
  before insert on public.piano_reports
  for each row execute function public.enforce_rate_limit('piano_report', '5', '24 hours');

drop trigger if exists user_requests_rate_limit on public.user_requests;
create trigger user_requests_rate_limit
  before insert on public.user_requests
  for each row execute function public.enforce_rate_limit('user_request', '5', '7 days');

-- 11.c. Lockout protection sur set_user_role + re-auth password sur RPCs irréversibles
--
-- set_user_role : empêcher la rétrogradation du dernier superadmin (sinon le
-- superadmin A peut rétrograder le superadmin B et lockout total si A perd
-- ses creds).
create or replace function public.set_user_role(target uuid, new_role user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_remaining int;
begin
  if not public.is_superadmin() then
    raise exception 'forbidden';
  end if;
  if target = auth.uid() then
    raise exception 'cannot change own role';
  end if;
  if new_role <> 'superadmin' then
    select count(*) into v_remaining
    from public.profiles
    where role = 'superadmin' and id <> target;
    if v_remaining < 1 then
      raise exception 'cannot demote last superadmin';
    end if;
  end if;
  update public.profiles set role = new_role where id = target;
end$$;

-- Re-auth password : les RPCs irréversibles (ban, suppression piano,
-- suppression compte) doivent re-vérifier le password avant action.
-- Empêche un attaquant ayant volé une session courte de causer des
-- dommages permanents sans reconfirmer.
create or replace function public.set_user_banned(
  target uuid, banned boolean, p_password text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare target_role user_role;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_password is null or not public.verify_my_password(p_password) then
    raise exception 'invalid_password';
  end if;
  select role into target_role from public.profiles where id = target;
  if target_role = 'superadmin' then
    raise exception 'cannot ban superadmin';
  end if;
  update public.profiles
  set banned_at = case when banned then now() else null end
  where id = target;
end$$;

create or replace function public.force_delete_piano(
  target uuid, p_password text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_password is null or not public.verify_my_password(p_password) then
    raise exception 'invalid_password';
  end if;
  update public.pianos set is_deleted = true where id = target;
end$$;

create or replace function public.delete_my_account(p_password text default null)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  uid uuid := auth.uid();
  v_email text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_password is null or not public.verify_my_password(p_password) then
    raise exception 'invalid_password';
  end if;
  -- Audit log : trace l'événement avec un hash de l'email (forensic-safe,
  -- pas un registre RGPD-incompatible). Permet de détecter une suppression
  -- de masse anormale (botnet, attaquant via session volée).
  select email into v_email from auth.users where id = uid;
  perform public.write_audit_log(
    'delete_my_account_self',
    uid,
    jsonb_build_object(
      'email_sha256', encode(extensions.digest(coalesce(v_email, ''), 'sha256'), 'hex')
    )
  );
  delete from auth.users where id = uid;
end$$;

-- Les signatures changent (nouveau paramètre p_password). Re-grant pour
-- couvrir la nouvelle signature ; l'ancienne n'est plus appelée par le
-- front. On peut conserver l'ancienne signature pour rétro-compat pendant
-- une migration ; ici on remplace direct.
revoke all on function public.set_user_banned(uuid, boolean) from public;
revoke all on function public.set_user_banned(uuid, boolean, text) from public;
revoke all on function public.force_delete_piano(uuid) from public;
revoke all on function public.force_delete_piano(uuid, text) from public;
revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account(text) from public;
grant execute on function public.set_user_banned(uuid, boolean, text) to authenticated;
grant execute on function public.force_delete_piano(uuid, text) to authenticated;
grant execute on function public.delete_my_account(text) to authenticated;

-- 11.d. Création automatique du profile au signup (trigger auth.users)
-- Avec email confirmation activée, auth.uid() est NULL tant que le user n'a
-- pas cliqué sur le lien — la policy profiles_insert_self échouerait côté
-- client. On déplace la création du profil dans un trigger AFTER INSERT
-- sur auth.users (SECURITY DEFINER), qui lit le pseudo depuis
-- raw_user_meta_data. Fallback : si pseudo manquant ou collision, on génère
-- un suffixe — le user pourra rename via EditPseudoDialog.
--
-- Persiste aussi l'acceptation CGU (date + version) si elle est passée dans
-- raw_user_meta_data (cf. A.6.2). Sinon laisse à null — l'user devra accepter
-- au prochain login via /cgu-update.
alter table public.profiles
  add column if not exists accept_cgu_at      timestamptz,
  add column if not exists accept_cgu_version text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_pseudo      text;
  v_attempt     text;
  v_i           int := 0;
  v_cgu_version text;
  v_cgu_at      timestamptz;
begin
  v_pseudo := coalesce(
    nullif(new.raw_user_meta_data->>'pseudo', ''),
    'user_' || substr(new.id::text, 1, 8)
  );
  v_attempt := v_pseudo;
  while exists(select 1 from public.profiles where pseudo = v_attempt) loop
    v_i := v_i + 1;
    v_attempt := v_pseudo || '_' || v_i;
    exit when v_i > 50;
  end loop;

  v_cgu_version := nullif(new.raw_user_meta_data->>'accept_cgu_version', '');
  if v_cgu_version is not null then
    v_cgu_at := now();
  end if;

  insert into public.profiles(id, pseudo, accept_cgu_at, accept_cgu_version)
  values (new.id, v_attempt, v_cgu_at, v_cgu_version)
  on conflict (id) do nothing;
  return new;
end$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 11.e. RGPD — anonymisation des contributions historiques + export complet
--
-- Avant : piano_updates.updated_by ON DELETE CASCADE → quand un user supprime
-- son compte, tout son historique de MAJ disparait → perte de valeur
-- communautaire (les autres utilisateurs ne savent plus pourquoi un piano a
-- été marqué disparu, etc.).
--
-- Après : ON DELETE SET NULL + snapshot pseudo dans une colonne dédiée
-- author_pseudo_at_time. L'historique survit, attribué à un pseudo figé
-- ("@enzo (compte supprimé)" affiché côté UI).
alter table public.piano_updates
  add column if not exists author_pseudo_at_time text;

alter table public.piano_updates
  drop constraint if exists piano_updates_updated_by_fkey,
  add constraint piano_updates_updated_by_fkey
    foreign key (updated_by) references public.profiles(id) on delete set null;

create or replace function public.fill_pseudo_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.author_pseudo_at_time is null and new.updated_by is not null then
    select pseudo into new.author_pseudo_at_time
    from public.profiles where id = new.updated_by;
  end if;
  return new;
end$$;

drop trigger if exists piano_updates_pseudo_snapshot on public.piano_updates;
create trigger piano_updates_pseudo_snapshot
  before insert on public.piano_updates
  for each row execute function public.fill_pseudo_snapshot();

-- Backfill : remplit la colonne pour les rows existantes (au moment où
-- on déploie cette migration).
update public.piano_updates u
set author_pseudo_at_time = p.pseudo
from public.profiles p
where u.updated_by = p.id and u.author_pseudo_at_time is null;

-- RPC export RGPD complet : renvoie un jsonb structuré avec TOUTES les
-- données touchant le user courant. À ouvrir dans la requête front
-- ExportDataButton pour faire un download JSON unique.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select email into v_email from auth.users where id = v_uid;

  v_result := jsonb_build_object(
    'exported_at', now(),
    'user', jsonb_build_object('id', v_uid, 'email', v_email),
    'profile', (
      select to_jsonb(p) from public.profiles p where p.id = v_uid
    ),
    'pianos', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.pianos t where t.created_by = v_uid
    ), '[]'::jsonb),
    'piano_updates', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.piano_updates t where t.updated_by = v_uid
    ), '[]'::jsonb),
    'piano_reports', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.piano_reports t where t.reported_by = v_uid
    ), '[]'::jsonb),
    'piano_visits', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.piano_visits t where t.user_id = v_uid
    ), '[]'::jsonb),
    'piano_sessions', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.piano_sessions t where t.user_id = v_uid
    ), '[]'::jsonb),
    'event_participants', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.event_participants t where t.user_id = v_uid
    ), '[]'::jsonb),
    'user_requests', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.user_requests t where t.user_id = v_uid
    ), '[]'::jsonb),
    'notification_preferences', (
      select to_jsonb(t) from public.notification_preferences t where t.user_id = v_uid
    ),
    'push_subscriptions', coalesce((
      -- Endpoints uniquement : pas de p256dh/auth_secret (clés sensibles)
      select jsonb_agg(jsonb_build_object(
        'endpoint', endpoint,
        'user_agent', user_agent,
        'created_at', created_at,
        'last_used_at', last_used_at
      )) from public.push_subscriptions t where t.user_id = v_uid
    ), '[]'::jsonb)
  );
  return v_result;
end$$;

revoke all on function public.export_my_data() from public;
grant execute on function public.export_my_data() to authenticated;

-- 11.f. Audit log admin
-- Trace toutes les actions admin sensibles : qui a banni qui, supprimé quoi,
-- changé quel rôle, répondu à quelle demande. Indispensable pour la réponse
-- à incident et pour le droit à l'information RGPD article 15.
--
-- La table est en INSERT-only via une fonction SECURITY DEFINER ; jamais
-- d'UPDATE/DELETE possible côté client. SELECT est gated admin.

create table if not exists public.audit_log (
  id          bigserial primary key,
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  target_id   uuid,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_created_idx
  on public.audit_log(created_at desc);
create index if not exists audit_log_actor_idx
  on public.audit_log(actor_id, created_at desc);
create index if not exists audit_log_action_idx
  on public.audit_log(action, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin on public.audit_log
  for select using (public.is_admin());

-- Pas de policy INSERT/UPDATE/DELETE — l'écriture passe exclusivement par la
-- fonction security definer ci-dessous, appelée depuis les autres RPCs admin.

create or replace function public.write_audit_log(
  p_action text, p_target uuid, p_payload jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log(actor_id, action, target_id, payload)
  values (auth.uid(), p_action, p_target, coalesce(p_payload, '{}'::jsonb));
end$$;

revoke all on function public.write_audit_log(text, uuid, jsonb) from public;
-- Pas de grant à authenticated : appel uniquement depuis d'autres SECURITY
-- DEFINER functions (set_user_role, set_user_banned, etc.) qui s'exécutent
-- comme `postgres` et peuvent appeler write_audit_log librement.

-- Wrapping des RPCs admin pour tracer chaque action sensible.
-- On re-définit ici les RPCs déjà créées en section 11.c en ajoutant
-- l'appel à write_audit_log à la fin.

create or replace function public.set_user_role(target uuid, new_role user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_remaining int;
begin
  if not public.is_superadmin() then
    raise exception 'forbidden';
  end if;
  if target = auth.uid() then
    raise exception 'cannot change own role';
  end if;
  if new_role <> 'superadmin' then
    select count(*) into v_remaining
    from public.profiles
    where role = 'superadmin' and id <> target;
    if v_remaining < 1 then
      raise exception 'cannot demote last superadmin';
    end if;
  end if;
  update public.profiles set role = new_role where id = target;
  perform public.write_audit_log(
    'set_user_role', target, jsonb_build_object('new_role', new_role)
  );
end$$;

create or replace function public.set_user_banned(
  target uuid, banned boolean, p_password text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare target_role user_role;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_password is null or not public.verify_my_password(p_password) then
    raise exception 'invalid_password';
  end if;
  select role into target_role from public.profiles where id = target;
  if target_role = 'superadmin' then
    raise exception 'cannot ban superadmin';
  end if;
  update public.profiles
  set banned_at = case when banned then now() else null end
  where id = target;
  perform public.write_audit_log(
    'set_user_banned', target, jsonb_build_object('banned', banned)
  );
end$$;

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
  perform public.write_audit_log('resolve_report', report_id, '{}'::jsonb);
end$$;

create or replace function public.force_delete_piano(
  target uuid, p_password text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_password is null or not public.verify_my_password(p_password) then
    raise exception 'invalid_password';
  end if;
  update public.pianos set is_deleted = true where id = target;
  perform public.write_audit_log('force_delete_piano', target, '{}'::jsonb);
end$$;

create or replace function public.reply_to_request(request_id uuid, reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_subject text;
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
  where id = request_id
  returning user_id, subject into v_user_id, v_subject;

  if v_user_id is not null then
    insert into public.notifications_outbox(recipient_id, kind, payload)
    values (
      v_user_id,
      'request_reply',
      jsonb_build_object(
        'request_id', request_id,
        'subject', v_subject,
        'reply', reply
      )
    );
  end if;

  perform public.write_audit_log(
    'reply_to_request', request_id,
    jsonb_build_object('reply_len', char_length(reply))
  );
end$$;

-- 11.g. Outbox notifications : retry avec backoff + dead-letter + purge
--
-- Avant : Edge Function échoue → row reste `sent_at = null` avec error
-- rempli, jamais retry, table grossit indéfiniment.
--
-- Après : 3 colonnes ajoutées (status, attempts, next_retry_at). Un job
-- pg_cron (à activer manuellement post-déploiement, voir section 13) ré-POST
-- les rows pending toutes les 5 minutes. Après 5 attempts → status =
-- 'permanent_failure'. Purge nightly des sent depuis > 30j.

alter table public.notifications_outbox
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'sent', 'permanent_failure')),
  add column if not exists attempts int not null default 0,
  add column if not exists next_retry_at timestamptz;

create index if not exists notifications_outbox_status_idx
  on public.notifications_outbox(status, next_retry_at)
  where status = 'pending';

-- Backfill : rows déjà sent_at non null sont marquées 'sent', les autres
-- restent 'pending' avec next_retry_at = now() pour traitement immédiat.
update public.notifications_outbox
set status = case
      when sent_at is not null and error is null then 'sent'
      when sent_at is not null and error is not null then 'permanent_failure'
      else 'pending'
    end,
    attempts = case when sent_at is not null then 1 else 0 end,
    next_retry_at = case when sent_at is null then now() else null end
where status = 'pending'
  and attempts = 0
  and next_retry_at is null;

create or replace function public.mark_notification_sent(notif_id uuid, err text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts int;
  v_max_attempts constant int := 5;
  v_backoff_minutes int;
begin
  select attempts + 1 into v_attempts
  from public.notifications_outbox
  where id = notif_id;
  if v_attempts is null then
    return;
  end if;

  if err is null then
    update public.notifications_outbox
    set sent_at = now(),
        error = null,
        attempts = v_attempts,
        status = 'sent',
        next_retry_at = null
    where id = notif_id;
    return;
  end if;

  -- Backoff exponentiel : 2, 4, 8, 16, 32 minutes (cap à 5 tentatives).
  v_backoff_minutes := power(2, v_attempts)::int;
  if v_attempts >= v_max_attempts then
    update public.notifications_outbox
    set error = err,
        attempts = v_attempts,
        status = 'permanent_failure',
        next_retry_at = null,
        sent_at = now()
    where id = notif_id;
  else
    update public.notifications_outbox
    set error = err,
        attempts = v_attempts,
        status = 'pending',
        next_retry_at = now() + make_interval(mins => v_backoff_minutes)
    where id = notif_id;
  end if;
end$$;

revoke all on function public.mark_notification_sent(uuid, text) from public;
-- service_role only (Edge Function)

-- Helper appelable par pg_cron pour lister les notifs prêtes à être retentées.
-- Renvoie juste les IDs ; le job cron POSTera vers send-notification.
create or replace function public.list_pending_notifications(lim int default 50)
returns table(id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select id from public.notifications_outbox
  where status = 'pending'
    and attempts < 5
    and (next_retry_at is null or next_retry_at <= now())
  order by created_at asc
  limit lim;
$$;
revoke all on function public.list_pending_notifications(int) from public;

-- Purge des sent > 30j (à appeler depuis pg_cron, voir section 13).
create or replace function public.purge_old_notifications()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.notifications_outbox
  where status in ('sent', 'permanent_failure')
    and sent_at < now() - interval '30 days';
$$;
revoke all on function public.purge_old_notifications() from public;

-- ============================
-- 14. v6 — Système d'amitié + visibility sessions + compteur présence
-- ============================
-- ⚠️ Si ce fichier est exécuté via `psql -1` (transaction unique), les
-- 3 `ALTER TYPE notification_kind ADD VALUE` ci-dessous doivent être COMMITTED
-- avant utilisation dans les triggers. Le SQL Editor Supabase exécute chaque
-- statement dans sa propre transaction, donc OK par défaut.

-- 14.a Tables (déclarées avant les helpers : are_friends_safe est language sql,
-- donc PostgreSQL résout les références à la création, pas en late binding).
-- ---------------------------------------------------------------------

-- friendships : modèle 1-row canonique (user_a < user_b). Aucun grant côté
-- client → table totalement invisible via PostgREST. Accès exclusif via
-- les RPCs SECURITY DEFINER de cette section.
create table if not exists public.friendships (
  id            uuid primary key default gen_random_uuid(),
  user_a        uuid not null references public.profiles(id) on delete cascade,
  user_b        uuid not null references public.profiles(id) on delete cascade,
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending','accepted')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  constraint friendships_canonical_order  check (user_a < user_b),
  constraint friendships_no_self          check (user_a <> user_b),
  constraint friendships_requester_valid  check (requester_id in (user_a, user_b)),
  constraint friendships_unique_pair      unique (user_a, user_b)
);
create index if not exists friendships_user_a_idx
  on public.friendships(user_a) where status = 'accepted';
create index if not exists friendships_user_b_idx
  on public.friendships(user_b) where status = 'accepted';
create index if not exists friendships_pending_idx
  on public.friendships(user_a, user_b) where status = 'pending';
create index if not exists friendships_requester_idx
  on public.friendships(requester_id, status);
alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;
-- AUCUNE policy : totalement invisible côté PostgREST.

-- Vue helper symétrique. RLS security_invoker → inaccessible aux clients
-- tant que friendships est REVOKE. Utile pour les RPCs internes qui veulent
-- lister "mes amis" sans UNION manuelle.
create or replace view public.friendships_symmetric
with (security_invoker = true) as
  select id, user_a as user_id, user_b as friend_id, requester_id, status, created_at, responded_at
  from public.friendships
  union all
  select id, user_b as user_id, user_a as friend_id, requester_id, status, created_at, responded_at
  from public.friendships;
revoke all on public.friendships_symmetric from anon, authenticated;

-- friendship_rejections : cooldown anti-stalking (P0).
-- Quand B reject la demande de A, on insère (A, B, now()). A ne peut pas
-- renvoyer pendant 30 jours (send_friend_request raise 'forbidden').
create table if not exists public.friendship_rejections (
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  target_id     uuid not null references public.profiles(id) on delete cascade,
  rejected_at   timestamptz not null default now(),
  primary key (requester_id, target_id)
);
create index if not exists friendship_rejections_target_idx
  on public.friendship_rejections(target_id, rejected_at);
alter table public.friendship_rejections enable row level security;
revoke all on public.friendship_rejections from anon, authenticated;
-- Accès exclusivement via RPCs. Purge pg_cron mensuelle (cf. section 13).

-- friend_arriving_dedup : anti-spam digest hourly (P1).
-- Tuple (recipient, sender, piano) déjà enqueué moins d'1h → skip dans
-- le trigger queue_friend_arriving_notification (évite le notif-spam).
create table if not exists public.friend_arriving_dedup (
  recipient_id   uuid not null references public.profiles(id) on delete cascade,
  sender_id      uuid not null references public.profiles(id) on delete cascade,
  piano_id       uuid not null references public.pianos(id) on delete cascade,
  last_queued_at timestamptz not null default now(),
  primary key (recipient_id, sender_id, piano_id)
);
alter table public.friend_arriving_dedup enable row level security;
revoke all on public.friend_arriving_dedup from anon, authenticated;
-- Purge pg_cron hebdomadaire (cf. section 13).

-- 14.b Helpers SECURITY DEFINER
-- ---------------------------------------------------------------------

-- are_friends(a, b) : guard anti-graph-probing + short-circuit null.
-- Le caller doit être l'un des 2 endpoints (ou admin). Empêche un attaquant
-- de probe la friendship graph entière via appels en boucle sur des UUID
-- d'autres utilisateurs.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if a is null or b is null or a = b then return false; end if;
  if auth.uid() not in (a, b) and not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return exists(
    select 1 from public.friendships
    where status = 'accepted'
      and user_a = least(a, b)
      and user_b = greatest(a, b)
  );
end$$;
revoke all on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- are_friends_safe(a, b) : variant SANS guard auth.uid(), réservé service_role.
-- Utilisé par l'Edge Function send-notification pour re-vérifier l'amitié
-- à delivery time du kind 'friend_arriving' (anti-leak si amitié supprimée
-- entre l'enqueue du trigger et l'envoi du mail/push).
create or replace function public.are_friends_safe(a uuid, b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select case
    when a is null or b is null or a = b then false
    else exists(
      select 1 from public.friendships
      where status = 'accepted'
        and user_a = least(a, b)
        and user_b = greatest(a, b)
    )
  end;
$$;
revoke all on function public.are_friends_safe(uuid, uuid) from public, anon, authenticated;
grant execute on function public.are_friends_safe(uuid, uuid) to service_role;

-- reject_visibility_update : trigger BEFORE UPDATE qui interdit toute
-- modification de piano_sessions.visibility après l'INSERT (set-once).
-- Empêche un race avec le trigger queue_friend_arriving_notification :
-- sans ça, un user pourrait créer en public puis flip en friends après
-- les notifs envoyées (ou inversement).
create or replace function public.reject_visibility_update()
returns trigger
language plpgsql
as $$
begin
  if new.visibility is distinct from old.visibility then
    raise exception 'visibility is set-once' using errcode = '42501';
  end if;
  return new;
end$$;

-- 14.c ALTER piano_sessions : visibility + index + trigger immutable + RLS
-- ---------------------------------------------------------------------

alter table public.piano_sessions
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public','friends'));

create index if not exists piano_sessions_visibility_idx
  on public.piano_sessions(piano_id, visibility, starts_at)
  where cancelled_at is null;

drop trigger if exists piano_sessions_visibility_immutable on public.piano_sessions;
create trigger piano_sessions_visibility_immutable
  before update on public.piano_sessions
  for each row execute function public.reject_visibility_update();

-- RLS SELECT visibility-aware. La policy USING couvre :
--   - sessions publiques (toutes accessibles, y compris anon)
--   - sessions du caller (self, toujours visibles)
--   - admin/superadmin
--   - sessions d'un ami (friends-only).
-- NB: le compteur de présence (RPC get_active_piano_counts) bypass cette RLS
-- via SECURITY DEFINER mais applique le MÊME filtre, donc pas de delta
-- cardinalité exploitable pour deviner les friends-only invisibles.
drop policy if exists piano_sessions_select on public.piano_sessions;
create policy piano_sessions_select on public.piano_sessions
  for select using (
    visibility = 'public'
    or auth.uid() = user_id
    or public.is_admin()
    or (auth.uid() is not null and public.are_friends(auth.uid(), user_id))
  );

-- 14.d ALTER TYPE notification_kind + 3 colonnes prefs
-- ---------------------------------------------------------------------

alter type notification_kind add value if not exists 'friend_arriving';
alter type notification_kind add value if not exists 'friend_request_received';
alter type notification_kind add value if not exists 'friend_request_accepted';

alter table public.notification_preferences
  add column if not exists notify_friend_arriving         boolean not null default true,
  add column if not exists notify_friend_request_received boolean not null default true,
  add column if not exists notify_friend_request_accepted boolean not null default true;

-- 14.e Trigger rate limit friendships (BEFORE INSERT)
-- ---------------------------------------------------------------------
-- enforce_rate_limit() résoud déjà v_uid via requester_id pour friendships
-- (cf. coalesce dans la fonction, modifié plus haut).

drop trigger if exists friendships_rate_limit on public.friendships;
create trigger friendships_rate_limit
  before insert on public.friendships
  for each row execute function public.enforce_rate_limit('friend_request', '20', '24 hours');

-- 14.f Trigger AFTER INSERT piano_sessions : queue friend_arriving notifs
-- ---------------------------------------------------------------------
-- Notifie les amis (notify_friend_arriving=true) UNIQUEMENT. Skip si :
--   - cancelled marker présent
--   - starts_at < now()-5min (anti-backfill : sessions retroactives)
--   - ami banni OU sender banni
--   - dedup hourly (friend_arriving_dedup)
-- Snapshot pseudo + piano_address dans payload pour rester cohérent même si
-- le compte du sender est supprimé entre enqueue et delivery.
create or replace function public.queue_friend_arriving_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_pseudo  text;
  v_piano_address  text;
begin
  if NEW.cancelled_at is not null then return NEW; end if;
  if NEW.starts_at < now() - interval '5 minutes' then return NEW; end if;

  select pseudo into v_sender_pseudo from public.profiles where id = NEW.user_id;
  select address into v_piano_address from public.pianos where id = NEW.piano_id;
  if v_sender_pseudo is null or v_piano_address is null then return NEW; end if;
  if exists(
    select 1 from public.profiles where id = NEW.user_id and banned_at is not null
  ) then return NEW; end if;

  with eligibles as (
    select fs.friend_id as recipient_id
    from public.friendships_symmetric fs
    join public.profiles recipient on recipient.id = fs.friend_id
    join public.notification_preferences np on np.user_id = fs.friend_id
    left join public.friend_arriving_dedup d
      on d.recipient_id = fs.friend_id
     and d.sender_id   = NEW.user_id
     and d.piano_id    = NEW.piano_id
     and d.last_queued_at > now() - interval '1 hour'
    where fs.user_id = NEW.user_id
      and fs.status = 'accepted'
      and recipient.banned_at is null
      and np.notify_friend_arriving = true
      and d.recipient_id is null
  ),
  inserted as (
    insert into public.notifications_outbox(recipient_id, kind, payload)
    select
      e.recipient_id,
      'friend_arriving'::notification_kind,
      jsonb_build_object(
        'piano_id',       NEW.piano_id,
        'piano_address',  v_piano_address,
        'session_id',     NEW.id,
        'starts_at',      NEW.starts_at,
        'duration_min',   NEW.duration_min,
        'sender_user_id', NEW.user_id,
        'sender_pseudo',  v_sender_pseudo,
        'visibility',     NEW.visibility
      )
    from eligibles e
    returning recipient_id
  )
  insert into public.friend_arriving_dedup(recipient_id, sender_id, piano_id, last_queued_at)
  select i.recipient_id, NEW.user_id, NEW.piano_id, now()
  from inserted i
  on conflict (recipient_id, sender_id, piano_id)
    do update set last_queued_at = excluded.last_queued_at;

  return NEW;
end$$;

drop trigger if exists piano_sessions_queue_friend_arriving on public.piano_sessions;
create trigger piano_sessions_queue_friend_arriving
  after insert on public.piano_sessions
  for each row execute function public.queue_friend_arriving_notification();

revoke all on function public.queue_friend_arriving_notification() from public, anon, authenticated;

-- 14.g RPCs SECURITY DEFINER
-- ---------------------------------------------------------------------

-- 14.g.1 send_friend_request : envoie demande, gère auto-accept croisé,
-- respecte cooldown anti-stalking, rate limit via trigger.
create or replace function public.send_friend_request(target uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_low       uuid;
  v_high      uuid;
  v_existing  public.friendships;
  v_new_id    uuid;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if target is null or target = v_uid then raise exception 'forbidden' using errcode = '42501'; end if;
  if public.is_banned(v_uid) or public.is_banned(target) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_low  := least(v_uid, target);
  v_high := greatest(v_uid, target);

  -- Cooldown anti-stalking : si target avait reject < 30 jours, raise silencieux.
  if exists(
    select 1 from public.friendship_rejections
    where requester_id = v_uid and target_id = target
      and rejected_at > now() - interval '30 days'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Sérialise la paire (anti-race cross-request).
  perform pg_advisory_xact_lock(hashtext(v_low::text || ':' || v_high::text));

  select * into v_existing from public.friendships
   where user_a = v_low and user_b = v_high
   for update;

  if found then
    if v_existing.status = 'accepted' then
      return v_existing.id;
    end if;
    if v_existing.requester_id = v_uid then
      return v_existing.id;
    end if;
    -- Cas auto-accept croisé : l'autre nous a demandé en même temps.
    update public.friendships
       set status = 'accepted', responded_at = now()
     where id = v_existing.id;
    insert into public.notifications_outbox(recipient_id, kind, payload)
    select uid, 'friend_request_accepted'::notification_kind,
           jsonb_build_object(
             'friendship_id', v_existing.id,
             'other_user_id', case when uid = v_uid then target else v_uid end,
             'other_pseudo',  (select pseudo from public.profiles where id = case when uid = v_uid then target else v_uid end),
             'auto_accepted', true
           )
    from unnest(array[v_uid, target]) as uid
    where exists(
      select 1 from public.notification_preferences np
      where np.user_id = uid and np.notify_friend_request_accepted = true
    );
    return v_existing.id;
  end if;

  insert into public.friendships(user_a, user_b, requester_id, status)
  values (v_low, v_high, v_uid, 'pending')
  returning id into v_new_id;

  insert into public.notifications_outbox(recipient_id, kind, payload)
  select target, 'friend_request_received'::notification_kind,
         jsonb_build_object(
           'friendship_id',    v_new_id,
           'requester_id',     v_uid,
           'requester_pseudo', (select pseudo from public.profiles where id = v_uid)
         )
  where exists(
    select 1 from public.notification_preferences np
    where np.user_id = target and np.notify_friend_request_received = true
  );

  return v_new_id;
end$$;

revoke all on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;

-- 14.g.2 accept_friend_request : idempotent + advisory lock
create or replace function public.accept_friend_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.friendships;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if public.is_banned(v_uid) then raise exception 'forbidden' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtext('fr:' || request_id::text));

  select * into v_row from public.friendships
   where id = request_id
   for update;

  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_uid not in (v_row.user_a, v_row.user_b) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_uid = v_row.requester_id then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_row.status = 'accepted' then return; end if;

  if public.is_banned(v_row.requester_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.friendships
     set status = 'accepted', responded_at = now()
   where id = request_id;

  insert into public.notifications_outbox(recipient_id, kind, payload)
  select v_row.requester_id, 'friend_request_accepted'::notification_kind,
         jsonb_build_object(
           'friendship_id', v_row.id,
           'other_user_id', v_uid,
           'other_pseudo',  (select pseudo from public.profiles where id = v_uid),
           'auto_accepted', false
         )
  where exists(
    select 1 from public.notification_preferences np
    where np.user_id = v_row.requester_id and np.notify_friend_request_accepted = true
  );
end$$;

revoke all on function public.accept_friend_request(uuid) from public, anon;
grant execute on function public.accept_friend_request(uuid) to authenticated;

-- 14.g.3 reject_friend_request : DELETE + cooldown insertion (ghost reject)
create or replace function public.reject_friend_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.friendships;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtext('fr:' || request_id::text));

  select * into v_row from public.friendships
   where id = request_id and status = 'pending'
   for update;

  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_uid not in (v_row.user_a, v_row.user_b) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_uid = v_row.requester_id then raise exception 'forbidden' using errcode = '42501'; end if;

  delete from public.friendships where id = request_id;

  insert into public.friendship_rejections(requester_id, target_id, rejected_at)
  values (v_row.requester_id, v_uid, now())
  on conflict (requester_id, target_id) do update set rejected_at = excluded.rejected_at;
end$$;

revoke all on function public.reject_friend_request(uuid) from public, anon;
grant execute on function public.reject_friend_request(uuid) to authenticated;

-- 14.g.4 cancel_friend_request : par l'initiateur uniquement
create or replace function public.cancel_friend_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.friendships;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtext('fr:' || request_id::text));

  select * into v_row from public.friendships
   where id = request_id and status = 'pending'
   for update;

  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_uid <> v_row.requester_id then raise exception 'forbidden' using errcode = '42501'; end if;

  delete from public.friendships where id = request_id;
end$$;

revoke all on function public.cancel_friend_request(uuid) from public, anon;
grant execute on function public.cancel_friend_request(uuid) to authenticated;

-- 14.g.5 remove_friendship : DELETE row canonique + audit_log
create or replace function public.remove_friendship(other_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_low           uuid;
  v_high          uuid;
  v_friendship_id uuid;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if other_user is null or other_user = v_uid then raise exception 'forbidden' using errcode = '42501'; end if;

  v_low  := least(v_uid, other_user);
  v_high := greatest(v_uid, other_user);

  perform pg_advisory_xact_lock(hashtext(v_low::text || ':' || v_high::text));

  delete from public.friendships
   where user_a = v_low and user_b = v_high and status = 'accepted'
   returning id into v_friendship_id;

  if v_friendship_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform public.write_audit_log('remove_friendship', other_user,
    jsonb_build_object('friendship_id', v_friendship_id));
end$$;

revoke all on function public.remove_friendship(uuid) from public, anon;
grant execute on function public.remove_friendship(uuid) to authenticated;

-- 14.g.6 get_my_friends : liste paginée des amis acceptés
create or replace function public.get_my_friends()
returns table(
  id uuid,
  pseudo text,
  created_at timestamptz,
  friendship_since timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.pseudo, p.created_at, fs.responded_at as friendship_since
  from public.friendships_symmetric fs
  join public.profiles p on p.id = fs.friend_id
  where fs.user_id = auth.uid()
    and fs.status = 'accepted'
    and p.banned_at is null
  order by fs.responded_at desc nulls last
  limit 500;
$$;

revoke all on function public.get_my_friends() from public, anon;
grant execute on function public.get_my_friends() to authenticated;

-- 14.g.7 get_my_friend_requests : direction received|sent
create or replace function public.get_my_friend_requests(direction text default 'received')
returns table(
  request_id uuid,
  user_id uuid,
  pseudo text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select fs.id as request_id, fs.friend_id as user_id, p.pseudo, fs.created_at
  from public.friendships_symmetric fs
  join public.profiles p on p.id = fs.friend_id
  where fs.user_id = auth.uid()
    and fs.status = 'pending'
    and direction in ('received','sent')
    and (
      (direction = 'received' and fs.requester_id <> auth.uid())
      or
      (direction = 'sent' and fs.requester_id = auth.uid())
    )
    and p.banned_at is null
  order by fs.created_at desc
  limit 200;
$$;

revoke all on function public.get_my_friend_requests(text) from public, anon;
grant execute on function public.get_my_friend_requests(text) to authenticated;

-- 14.g.8 get_friend_status : statut bilatéral avec un target
create or replace function public.get_friend_status(target uuid)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.friendships;
begin
  if v_uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if target is null then return 'none'; end if;
  if target = v_uid then return 'self'; end if;

  select * into v_row from public.friendships
   where user_a = least(v_uid, target) and user_b = greatest(v_uid, target);
  if not found then return 'none'; end if;
  if v_row.status = 'accepted' then return 'friends'; end if;
  if v_row.requester_id = v_uid then return 'pending_sent'; end if;
  return 'pending_received';
end$$;

revoke all on function public.get_friend_status(uuid) from public, anon;
grant execute on function public.get_friend_status(uuid) to authenticated;

-- 14.g.9 get_active_piano_counts : batch RPC pour PianoMap.
-- Retourne le nombre de sessions ACTIVES (live maintenant) VISIBLES au caller.
-- SECURITY DEFINER pour bypass RLS, mais applique le MÊME filtre visibility
-- que list_piano_presence → pas de delta cardinalité exploitable.
create or replace function public.get_active_piano_counts(piano_ids uuid[])
returns table(piano_id uuid, count int)
language sql
security definer
stable
set search_path = public
as $$
  select ps.piano_id, count(*)::int
  from public.piano_sessions ps
  where ps.piano_id = any(piano_ids)
    and ps.cancelled_at is null
    and now() between ps.starts_at and ps.starts_at + (ps.duration_min || ' minutes')::interval
    and (
      ps.visibility = 'public'
      or ps.user_id = auth.uid()
      or public.is_admin()
      or (auth.uid() is not null and exists(
        select 1 from public.friendships f
        where f.status = 'accepted'
          and f.user_a = least(auth.uid(), ps.user_id)
          and f.user_b = greatest(auth.uid(), ps.user_id)
      ))
    )
  group by ps.piano_id;
$$;

revoke all on function public.get_active_piano_counts(uuid[]) from public;
grant execute on function public.get_active_piano_counts(uuid[]) to anon, authenticated;

-- 14.g.10 list_piano_presence : sessions actives+upcoming visibles sur 1 piano
create or replace function public.list_piano_presence(p_piano uuid)
returns table(
  session_id uuid,
  user_id uuid,
  pseudo text,
  starts_at timestamptz,
  duration_min int,
  visibility text
)
language sql
security definer
stable
set search_path = public
as $$
  select ps.id, ps.user_id, p.pseudo, ps.starts_at, ps.duration_min, ps.visibility
  from public.piano_sessions ps
  join public.profiles p on p.id = ps.user_id
  where ps.piano_id = p_piano
    and ps.cancelled_at is null
    and ps.starts_at + (ps.duration_min || ' minutes')::interval > now()
    and p.banned_at is null
    and (
      ps.visibility = 'public'
      or ps.user_id = auth.uid()
      or public.is_admin()
      or (auth.uid() is not null and exists(
        select 1 from public.friendships f
        where f.status = 'accepted'
          and f.user_a = least(auth.uid(), ps.user_id)
          and f.user_b = greatest(auth.uid(), ps.user_id)
      ))
    )
  order by ps.starts_at asc
  limit 50;
$$;

revoke all on function public.list_piano_presence(uuid) from public;
grant execute on function public.list_piano_presence(uuid) to anon, authenticated;

-- ============================
-- 15. v7 — Recherche unifiée (users + pianos) + Pianos favoris + 5e icône NavBar
-- ============================
--
-- ATTENTION exécution Supabase SQL Editor : aucune contrainte (CREATE EXTENSION,
-- ALTER TYPE, ALTER TABLE sont en mode auto-commit). Si on rejoue ce fichier
-- via `psql -1`, il faudra extraire la ligne `alter type notification_kind
-- add value 'piano_favorite_update'` et la commit séparément (restriction PG).
--
-- Privacy-first :
--  - first_name / last_name sont OPT-IN (default NULL, user les fournit dans
--    Settings). Column-level grants EXCLUS pour anon+authenticated → invisibles
--    via PostgREST direct. Accès uniquement via RPCs SECURITY DEFINER.
--  - find_user_by_email : exact-match strict + rate-limit dur 5/24h
--    (anti account-enumeration). Pas d'audit log (ne pas créer un registre).
--  - piano_favorites : self-only RLS classique.

-- 15.a Extensions full-text (idempotent)
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- 15.b Profiles : 2 colonnes opt-in (RGPD : default NULL, user-supplied)
alter table public.profiles
  add column if not exists first_name text
    check (first_name is null or char_length(trim(first_name)) between 1 and 50),
  add column if not exists last_name  text
    check (last_name  is null or char_length(trim(last_name))  between 1 and 50);

-- IMPORTANT : ne PAS étendre les column-grants sur first_name / last_name.
-- Le grant ligne 1016 reste `grant select (id, pseudo, created_at)` → ces 2
-- nouvelles colonnes sont invisibles via PostgREST direct (`?select=*` erreur 403).
-- Lecture autorisée uniquement via RPCs `search_users`, `find_user_by_email`,
-- `get_my_profile` (toutes SECURITY DEFINER).

-- 15.c Indexes trigram pour recherche fuzzy + accent-insensitive
-- unaccent() est IMMUTABLE seulement avec l'extension installée ; on l'utilise
-- via la fonction `public.unaccent_immutable` pour permettre index expression.
create or replace function public.unaccent_immutable(text)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions
as $$ select public.unaccent('public.unaccent', $1) $$;

create index if not exists profiles_pseudo_trgm_idx
  on public.profiles using gin (lower(public.unaccent_immutable(pseudo)) gin_trgm_ops);
create index if not exists profiles_first_name_trgm_idx
  on public.profiles using gin (lower(public.unaccent_immutable(first_name)) gin_trgm_ops)
  where first_name is not null;
create index if not exists profiles_last_name_trgm_idx
  on public.profiles using gin (lower(public.unaccent_immutable(last_name)) gin_trgm_ops)
  where last_name is not null;
create index if not exists pianos_address_trgm_idx
  on public.pianos using gin (lower(public.unaccent_immutable(address)) gin_trgm_ops)
  where is_deleted = false;
create index if not exists pianos_comment_trgm_idx
  on public.pianos using gin (lower(public.unaccent_immutable(comment)) gin_trgm_ops)
  where is_deleted = false;

-- 15.d Table piano_favorites : toggle user × piano + lookup rapide par user
create table if not exists public.piano_favorites (
  piano_id   uuid not null references public.pianos(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (piano_id, user_id)
);
create index if not exists piano_favorites_user_idx
  on public.piano_favorites(user_id, created_at desc);
create index if not exists piano_favorites_piano_idx
  on public.piano_favorites(piano_id);

alter table public.piano_favorites enable row level security;

drop policy if exists piano_favorites_select_self on public.piano_favorites;
create policy piano_favorites_select_self on public.piano_favorites
  for select using (auth.uid() = user_id);

drop policy if exists piano_favorites_insert_self on public.piano_favorites;
create policy piano_favorites_insert_self on public.piano_favorites
  for insert with check (auth.uid() = user_id and not public.is_banned(auth.uid()));

drop policy if exists piano_favorites_delete_self on public.piano_favorites;
create policy piano_favorites_delete_self on public.piano_favorites
  for delete using (auth.uid() = user_id);

-- 15.e Notif kind + préférence (`alter type` doit être commit avant utilisation
-- downstream — ok en Supabase SQL Editor, à isoler si psql -1)
alter type notification_kind add value if not exists 'piano_favorite_update';
alter table public.notification_preferences
  add column if not exists notify_favorite_update boolean not null default true;

-- 15.f Trigger : MAJ piano → queue notifs aux favoriters (excluant l'updater
-- + filtrant banned + filtrant pref désactivée)
-- Snapshot `piano_address` + `updater_pseudo` dans le payload pour survivre
-- aux suppressions de compte (cohérent avec pattern v6 friend_arriving).
create or replace function public.queue_favorite_update_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications_outbox (recipient_id, kind, payload)
  select
    pf.user_id,
    'piano_favorite_update',
    jsonb_build_object(
      'piano_id', new.piano_id,
      'piano_address', (select address from public.pianos where id = new.piano_id),
      'update_id', new.id,
      'updater_user_id', new.updated_by,
      'updater_pseudo', upd.pseudo,
      -- piano_updates n'a pas de colonne `quality` ; la colonne est `new_quality`
      -- (cf. CREATE TABLE section 2). Bug détecté par pgTAP test 04 — pre-Sprint 9
      -- silencieux car aucun INSERT user n'avait jamais touché ce path.
      'quality', new.new_quality,
      'still_there', new.still_there
    )
  from public.piano_favorites pf
  join public.profiles recipient on recipient.id = pf.user_id
  join public.notification_preferences np on np.user_id = pf.user_id
  left join public.profiles upd on upd.id = new.updated_by
  where pf.piano_id = new.piano_id
    and pf.user_id <> coalesce(new.updated_by, '00000000-0000-0000-0000-000000000000'::uuid)
    and recipient.banned_at is null
    and np.notify_favorite_update = true;
  return new;
end$$;

revoke all on function public.queue_favorite_update_notification() from public;

drop trigger if exists piano_updates_queue_favorite_notif on public.piano_updates;
create trigger piano_updates_queue_favorite_notif
  after insert on public.piano_updates
  for each row execute function public.queue_favorite_update_notification();

-- 15.g Helper rate-limit pour RPC bodies (équivalent enforce_rate_limit mais
-- appelable hors trigger). Utilisé par find_user_by_email pour bloquer
-- l'énumération email-based. Reproduit la logique exacte : advisory lock par
-- (uid, action) + UPSERT atomique dans rate_limit_buckets + raise si dépassé.
create or replace function public.enforce_caller_rate_limit(
  p_action text,
  p_max    int,
  p_window interval
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_bucket timestamptz;
  v_total  int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_uid::text || ':' || p_action));

  v_bucket := date_trunc('minute', now());

  insert into public.rate_limit_buckets(user_id, action, window_start, count)
  values (v_uid, p_action, v_bucket, 1)
  on conflict (user_id, action, window_start)
  do update set count = public.rate_limit_buckets.count + 1;

  select coalesce(sum(count), 0) into v_total
  from public.rate_limit_buckets
  where user_id = v_uid
    and action = p_action
    and window_start >= now() - p_window;

  if v_total > p_max then
    raise exception 'rate_limit_exceeded'
      using errcode = 'P0001', hint = p_action;
  end if;
end$$;

revoke all on function public.enforce_caller_rate_limit(text, int, interval) from public;
grant execute on function public.enforce_caller_rate_limit(text, int, interval) to authenticated;

-- 15.h RPCs SECURITY DEFINER

-- 15.h.1 search_users : recherche unifiée pseudo + first_name + last_name
-- via pg_trgm similarity (accent-insensitive). Filtre banned. LIMIT 20.
-- Pas de rate-limit (search par texte = usage légitime, pseudo public par design).
create or replace function public.search_users(q text)
returns table(
  id uuid,
  pseudo text,
  first_name text,
  last_name text,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_q text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  v_q := trim(coalesce(q, ''));
  if char_length(v_q) < 2 or char_length(v_q) > 50 then
    return; -- empty result
  end if;
  v_q := lower(public.unaccent_immutable(v_q));

  return query
    with scored as (
      select
        p.id, p.pseudo, p.first_name, p.last_name, p.created_at,
        greatest(
          similarity(lower(public.unaccent_immutable(p.pseudo)), v_q),
          coalesce(similarity(lower(public.unaccent_immutable(p.first_name)), v_q), 0),
          coalesce(similarity(lower(public.unaccent_immutable(p.last_name)), v_q), 0)
        ) as score
      from public.profiles p
      where p.banned_at is null
        and (
          lower(public.unaccent_immutable(p.pseudo)) like '%' || v_q || '%'
          or (p.first_name is not null and lower(public.unaccent_immutable(p.first_name)) like '%' || v_q || '%')
          or (p.last_name  is not null and lower(public.unaccent_immutable(p.last_name))  like '%' || v_q || '%')
        )
    )
    select s.id, s.pseudo, s.first_name, s.last_name, s.created_at
    from scored s
    where s.score > 0.1
    order by s.score desc, s.pseudo asc
    limit 20;
end$$;

revoke all on function public.search_users(text) from public;
grant execute on function public.search_users(text) to authenticated;

-- 15.h.2 find_user_by_email : exact-match strict + rate-limit 5/24h.
-- Réponse minimale : retourne profile fields, jamais l'email (le caller le
-- connaît déjà). 0 row si non trouvé ou banned (pas de leak d'existence).
create or replace function public.find_user_by_email(p_email text)
returns table(
  id uuid,
  pseudo text,
  first_name text,
  last_name text,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public, auth
as $$
declare
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  v_email := lower(trim(coalesce(p_email, '')));
  if char_length(v_email) < 3 or char_length(v_email) > 254 or position('@' in v_email) = 0 then
    return;
  end if;

  -- Rate-limit AVANT la query pour bloquer même les tentatives malformées.
  perform public.enforce_caller_rate_limit('user_search_email', 5, '24 hours'::interval);

  return query
    select p.id, p.pseudo, p.first_name, p.last_name, p.created_at
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(u.email) = v_email
      and p.banned_at is null
    limit 1;
end$$;

revoke all on function public.find_user_by_email(text) from public;
grant execute on function public.find_user_by_email(text) to authenticated;

-- 15.h.3 search_pianos : full-text fuzzy sur address + comment.
-- Auth required (anti-scraping), filtre is_deleted = false. LIMIT 30.
create or replace function public.search_pianos(q text)
returns table(
  id uuid,
  address text,
  comment text,
  quality piano_quality,
  photo_url text,
  lat double precision,
  lng double precision,
  created_by uuid,
  author_pseudo text,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_q text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  v_q := trim(coalesce(q, ''));
  if char_length(v_q) < 2 or char_length(v_q) > 100 then
    return;
  end if;
  v_q := lower(public.unaccent_immutable(v_q));

  return query
    with scored as (
      select
        pn.id, pn.address, pn.comment, pn.quality, pn.photo_url,
        pn.lat, pn.lng, pn.created_by, prof.pseudo as author_pseudo, pn.created_at,
        greatest(
          similarity(lower(public.unaccent_immutable(pn.address)), v_q),
          similarity(lower(public.unaccent_immutable(pn.comment)), v_q)
        ) as score
      from public.pianos pn
      left join public.profiles prof on prof.id = pn.created_by
      where pn.is_deleted = false
        -- v7+ : exclut les pianos dont l'auteur est banni (mais garde ceux dont
        -- l'auteur a supprimé son compte = left join null → autorisé).
        and (prof.id is null or prof.banned_at is null)
        and (
          lower(public.unaccent_immutable(pn.address)) like '%' || v_q || '%'
          or lower(public.unaccent_immutable(pn.comment)) like '%' || v_q || '%'
        )
    )
    select s.id, s.address, s.comment, s.quality, s.photo_url,
           s.lat, s.lng, s.created_by, s.author_pseudo, s.created_at
    from scored s
    where s.score > 0.1
    order by s.score desc, s.created_at desc
    limit 30;
end$$;

revoke all on function public.search_pianos(text) from public;
grant execute on function public.search_pianos(text) to authenticated;

-- 15.h.4 update_my_profile_names : self-update opt-in. NULL ou string vide = clear.
create or replace function public.update_my_profile_names(
  p_first text,
  p_last  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first text;
  v_last  text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  v_first := nullif(trim(coalesce(p_first, '')), '');
  v_last  := nullif(trim(coalesce(p_last,  '')), '');
  if v_first is not null and char_length(v_first) > 50 then
    raise exception 'first_name too long';
  end if;
  if v_last is not null and char_length(v_last) > 50 then
    raise exception 'last_name too long';
  end if;
  update public.profiles
  set first_name = v_first,
      last_name  = v_last
  where id = auth.uid();
end$$;

revoke all on function public.update_my_profile_names(text, text) from public;
grant execute on function public.update_my_profile_names(text, text) to authenticated;

-- 15.h.5 toggle_piano_favorite : idempotent, advisory_xact_lock anti double-click.
-- Returns true si maintenant favori, false si retiré.
create or replace function public.toggle_piano_favorite(p_piano uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_exists  boolean;
  v_piano_ok boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if public.is_banned(v_uid) then
    raise exception 'banned';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_uid::text || ':fav:' || p_piano::text));

  select exists(
    select 1 from public.pianos where id = p_piano and is_deleted = false
  ) into v_piano_ok;
  if not v_piano_ok then
    raise exception 'piano_not_found';
  end if;

  select exists(
    select 1 from public.piano_favorites
    where piano_id = p_piano and user_id = v_uid
  ) into v_exists;

  if v_exists then
    delete from public.piano_favorites
    where piano_id = p_piano and user_id = v_uid;
    return false;
  else
    insert into public.piano_favorites(piano_id, user_id)
    values (p_piano, v_uid);
    return true;
  end if;
end$$;

revoke all on function public.toggle_piano_favorite(uuid) from public;
grant execute on function public.toggle_piano_favorite(uuid) to authenticated;

-- 15.h.6 get_my_favorites : liste enrichie pour Dashboard Favoris tab.
create or replace function public.get_my_favorites()
returns table(
  piano_id uuid,
  address text,
  quality piano_quality,
  photo_url text,
  lat double precision,
  lng double precision,
  favorited_at timestamptz,
  last_update_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    pf.piano_id,
    p.address,
    p.quality,
    p.photo_url,
    p.lat,
    p.lng,
    pf.created_at as favorited_at,
    -- piano_updates n'a pas de colonne `updated_at` ; le timestamp natif est
    -- `created_at` (chaque update = nouvelle row immuable). Le bug était présent
    -- depuis v7 PR-A (silencieux côté frontend qui ignorait le NULL retourné).
    (select max(pu.created_at) from public.piano_updates pu where pu.piano_id = pf.piano_id) as last_update_at
  from public.piano_favorites pf
  join public.pianos p on p.id = pf.piano_id
  where pf.user_id = auth.uid()
    and p.is_deleted = false
  order by pf.created_at desc
  limit 200;
$$;

revoke all on function public.get_my_favorites() from public;
grant execute on function public.get_my_favorites() to authenticated;

-- 15.i export_my_data : étendu pour piano_favorites + friendships (RGPD complet)
-- Note : profile.first_name / last_name sont DÉJÀ inclus via to_jsonb(p) — pas de change ici.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select email into v_email from auth.users where id = v_uid;

  v_result := jsonb_build_object(
    'exported_at', now(),
    'user', jsonb_build_object('id', v_uid, 'email', v_email),
    'profile', (
      select to_jsonb(p) from public.profiles p where p.id = v_uid
    ),
    'pianos', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.pianos t where t.created_by = v_uid
    ), '[]'::jsonb),
    'piano_updates', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.piano_updates t where t.updated_by = v_uid
    ), '[]'::jsonb),
    'piano_reports', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.piano_reports t where t.reported_by = v_uid
    ), '[]'::jsonb),
    'piano_visits', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.piano_visits t where t.user_id = v_uid
    ), '[]'::jsonb),
    'piano_sessions', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.piano_sessions t where t.user_id = v_uid
    ), '[]'::jsonb),
    'piano_favorites', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.piano_favorites t where t.user_id = v_uid
    ), '[]'::jsonb),
    'friendships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'other_user_id', case when f.user_a = v_uid then f.user_b else f.user_a end,
        'requester_id', f.requester_id,
        'status', f.status,
        'created_at', f.created_at,
        'responded_at', f.responded_at
      )) from public.friendships f where v_uid in (f.user_a, f.user_b)
    ), '[]'::jsonb),
    'event_participants', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.event_participants t where t.user_id = v_uid
    ), '[]'::jsonb),
    'user_requests', coalesce((
      select jsonb_agg(to_jsonb(t)) from public.user_requests t where t.user_id = v_uid
    ), '[]'::jsonb),
    'notification_preferences', (
      select to_jsonb(t) from public.notification_preferences t where t.user_id = v_uid
    ),
    'push_subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'endpoint', endpoint,
        'user_agent', user_agent,
        'created_at', created_at,
        'last_used_at', last_used_at
      )) from public.push_subscriptions t where t.user_id = v_uid
    ), '[]'::jsonb)
  );
  return v_result;
end$$;

revoke all on function public.export_my_data() from public;
grant execute on function public.export_my_data() to authenticated;

-- ============================
-- 16. Sprint 7 sécu — Rate-limit signup par IP (backlog A.6.4)
-- ============================
-- Anti création de masse de comptes jetables depuis un botnet ou un script.
-- Côté serveur uniquement : l'Edge Function `signup-protected` hash l'IP du
-- caller (SHA-256 + salt env) et appelle la RPC ci-dessous AVANT de laisser
-- le frontend faire `auth.signUp`.
--
-- Choix de design :
--  - Table `signup_ip_attempts` invisible PostgREST (REVOKE ALL + RLS sans
--    policy). Accessible uniquement via la RPC SECURITY DEFINER.
--  - Hash IP (pas IP en clair) : RGPD-friendly, on garde la capacité de
--    contre-mesurer un attaquant sans connaître son IP réelle.
--  - Advisory lock dans la RPC : atomic count + insert, anti-race batch.
--  - Limite : 5 tentatives par IP par 24h. Raisonnable pour quelqu'un qui
--    se trompe d'email + tolère café public derrière NAT.
--  - Purge hebdomadaire via pg_cron (cf. instructions section 13).

create table if not exists public.signup_ip_attempts (
  ip_hash      text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists signup_ip_attempts_hash_time_idx
  on public.signup_ip_attempts(ip_hash, attempted_at desc);

alter table public.signup_ip_attempts enable row level security;
-- Aucune policy : nul ne peut lire/écrire directement. La RPC ci-dessous
-- (SECURITY DEFINER) gère tout côté serveur, appelée uniquement par
-- l'Edge Function signup-protected via service_role.
revoke all on public.signup_ip_attempts from anon, authenticated;

create or replace function public.check_signup_ip_allowed(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_window interval := interval '24 hours';
  v_max int := 5;
begin
  if p_ip_hash is null or length(p_ip_hash) = 0 then
    raise exception 'invalid_ip_hash' using errcode = 'P0001';
  end if;

  -- Sérialise les checks par IP sur la durée de la transaction (anti-race
  -- batch : 2 requêtes simultanées du même IP voient tous les deux count
  -- = max-1 sans le lock).
  perform pg_advisory_xact_lock(hashtext('signup_ip:' || p_ip_hash));

  select count(*) into v_count
  from public.signup_ip_attempts
  where ip_hash = p_ip_hash
    and attempted_at >= now() - v_window;

  if v_count >= v_max then
    return false;
  end if;

  insert into public.signup_ip_attempts(ip_hash) values (p_ip_hash);
  return true;
end$$;

revoke all on function public.check_signup_ip_allowed(text) from public, anon, authenticated;
-- Accessible uniquement via service_role depuis l'Edge Function.
grant execute on function public.check_signup_ip_allowed(text) to service_role;

-- ============================
-- 17. Sprint v8 — Auth Resilience : RPC ping_health() (keep-alive externe)
-- ============================
-- Cible pour un ping externe (GitHub Actions cron */10) qui traverse
-- Cloudflare → PostgREST → PostgreSQL. Empêche le projet Supabase free tier
-- de "refroidir" (cold-start Auth/PostgREST/PgBouncer) — cause identifiée
-- des 522 Cloudflare sur /auth/v1/token le 2026-07-08.
--
-- Volontairement trivial : `select 'ok'` sans IO ni join. Le simple fait
-- de résoudre le call PostgREST + tourner la fn PL/pgSQL suffit à réchauffer
-- le pool DB et les workers. Ouverte à anon + authenticated pour que le
-- workflow GitHub Actions puisse hitter avec la clé anonyme.
create or replace function public.ping_health()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select 'ok'::text;
$$;

revoke all on function public.ping_health() from public;
grant execute on function public.ping_health() to anon, authenticated;

-- ============================
-- 12. Bootstrap superadmin (idempotent — à ré-exécuter après le 1er signup)
-- ============================
update public.profiles
set role = 'superadmin'
where id = (select id from auth.users where email = 'enzo.reine35@gmail.com')
  and role <> 'superadmin';

-- ============================
-- 13. Setup post-déploiement (instructions, non-SQL)
-- ============================
-- (1) Activer la confirmation email Supabase
--   Dashboard > Auth > Providers > Email > cocher "Confirm email"
--   Dashboard > Auth > URL Configuration > Site URL = https://pianoworld.vercel.app
--   Ajouter https://pianoworld.vercel.app/auth/login aux Redirect URLs.
--
-- (2) Webhook envoi des notifications
--   Database > Webhooks > Create webhook
--   - Name : send_notifications
--   - Table : notifications_outbox
--   - Events : INSERT
--   - Type : Supabase Edge Functions
--   - Function : send-notification
--   - HTTP Headers : x-webhook-secret = <valeur identique à WEBHOOK_SECRET côté Edge>
--
-- (3) Edge Functions > Secrets (clé/valeur)
--   - WEBHOOK_SECRET (openssl rand -base64 32)
--   - RESEND_API_KEY (resend.com/api-keys)
--   - VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (npx web-push generate-vapid-keys)
--   - VAPID_SUBJECT = mailto:enzo.reine35@gmail.com
--   - MAIL_FROM = onboarding@resend.dev (test) ou no-reply@<domain>
--   - APP_URL = https://pianoworld.vercel.app
--
-- (4) Déployer la fonction Edge
--   supabase functions deploy send-notification
--
-- (5) Retry + purge des notifications via pg_cron (v5)
--   Activer pg_cron dans Database > Extensions, puis :
--     select cron.schedule('notif-retry', '*/5 * * * *', $$
--       select net.http_post(
--         url := '<URL EDGE FUNCTION>/send-notification',
--         headers := jsonb_build_object(
--           'x-webhook-secret', '<MEME VALEUR QU AU 3>',
--           'content-type', 'application/json'
--         ),
--         body := jsonb_build_object('record', jsonb_build_object('id', id))
--       )
--       from public.list_pending_notifications(50);
--     $$);
--     select cron.schedule('notif-purge', '17 3 * * *', $$
--       select public.purge_old_notifications();
--     $$);
--
-- (6) Purges hebdomadaires des tables de dedup/cooldown (v6+).
--   Tables : friendship_rejections (cooldown 30j anti-stalking) +
--   friend_arriving_dedup (dedup horaire notifs sessions). Sans ces purges,
--   les tables grossissent indéfiniment (pas d'expiration via TTL native PG).
--     select cron.schedule('friendship-rejections-purge', '23 3 * * 0', $$
--       delete from public.friendship_rejections
--       where rejected_at < now() - interval '30 days';
--     $$);
--     select cron.schedule('friend-arriving-dedup-purge', '29 3 * * 0', $$
--       delete from public.friend_arriving_dedup
--       where last_queued_at < now() - interval '7 days';
--     $$);
--
-- (7) Sprint 7 sécu — déploiement Edge Function signup-protected (A.6.4).
--   - Generate un sel : openssl rand -base64 32
--   - Edge Functions > Secrets : ajouter SIGNUP_IP_HASH_SALT = <ce sel>
--   - supabase functions deploy signup-protected
--   - Tester en local : curl POST {ip} → JSON {allowed:bool} ou 429
--   - Purge nightly des attempts > 7 jours (rétention courte = RGPD-friendly) :
--       select cron.schedule('signup-ip-attempts-purge', '37 3 * * *', $$
--         delete from public.signup_ip_attempts
--         where attempted_at < now() - interval '7 days';
--       $$);
