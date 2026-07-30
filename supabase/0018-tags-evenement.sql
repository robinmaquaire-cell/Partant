-- ============================================================
-- Partants ? — Plusieurs tags par événement (au lieu d'une seule catégorie)
-- On remplace la « catégorie » unique par une liste de tags. L'ancienne
-- colonne category est conservée mais n'est plus utilisée (au cas où).
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0017-disponibilites.sql)
-- ============================================================

-- 1. Nouvelle colonne : les tags de l'événement.
alter table public.events
  add column if not exists tags text[] not null default '{}';

-- 2. On reprend la catégorie existante comme premier tag.
update public.events
  set tags = array[trim(category)]
  where (tags is null or cardinality(tags) = 0)
    and category is not null and trim(category) <> '';

-- ——— Le calendrier synchronisé filtre désormais sur les tags ———
-- (reprise de calendar_rows du script 0014 : e.category → e.tags,
--  et « la catégorie est dans la liste » → « un tag est dans la liste »)
create or replace function public.calendar_rows(p_user uuid)
returns table (
  event_id uuid, from_list boolean, from_link boolean, my_status text,
  rule_ok boolean, override_included boolean, synced boolean
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
    select e.id, e.event_date, e.tags,
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
        where o.event_id = e.id and o.user_id = p_user) as override_included,
      exists (
        select 1 from contact_links cl
        where cl.user_id = p_user and cl.contact_id = e.created_by and cl.blocked
      ) as blocked_creator
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
        or b.tags && p.categories
      )
    ) as rule_ok
  ) r
  where p_user is not null and (b.in_any_list or b.by_link) and not b.blocked_creator;
$$;

-- ——— Créer / modifier un événement : des tags au lieu d'une catégorie ———

drop function if exists public.create_event(
  text, text, date, time, text, double precision, double precision,
  integer, boolean, uuid[], jsonb, jsonb, text, text);
drop function if exists public.update_event(
  uuid, text, text, date, time, text, double precision, double precision,
  integer, boolean, uuid[], jsonb, uuid[], jsonb, uuid[], text);

-- Nettoie une liste de tags : espaces retirés, vides ignorés, doublons
-- fusionnés (sans tenir compte de la casse), 8 maximum, 30 caractères max.
create or replace function public.clean_tags(p_tags text[])
returns text[] language plpgsql immutable set search_path = public as $$
declare v_tags text[];
begin
  select coalesce(array_agg(t), '{}') into v_tags from (
    select distinct on (lower(trim(x))) trim(x) as t
    from unnest(coalesce(p_tags, '{}'::text[])) as x
    where trim(x) <> ''
    order by lower(trim(x))
  ) d;
  if exists (select 1 from unnest(v_tags) t where char_length(t) > 30) then
    raise exception 'Un tag est trop long (30 caractères max).';
  end if;
  if cardinality(v_tags) > 8 then
    raise exception 'Pas plus de 8 tags par événement.';
  end if;
  return v_tags;
end;
$$;

create or replace function public.create_event(
  p_title text, p_description text, p_event_date date, p_event_time time,
  p_location_text text, p_lat double precision, p_lng double precision,
  p_max integer, p_collaborative boolean, p_list_ids uuid[],
  p_equipment jsonb, p_roles jsonb default '[]'::jsonb,
  p_tags text[] default '{}'::text[], p_template_name text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_tags text[] := clean_tags(p_tags);
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;
  perform check_event_fields(p_title, p_event_date, p_event_time, p_location_text, p_lat, p_lng, p_max);
  if char_length(coalesce(p_description, '')) > 2000 then
    raise exception 'La description est trop longue (2000 caractères max).';
  end if;

  insert into events (
    title, description, event_date, event_time, location_text,
    lat, lng, max_participants, collaborative, tags, created_by
  ) values (
    trim(p_title), coalesce(p_description, ''), p_event_date, p_event_time,
    coalesce(trim(p_location_text), ''), p_lat, p_lng, p_max,
    coalesce(p_collaborative, false), v_tags, v_uid
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
      'tags', to_jsonb(v_tags),
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
  p_tags text[] default '{}'::text[]
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tags text[] := clean_tags(p_tags);
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

  update events set
    title = trim(p_title),
    description = coalesce(p_description, ''),
    event_date = p_event_date,
    event_time = p_event_time,
    location_text = coalesce(trim(p_location_text), ''),
    lat = p_lat, lng = p_lng,
    max_participants = p_max,
    collaborative = coalesce(p_collaborative, false),
    tags = v_tags
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
