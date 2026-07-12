-- ============================================================
-- Partant ? — Organisateurs multiples + photos de profil
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- ============================================================

-- ——— 1. Photo de profil ———

alter table public.profiles add column avatar_url text;

-- Espace de stockage public pour les photos de profil.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Chacun ne gère que son propre dossier (avatars/<son id>/…).
create policy "avatars: lecture publique"
  on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars: dépôt dans son dossier"
  on storage.objects for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "avatars: remplacement dans son dossier"
  on storage.objects for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "avatars: suppression dans son dossier"
  on storage.objects for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ——— 2. Les organisateurs d'événements ———

create table public.event_organizers (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (event_id, user_id)
);
alter table public.event_organizers enable row level security;

-- Les créateurs des événements existants deviennent leurs organisateurs…
insert into public.event_organizers (event_id, user_id)
select id, created_by from public.events
on conflict do nothing;

-- …et un organisateur est toujours « Partant ! ».
insert into public.rsvps (event_id, user_id, status)
select id, created_by, 'yes' from public.events
on conflict (event_id, user_id) do update set status = 'yes';

create or replace function public.is_event_organizer(e uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from event_organizers where event_id = e and user_id = auth.uid()
  );
$$;

create policy "organizers: lecture"
  on public.event_organizers for select
  using (public.can_see_event(event_id) or public.is_event_organizer(event_id));
-- (écriture via les fonctions add_organizer / remove_organizer uniquement)

-- ——— 3. Les droits passent du seul créateur à tous les organisateurs ———

drop policy "events: le créateur modifie" on public.events;
drop policy "events: le créateur supprime" on public.events;
create policy "events: les organisateurs modifient"
  on public.events for update
  using (public.is_event_organizer(id)) with check (public.is_event_organizer(id));
create policy "events: les organisateurs suppriment"
  on public.events for delete using (public.is_event_organizer(id));

drop policy "equipment: ajout" on public.equipment_items;
create policy "equipment: ajout"
  on public.equipment_items for insert with check (
    -- un organisateur ajoute ses propres lignes…
    (added_by is null and public.is_event_organizer(event_id))
    -- …ou un participant ajoute ce qu'il ramène, si l'événement est collaboratif
    or (
      added_by = auth.uid()
      and kind = 'collectif'
      and public.can_see_event(event_id)
      and exists (select 1 from events e where e.id = event_id and e.collaborative)
    )
  );
drop policy "equipment: retrait" on public.equipment_items;
create policy "equipment: retrait"
  on public.equipment_items for delete using (
    (added_by is not null and added_by = auth.uid())
    or public.is_event_organizer(event_id)
  );

-- ——— 4. Fonctions mises à jour ———

-- À la création : le créateur devient organisateur et « Partant ! ».
create or replace function public.create_event(
  p_title text, p_description text, p_event_date date, p_event_time time,
  p_location_text text, p_lat double precision, p_lng double precision,
  p_max integer, p_collaborative boolean, p_list_ids uuid[],
  p_equipment jsonb, p_template_name text default null
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
      'equipment', coalesce(p_equipment, '[]'::jsonb)
    ));
  end if;

  return v_id;
end;
$$;

-- La modification est ouverte à tous les organisateurs.
create or replace function public.update_event(
  p_event uuid, p_title text, p_description text, p_event_date date,
  p_event_time time, p_location_text text, p_lat double precision,
  p_lng double precision, p_max integer, p_collaborative boolean,
  p_list_ids uuid[], p_equipment_new jsonb, p_equipment_removed uuid[]
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
end;
$$;

-- Un organisateur est forcément partant : il ne répond pas au RSVP.
create or replace function public.set_rsvp(p_event uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_max integer;
  v_yes integer;
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;
  if p_status not in ('yes', 'no') then
    raise exception 'Réponse invalide.';
  end if;
  if not can_see_event(p_event) then
    raise exception 'Événement introuvable.';
  end if;
  if exists (
    select 1 from event_organizers where event_id = p_event and user_id = v_uid
  ) then
    raise exception 'Tu organises cet événement : tu es forcément partant·e. Désinscris-toi d''abord des organisateurs.';
  end if;

  if p_status = 'yes' then
    -- On sérialise les réponses « oui » pour ne jamais dépasser la limite.
    perform pg_advisory_xact_lock(hashtext(p_event::text));
    select max_participants into v_max from events where id = p_event;
    select count(*) into v_yes from rsvps
    where event_id = p_event and status = 'yes' and user_id <> v_uid;
    if v_yes >= v_max then
      raise exception 'Cet événement est déjà complet.';
    end if;
  end if;

  insert into rsvps (event_id, user_id, status)
  values (p_event, v_uid, p_status)
  on conflict (event_id, user_id)
  do update set status = excluded.status, updated_at = now();
end;
$$;

-- Promouvoir un partant en organisateur (réservé aux organisateurs).
create or replace function public.add_organizer(p_event uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (
    select 1 from event_organizers where event_id = p_event and user_id = v_uid
  ) then
    raise exception 'Seuls les organisateurs peuvent nommer un organisateur.';
  end if;
  if not exists (
    select 1 from rsvps
    where event_id = p_event and user_id = p_user and status = 'yes'
  ) then
    raise exception 'Cette personne doit d''abord répondre « Partant ! ».';
  end if;
  insert into event_organizers (event_id, user_id)
  values (p_event, p_user)
  on conflict do nothing;
end;
$$;

-- Se désinscrire d'un événement qu'on organise (s'il reste un organisateur).
create or replace function public.remove_organizer(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (
    select 1 from event_organizers where event_id = p_event and user_id = v_uid
  ) then
    raise exception 'Tu n''organises pas cet événement.';
  end if;
  if (select count(*) from event_organizers where event_id = p_event) <= 1 then
    raise exception 'Un événement doit garder au moins un organisateur. Nomme quelqu''un d''autre avant de te désinscrire.';
  end if;
  delete from event_organizers where event_id = p_event and user_id = v_uid;
  -- Se désinscrire = ne plus être partant non plus (libre de re-répondre).
  delete from rsvps where event_id = p_event and user_id = v_uid;
end;
$$;
