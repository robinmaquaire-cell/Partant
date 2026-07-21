-- ============================================================
-- Partant ? — Rôles, catégories de matériel, calendrier partagé
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- ============================================================

-- ——— 1. Catégories de matériel (texte libre, ex. « Sécurité ») ———

alter table public.equipment_items
  add column category text check (char_length(category) <= 30);

-- ——— 2. Les rôles à occuper sur un événement ———

create table public.event_roles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  capacity integer not null default 1 check (capacity between 1 and 100),
  created_at timestamptz not null default now()
);

-- Qui prend en charge quel rôle.
create table public.event_role_takers (
  role_id uuid not null references public.event_roles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (role_id, user_id)
);

alter table public.event_roles enable row level security;
alter table public.event_role_takers enable row level security;

create policy "roles: lecture"
  on public.event_roles for select
  using (public.can_see_event(event_id) or public.is_event_organizer(event_id));
-- (écriture via les fonctions add_event_role / remove_event_role uniquement)

create policy "role_takers: lecture"
  on public.event_role_takers for select using (
    exists (
      select 1 from event_roles r
      where r.id = role_id
        and (public.can_see_event(r.event_id) or public.is_event_organizer(r.event_id))
    )
  );
-- (écriture via take_role / leave_role uniquement, qui plafonnent le nombre de places)

-- ——— 3. Calendrier partagé (une URL secrète par personne) ———

alter table public.profiles add column calendar_token text unique;

-- Chacun choisit les listes qui alimentent son calendrier.
alter table public.list_members
  add column in_calendar boolean not null default true;

-- ——— 4. Fonctions utilitaires mises à jour ———

-- Le matériel accepte maintenant une catégorie : [{name, kind, qty, category}, …]
create or replace function public.insert_equipment(p_event uuid, p_equipment jsonb)
returns void language plpgsql as $$
declare
  it jsonb;
  v_name text;
  v_kind text;
  v_qty integer;
  v_cat text;
begin
  for it in select * from jsonb_array_elements(coalesce(p_equipment, '[]'::jsonb)) loop
    v_name := trim(coalesce(it->>'name', ''));
    v_kind := it->>'kind';
    v_qty := case when v_kind = 'collectif' then coalesce((it->>'qty')::integer, 1) end;
    v_cat := nullif(trim(coalesce(it->>'category', '')), '');
    if char_length(v_name) not between 1 and 60 then
      raise exception 'Chaque objet de matériel doit avoir un nom (60 caractères max).';
    end if;
    if v_kind not in ('indiv', 'collectif') then
      raise exception 'Type de matériel invalide.';
    end if;
    if v_kind = 'collectif' and v_qty not between 1 and 999 then
      raise exception 'La quantité doit être entre 1 et 999.';
    end if;
    if char_length(coalesce(v_cat, '')) > 30 then
      raise exception 'Le nom de catégorie est trop long (30 caractères max).';
    end if;
    insert into equipment_items (event_id, name, kind, qty, category)
    values (p_event, v_name, v_kind, v_qty, v_cat);
  end loop;
end;
$$;

-- Vérifie et insère les rôles décrits en JSON : [{name, capacity}, …]
create or replace function public.insert_event_roles(p_event uuid, p_roles jsonb)
returns void language plpgsql as $$
declare
  it jsonb;
  v_name text;
  v_cap integer;
begin
  for it in select * from jsonb_array_elements(coalesce(p_roles, '[]'::jsonb)) loop
    v_name := trim(coalesce(it->>'name', ''));
    v_cap := coalesce((it->>'capacity')::integer, 1);
    if char_length(v_name) not between 1 and 40 then
      raise exception 'Chaque rôle doit avoir un nom (40 caractères max).';
    end if;
    if v_cap not between 1 and 100 then
      raise exception 'Le nombre de personnes par rôle doit être entre 1 et 100.';
    end if;
    insert into event_roles (event_id, name, capacity) values (p_event, v_name, v_cap);
  end loop;
end;
$$;

-- ——— 5. Création / modification d'événement : matériel catégorisé + rôles ———

-- Les anciennes versions sont remplacées (nouveaux paramètres).
drop function if exists public.create_event(
  text, text, date, time, text, double precision, double precision,
  integer, boolean, uuid[], jsonb, text);
drop function if exists public.update_event(
  uuid, text, text, date, time, text, double precision, double precision,
  integer, boolean, uuid[], jsonb, uuid[]);

create or replace function public.create_event(
  p_title text, p_description text, p_event_date date, p_event_time time,
  p_location_text text, p_lat double precision, p_lng double precision,
  p_max integer, p_collaborative boolean, p_list_ids uuid[],
  p_equipment jsonb, p_roles jsonb default '[]'::jsonb,
  p_template_name text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
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
    lat, lng, max_participants, collaborative, created_by
  ) values (
    trim(p_title), coalesce(p_description, ''), p_event_date, p_event_time,
    coalesce(trim(p_location_text), ''), p_lat, p_lng, p_max,
    coalesce(p_collaborative, false), v_uid
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
  p_roles_new jsonb default '[]'::jsonb, p_roles_removed uuid[] default '{}'::uuid[]
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
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
    collaborative = coalesce(p_collaborative, false)
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

-- ——— 6. Gestion des rôles au fil de l'eau ———

-- Ajouter un rôle (réservé aux organisateurs).
create or replace function public.add_event_role(
  p_event uuid, p_name text, p_capacity integer
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.is_event_organizer(p_event) then
    raise exception 'Seuls les organisateurs peuvent créer un rôle.';
  end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 40 then
    raise exception 'Donne un nom au rôle (40 caractères max).';
  end if;
  if p_capacity is null or p_capacity not between 1 and 100 then
    raise exception 'Le nombre de personnes doit être entre 1 et 100.';
  end if;
  insert into event_roles (event_id, name, capacity)
  values (p_event, trim(p_name), p_capacity)
  returning id into v_id;
  return v_id;
end;
$$;

-- Supprimer un rôle (réservé aux organisateurs).
create or replace function public.remove_event_role(p_role uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_event uuid;
begin
  select event_id into v_event from event_roles where id = p_role;
  if v_event is null then
    raise exception 'Ce rôle n''existe plus.';
  end if;
  if not public.is_event_organizer(v_event) then
    raise exception 'Seuls les organisateurs peuvent supprimer un rôle.';
  end if;
  delete from event_roles where id = p_role;
end;
$$;

-- Prendre en charge un rôle (dans la limite des places prévues).
create or replace function public.take_role(p_role uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_event uuid;
  v_cap integer;
  v_taken integer;
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;
  select event_id, capacity into v_event, v_cap from event_roles where id = p_role;
  if v_event is null or not can_see_event(v_event) then
    raise exception 'Ce rôle n''existe plus.';
  end if;
  if not exists (
    select 1 from rsvps
    where event_id = v_event and user_id = v_uid and status = 'yes'
  ) then
    raise exception 'Réponds d''abord « Partant ! » pour prendre un rôle.';
  end if;

  -- On sérialise pour ne jamais dépasser le nombre de places du rôle.
  perform pg_advisory_xact_lock(hashtext(p_role::text));
  select count(*) into v_taken
  from event_role_takers where role_id = p_role and user_id <> v_uid;
  if v_taken >= v_cap then
    raise exception 'Ce rôle est déjà complet.';
  end if;

  insert into event_role_takers (role_id, user_id)
  values (p_role, v_uid)
  on conflict do nothing;
end;
$$;

-- Se retirer d'un rôle.
create or replace function public.leave_role(p_role uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;
  delete from event_role_takers where role_id = p_role and user_id = v_uid;
end;
$$;

-- Quand quelqu'un se désiste, il abandonne aussi les rôles qu'il avait pris.
create or replace function public.drop_roles_on_rsvp_no()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'no' then
    delete from event_role_takers t
    using event_roles r
    where t.role_id = r.id and r.event_id = new.event_id and t.user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger rsvp_no_libere_les_roles
  after insert or update on public.rsvps
  for each row execute function public.drop_roles_on_rsvp_no();

-- ——— 7. Le calendrier partagé ———

-- Mon lien de calendrier (créé à la première demande).
create or replace function public.get_calendar_token()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;
  select calendar_token into v_token from profiles where id = v_uid;
  if v_token is null then
    v_token := replace(gen_random_uuid()::text, '-', '')
            || replace(gen_random_uuid()::text, '-', '');
    update profiles set calendar_token = v_token where id = v_uid;
  end if;
  return v_token;
end;
$$;

-- Changer de lien (l'ancien cesse aussitôt de fonctionner).
create or replace function public.reset_calendar_token()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;
  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');
  update profiles set calendar_token = v_token where id = v_uid;
  return v_token;
end;
$$;

-- Choisir si une liste alimente mon calendrier.
create or replace function public.set_list_in_calendar(p_list uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;
  update list_members set in_calendar = coalesce(p_on, true)
  where list_id = p_list and user_id = v_uid;
  if not found then
    raise exception 'Tu n''es pas membre de cette liste.';
  end if;
end;
$$;

-- Le contenu du calendrier, servi à Google Agenda via le lien secret.
-- (pas de session ici : c'est le jeton dans l'URL qui identifie la personne)
create or replace function public.calendar_feed(p_token text)
returns table (
  id uuid, title text, description text, event_date date, event_time time,
  location_text text, lat double precision, lng double precision,
  lists_text text, my_status text
) language sql security definer set search_path = public stable as $$
  select distinct on (e.id)
    e.id, e.title, e.description, e.event_date, e.event_time,
    e.location_text, e.lat, e.lng,
    (select string_agg(l.name, ', ' order by l.name)
       from event_lists el2 join lists l on l.id = el2.list_id
      where el2.event_id = e.id),
    r.status
  from profiles p
  join list_members m on m.user_id = p.id and m.in_calendar
  join event_lists el on el.list_id = m.list_id
  join events e on e.id = el.event_id
  left join rsvps r on r.event_id = e.id and r.user_id = p.id
  where p_token is not null
    and char_length(p_token) >= 32
    and p.calendar_token = p_token
    -- les événements refusés ne polluent pas l'agenda
    and coalesce(r.status, '') <> 'no'
    -- on garde un peu de passé pour l'historique
    and e.event_date >= current_date - 60
  order by e.id;
$$;
