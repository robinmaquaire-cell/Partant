-- ============================================================
-- Partant ? — Logos de listes, catégorie d'événement,
-- calendrier synchronisé (règles + exceptions), e-mails refusables
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0007-partage-evenement.sql)
-- ============================================================

-- ——— 1. Logo d'une liste : un emoji et/ou une image ———

alter table public.lists add column emoji text check (char_length(emoji) <= 8);
alter table public.lists add column logo_url text;

-- Espace de stockage public pour les logos des listes.
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- Seuls les admins d'une liste déposent dans le dossier logos/<id de la liste>/…
create policy "logos: lecture publique"
  on storage.objects for select using (bucket_id = 'logos');
create policy "logos: dépôt par les admins"
  on storage.objects for insert with check (
    bucket_id = 'logos'
    and public.is_list_admin(((storage.foldername(name))[1])::uuid)
  );
create policy "logos: remplacement par les admins"
  on storage.objects for update using (
    bucket_id = 'logos'
    and public.is_list_admin(((storage.foldername(name))[1])::uuid)
  );
create policy "logos: suppression par les admins"
  on storage.objects for delete using (
    bucket_id = 'logos'
    and public.is_list_admin(((storage.foldername(name))[1])::uuid)
  );

-- Mes listes, avec leur logo.
drop function if exists public.my_lists();
create or replace function public.my_lists()
returns table (
  id uuid, name text, color text, members_visible boolean,
  emoji text, logo_url text, role text, member_count bigint
) language sql security definer set search_path = public stable as $$
  select l.id, l.name, l.color, l.members_visible, l.emoji, l.logo_url, my.role,
    (select count(*) from list_members m where m.list_id = l.id)
  from lists l
  join list_members my on my.list_id = l.id and my.user_id = auth.uid()
  order by l.created_at;
$$;

-- La création de liste accepte un emoji.
drop function if exists public.create_list(text, text, boolean);
create or replace function public.create_list(
  p_name text, p_color text, p_members_visible boolean, p_emoji text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;
  if p_name is null or char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 60 then
    raise exception 'Le nom de la liste doit faire entre 1 et 60 caractères.';
  end if;
  if p_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'Couleur invalide.';
  end if;
  if char_length(coalesce(p_emoji, '')) > 8 then
    raise exception 'Logo invalide.';
  end if;

  insert into lists (name, color, members_visible, emoji)
  values (trim(p_name), p_color, p_members_visible, nullif(trim(coalesce(p_emoji, '')), ''))
  returning id into v_id;

  insert into list_members (list_id, user_id, role)
  values (v_id, v_uid, 'admin');

  insert into list_invites (token, list_id, created_by)
  values (replace(gen_random_uuid()::text, '-', ''), v_id, v_uid);

  return v_id;
end;
$$;

-- Le lien d'invitation montre aussi le logo de la liste.
drop function if exists public.get_invite(text);
create or replace function public.get_invite(p_token text)
returns table (
  list_id uuid, list_name text, list_color text, list_emoji text,
  list_logo_url text, member_count bigint, already_member boolean
) language sql security definer set search_path = public stable as $$
  select l.id, l.name, l.color, l.emoji, l.logo_url,
    (select count(*) from list_members m where m.list_id = l.id),
    exists (
      select 1 from list_members m
      where m.list_id = l.id and m.user_id = auth.uid()
    )
  from list_invites i
  join lists l on l.id = i.list_id
  where i.token = p_token and not i.revoked;
$$;

-- ——— 2. Catégorie d'événement (facultative) ———

alter table public.events add column category text check (char_length(category) <= 30);

-- ——— 3. E-mails refusables ———

alter table public.profiles
  add column email_notifications boolean not null default true;

-- WhatsApp/SMS ne sont pas en service : tout le monde repasse en e-mail,
-- avec l'adresse du compte quand le contact enregistré était un numéro.
update public.profiles p set
  contact_mode = 'email',
  contact = case
    when p.contact ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then p.contact
    else u.email
  end
from auth.users u
where u.id = p.id and p.contact_mode <> 'email';

-- ——— 4. Le calendrier synchronisé : des règles + des exceptions ———

-- Les règles de synchronisation, une ligne par personne.
create table public.calendar_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  only_yes boolean not null default false,          -- seulement « Partant ! »
  include_guest_events boolean not null default true, -- événements sur invitation
  date_from date,
  date_to date,
  categories text[]                                  -- null = toutes
);

-- Les exceptions événement par événement (elles priment sur les règles).
create table public.calendar_event_overrides (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  included boolean not null,
  primary key (user_id, event_id)
);

alter table public.calendar_prefs enable row level security;
alter table public.calendar_event_overrides enable row level security;

create policy "calendar_prefs: chacun les siennes"
  on public.calendar_prefs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "calendar_overrides: chacun les siennes"
  on public.calendar_event_overrides for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Le cœur du calendrier : pour chaque événement qui m'arrive (par une liste,
-- par un lien, ou parce que je l'organise), dit s'il part dans le calendrier
-- synchronisé. Une seule définition, utilisée par la page ET par le flux .ics.
create or replace function public.calendar_rows(p_user uuid)
returns table (
  event_id uuid,
  from_list boolean,
  from_link boolean,
  my_status text,
  rule_ok boolean,
  override_included boolean,
  synced boolean
) language sql security definer set search_path = public stable as $$
  with prefs as (
    select
      coalesce(cp.only_yes, false) as only_yes,
      coalesce(cp.include_guest_events, true) as include_guest_events,
      cp.date_from, cp.date_to, cp.categories
    from (select 1) one
    left join calendar_prefs cp on cp.user_id = p_user
  ),
  base as (
    select e.id, e.event_date, e.category,
      exists (
        select 1 from event_lists el
        join list_members m on m.list_id = el.list_id
        where el.event_id = e.id and m.user_id = p_user
      ) as in_any_list,
      exists (
        select 1 from event_lists el
        join list_members m on m.list_id = el.list_id
        where el.event_id = e.id and m.user_id = p_user and m.in_calendar
      ) as in_checked_list,
      (
        exists (select 1 from event_guests g where g.event_id = e.id and g.user_id = p_user)
        or exists (select 1 from event_organizers o where o.event_id = e.id and o.user_id = p_user)
      ) as by_link,
      (select r.status from rsvps r where r.event_id = e.id and r.user_id = p_user) as my_status,
      (select o.included from calendar_event_overrides o
        where o.event_id = e.id and o.user_id = p_user) as override_included
    from events e
  )
  select b.id, b.in_any_list, b.by_link, b.my_status, r.rule_ok, b.override_included,
    case
      when coalesce(b.my_status, '') = 'no' then false
      else coalesce(b.override_included, r.rule_ok)
    end
  from base b
  cross join prefs p
  cross join lateral (
    select (
      coalesce(b.my_status, '') <> 'no'
      and (b.in_checked_list or (b.by_link and p.include_guest_events))
      and (not p.only_yes or b.my_status = 'yes')
      and (p.date_from is null or b.event_date >= p.date_from)
      and (p.date_to is null or b.event_date <= p.date_to)
      and (
        p.categories is null or array_length(p.categories, 1) is null
        or coalesce(b.category, '') = any (p.categories)
      )
    ) as rule_ok
  ) r
  where p_user is not null and (b.in_any_list or b.by_link);
$$;

-- La même chose pour moi, depuis l'application.
create or replace function public.my_calendar_rows()
returns table (
  event_id uuid, from_list boolean, from_link boolean, my_status text,
  rule_ok boolean, override_included boolean, synced boolean
) language sql security definer set search_path = public stable as $$
  select * from calendar_rows(auth.uid());
$$;

-- Poser une exception (ou revenir à la règle avec p_included = null).
create or replace function public.set_calendar_override(
  p_event uuid, p_included boolean
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;
  if not can_see_event(p_event) then
    raise exception 'Événement introuvable.';
  end if;
  if p_included is null then
    delete from calendar_event_overrides
    where user_id = v_uid and event_id = p_event;
  else
    insert into calendar_event_overrides (user_id, event_id, included)
    values (v_uid, p_event, p_included)
    on conflict (user_id, event_id) do update set included = excluded.included;
  end if;
end;
$$;

-- ——— 5. Le flux .ics ne contient que le calendrier synchronisé ———

create or replace function public.calendar_feed(p_token text)
returns table (
  id uuid, title text, description text, event_date date, event_time time,
  location_text text, lat double precision, lng double precision,
  lists_text text, my_status text
) language sql security definer set search_path = public stable as $$
  select e.id, e.title, e.description, e.event_date, e.event_time,
    e.location_text, e.lat, e.lng,
    (select string_agg(l.name, ', ' order by l.name)
       from event_lists el join lists l on l.id = el.list_id
      where el.event_id = e.id),
    cr.my_status
  from profiles p
  cross join lateral calendar_rows(p.id) cr
  join events e on e.id = cr.event_id
  where p_token is not null
    and char_length(p_token) >= 32
    and p.calendar_token = p_token
    and cr.synced
    and e.event_date >= current_date - 60;
$$;

-- ——— 6. Créer / modifier un événement : la catégorie en plus ———

drop function if exists public.create_event(
  text, text, date, time, text, double precision, double precision,
  integer, boolean, uuid[], jsonb, jsonb, text);
drop function if exists public.update_event(
  uuid, text, text, date, time, text, double precision, double precision,
  integer, boolean, uuid[], jsonb, uuid[], jsonb, uuid[]);

create or replace function public.create_event(
  p_title text, p_description text, p_event_date date, p_event_time time,
  p_location_text text, p_lat double precision, p_lng double precision,
  p_max integer, p_collaborative boolean, p_list_ids uuid[],
  p_equipment jsonb, p_roles jsonb default '[]'::jsonb,
  p_category text default null, p_template_name text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_cat text := nullif(trim(coalesce(p_category, '')), '');
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;
  perform check_event_fields(p_title, p_event_date, p_event_time, p_location_text, p_lat, p_lng, p_max);
  if char_length(coalesce(p_description, '')) > 2000 then
    raise exception 'La description est trop longue (2000 caractères max).';
  end if;
  if char_length(coalesce(v_cat, '')) > 30 then
    raise exception 'Le nom de catégorie est trop long (30 caractères max).';
  end if;

  insert into events (
    title, description, event_date, event_time, location_text,
    lat, lng, max_participants, collaborative, category, created_by
  ) values (
    trim(p_title), coalesce(p_description, ''), p_event_date, p_event_time,
    coalesce(trim(p_location_text), ''), p_lat, p_lng, p_max,
    coalesce(p_collaborative, false), v_cat, v_uid
  ) returning id into v_id;

  insert into event_organizers (event_id, user_id) values (v_id, v_uid);
  insert into rsvps (event_id, user_id, status) values (v_id, v_uid, 'yes');

  perform set_event_lists(v_id, p_list_ids);
  perform insert_equipment(v_id, p_equipment);
  perform insert_event_roles(v_id, p_roles);

  if p_template_name is not null and char_length(trim(p_template_name)) between 1 and 60 then
    insert into templates (user_id, name, payload)
    values (v_uid, trim(p_template_name), jsonb_build_object(
      'title', trim(p_title),
      'description', coalesce(p_description, ''),
      'event_time', p_event_time::text,
      'location_text', coalesce(trim(p_location_text), ''),
      'lat', p_lat, 'lng', p_lng,
      'max_participants', p_max,
      'collaborative', coalesce(p_collaborative, false),
      'category', v_cat,
      'equipment', coalesce(p_equipment, '[]'::jsonb),
      'roles', coalesce(p_roles, '[]'::jsonb)
    ));
  end if;

  return v_id;
end;
$$;

create or replace function public.update_event(
  p_event uuid, p_title text, p_description text, p_event_date date,
  p_event_time time, p_location_text text, p_lat double precision,
  p_lng double precision, p_max integer, p_collaborative boolean,
  p_list_ids uuid[], p_equipment_new jsonb, p_equipment_removed uuid[],
  p_roles_new jsonb default '[]'::jsonb, p_roles_removed uuid[] default '{}'::uuid[],
  p_category text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_cat text := nullif(trim(coalesce(p_category, '')), '');
begin
  if not exists (
    select 1 from event_organizers where event_id = p_event and user_id = v_uid
  ) then
    raise exception 'Seuls les organisateurs peuvent modifier cet événement.';
  end if;
  perform check_event_fields(p_title, p_event_date, p_event_time, p_location_text, p_lat, p_lng, p_max);
  if char_length(coalesce(p_description, '')) > 2000 then
    raise exception 'La description est trop longue (2000 caractères max).';
  end if;
  if char_length(coalesce(v_cat, '')) > 30 then
    raise exception 'Le nom de catégorie est trop long (30 caractères max).';
  end if;

  update events set
    title = trim(p_title),
    description = coalesce(p_description, ''),
    event_date = p_event_date,
    event_time = p_event_time,
    location_text = coalesce(trim(p_location_text), ''),
    lat = p_lat, lng = p_lng,
    max_participants = p_max,
    collaborative = coalesce(p_collaborative, false),
    category = v_cat
  where id = p_event;

  perform set_event_lists(p_event, p_list_ids);

  if p_equipment_removed is not null then
    delete from equipment_items
    where event_id = p_event and id = any (p_equipment_removed);
  end if;
  perform insert_equipment(p_event, p_equipment_new);

  if p_roles_removed is not null then
    delete from event_roles
    where event_id = p_event and id = any (p_roles_removed);
  end if;
  perform insert_event_roles(p_event, p_roles_new);
end;
$$;
