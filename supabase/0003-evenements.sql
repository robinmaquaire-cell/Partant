-- ============================================================
-- Partant ? — Jalon M3 : événements, RSVP, matériel, templates
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- ============================================================

-- Les événements.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  event_date date not null,
  event_time time not null,
  location_text text not null default '' check (char_length(location_text) <= 120),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  max_participants integer not null check (max_participants between 1 and 1000),
  collaborative boolean not null default false,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- lat et lng vont ensemble : soit les deux, soit aucun.
  constraint gps_complet check ((lat is null) = (lng is null))
);

-- Sur quelles listes un événement est partagé (plusieurs possibles).
create table public.event_lists (
  event_id uuid not null references public.events (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  primary key (event_id, list_id)
);

-- Les réponses « Partant ! » / « Pas dispo ».
create table public.rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('yes', 'no')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Le matériel demandé pour un événement.
-- kind 'indiv' = un par personne (pas de quantité) ; 'collectif' = quantité globale.
-- added_by vide = ajouté par l'organisateur ; sinon par un participant (mode collaboratif).
create table public.equipment_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null check (kind in ('indiv', 'collectif')),
  qty integer,
  added_by uuid references public.profiles (id) on delete cascade,
  constraint qty_selon_type check (
    (kind = 'indiv' and qty is null)
    or (kind = 'collectif' and qty between 1 and 999)
  )
);

-- « J'en ramène N » sur un objet collectif.
create table public.equipment_contributions (
  item_id uuid not null references public.equipment_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  qty integer not null check (qty between 1 and 999),
  primary key (item_id, user_id)
);

-- « J'ai le mien » sur un objet individuel.
create table public.equipment_confirmations (
  item_id uuid not null references public.equipment_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (item_id, user_id)
);

-- Les templates d'événements, propres à chaque utilisateur.
-- payload = tous les champs de l'événement sauf la date, au format JSON.
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- ——— Fonctions utilitaires (security definer = évite que les règles
-- de sécurité se rappellent elles-mêmes en boucle) ———

-- Est-ce que je peux voir cet événement ? (membre d'au moins une de ses listes)
create or replace function public.can_see_event(e uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from event_lists el
    join list_members m on m.list_id = el.list_id
    where el.event_id = e and m.user_id = auth.uid()
  );
$$;

-- Suis-je le créateur de cet événement ?
create or replace function public.is_event_creator(e uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from events where id = e and created_by = auth.uid()
  );
$$;

-- Est-ce que cette personne et moi partageons au moins un événement ?
-- (sert à afficher les pseudos des partants venus d'autres listes)
create or replace function public.shares_event_with(p uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from event_lists el1
    join list_members me on me.list_id = el1.list_id and me.user_id = auth.uid()
    join event_lists el2 on el2.event_id = el1.event_id
    join list_members them on them.list_id = el2.list_id and them.user_id = p
  );
$$;

-- ——— Sécurité ligne par ligne ———
alter table public.events enable row level security;
alter table public.event_lists enable row level security;
alter table public.rsvps enable row level security;
alter table public.equipment_items enable row level security;
alter table public.equipment_contributions enable row level security;
alter table public.equipment_confirmations enable row level security;
alter table public.templates enable row level security;

create policy "events: visibles via mes listes"
  on public.events for select
  using (public.can_see_event(id) or created_by = auth.uid());
create policy "events: le créateur modifie"
  on public.events for update
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "events: le créateur supprime"
  on public.events for delete using (created_by = auth.uid());
-- (pas de création directe : elle passe par la fonction create_event ci-dessous)

create policy "event_lists: lecture"
  on public.event_lists for select
  using (public.can_see_event(event_id) or public.is_event_creator(event_id));
-- (écriture via create_event / update_event uniquement)

create policy "rsvps: lecture"
  on public.rsvps for select using (public.can_see_event(event_id));
-- (écriture via set_rsvp uniquement, qui vérifie la limite de participants)

create policy "equipment: lecture"
  on public.equipment_items for select
  using (public.can_see_event(event_id) or public.is_event_creator(event_id));
create policy "equipment: ajout"
  on public.equipment_items for insert with check (
    -- l'organisateur ajoute ses propres lignes…
    (added_by is null and public.is_event_creator(event_id))
    -- …ou un participant ajoute ce qu'il ramène, si l'événement est collaboratif
    or (
      added_by = auth.uid()
      and kind = 'collectif'
      and public.can_see_event(event_id)
      and exists (select 1 from events e where e.id = event_id and e.collaborative)
    )
  );
create policy "equipment: retrait"
  on public.equipment_items for delete using (
    (added_by is not null and added_by = auth.uid())
    or public.is_event_creator(event_id)
  );

create policy "contributions: lecture"
  on public.equipment_contributions for select using (
    exists (
      select 1 from equipment_items i
      where i.id = item_id
        and (public.can_see_event(i.event_id) or public.is_event_creator(i.event_id))
    )
  );
-- (écriture via set_contribution uniquement, qui plafonne au besoin restant)

create policy "confirmations: lecture"
  on public.equipment_confirmations for select using (
    exists (
      select 1 from equipment_items i
      where i.id = item_id
        and (public.can_see_event(i.event_id) or public.is_event_creator(i.event_id))
    )
  );
create policy "confirmations: je confirme pour moi"
  on public.equipment_confirmations for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from equipment_items i
      where i.id = item_id and i.kind = 'indiv' and public.can_see_event(i.event_id)
    )
  );
create policy "confirmations: j'annule pour moi"
  on public.equipment_confirmations for delete using (user_id = auth.uid());

create policy "templates: chacun les siens"
  on public.templates for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Les pseudos des personnes avec qui je partage un événement deviennent
-- lisibles (partants, contributeurs), même si elles viennent d'une autre liste.
create policy "profiles: participants d'événements partagés"
  on public.profiles for select using (public.shares_event_with(id));

-- ——— Contrôles partagés par create_event et update_event ———
create or replace function public.check_event_fields(
  p_title text, p_event_date date, p_event_time time,
  p_location_text text, p_lat double precision, p_lng double precision,
  p_max integer
) returns void language plpgsql as $$
begin
  if p_title is null or char_length(trim(p_title)) not between 1 and 80 then
    raise exception 'Le titre doit faire entre 1 et 80 caractères.';
  end if;
  if p_event_date is null then
    raise exception 'Choisis une date.';
  end if;
  if p_event_time is null then
    raise exception 'Choisis une heure.';
  end if;
  if char_length(coalesce(p_location_text, '')) > 120 then
    raise exception 'Le lieu est trop long (120 caractères max).';
  end if;
  if (p_lat is null) <> (p_lng is null) then
    raise exception 'Point GPS incomplet.';
  end if;
  if p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180) then
    raise exception 'Point GPS invalide.';
  end if;
  if p_max is null or p_max not between 1 and 1000 then
    raise exception 'Le nombre max de participants doit être entre 1 et 1000.';
  end if;
end;
$$;

-- Vérifie et insère le matériel décrit en JSON : [{name, kind, qty}, …]
create or replace function public.insert_equipment(p_event uuid, p_equipment jsonb)
returns void language plpgsql as $$
declare
  it jsonb;
  v_name text;
  v_kind text;
  v_qty integer;
begin
  for it in select * from jsonb_array_elements(coalesce(p_equipment, '[]'::jsonb)) loop
    v_name := trim(coalesce(it->>'name', ''));
    v_kind := it->>'kind';
    v_qty := case when v_kind = 'collectif' then coalesce((it->>'qty')::integer, 1) end;
    if char_length(v_name) not between 1 and 60 then
      raise exception 'Chaque objet de matériel doit avoir un nom (60 caractères max).';
    end if;
    if v_kind not in ('indiv', 'collectif') then
      raise exception 'Type de matériel invalide.';
    end if;
    if v_kind = 'collectif' and v_qty not between 1 and 999 then
      raise exception 'La quantité doit être entre 1 et 999.';
    end if;
    insert into equipment_items (event_id, name, kind, qty)
    values (p_event, v_name, v_kind, v_qty);
  end loop;
end;
$$;

-- Vérifie que je suis membre de chaque liste visée, puis pose le partage.
create or replace function public.set_event_lists(p_event uuid, p_list_ids uuid[])
returns void language plpgsql as $$
declare
  v_uid uuid := auth.uid();
begin
  if p_list_ids is null or array_length(p_list_ids, 1) is null then
    raise exception 'Choisis au moins une liste de diffusion.';
  end if;
  if exists (
    select 1 from unnest(p_list_ids) as t(list_id)
    where not exists (
      select 1 from list_members m
      where m.list_id = t.list_id and m.user_id = v_uid
    )
  ) then
    raise exception 'Tu dois être membre de chaque liste choisie.';
  end if;
  delete from event_lists
  where event_id = p_event and not (list_id = any (p_list_ids));
  insert into event_lists (event_id, list_id)
  select distinct p_event, t.list_id from unnest(p_list_ids) as t(list_id)
  on conflict do nothing;
end;
$$;

-- ——— Opérations « guichet » (RPC) ———

-- Créer un événement complet : fiche + partage + matériel + template éventuel.
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

-- Modifier un événement (réservé à son créateur).
-- p_equipment_removed = objets à retirer ; p_equipment_new = objets à ajouter.
create or replace function public.update_event(
  p_event uuid, p_title text, p_description text, p_event_date date,
  p_event_time time, p_location_text text, p_lat double precision,
  p_lng double precision, p_max integer, p_collaborative boolean,
  p_list_ids uuid[], p_equipment_new jsonb, p_equipment_removed uuid[]
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (select 1 from events where id = p_event and created_by = v_uid) then
    raise exception 'Seul le créateur peut modifier cet événement.';
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

-- Répondre « Partant ! » ou « Pas dispo », en respectant la limite de places.
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

-- Déclarer « j'en ramène N » sur un objet collectif (0 = je n'en ramène plus).
-- Plafonné à ce qu'il reste à trouver, en comptant les autres contributions.
create or replace function public.set_contribution(p_item uuid, p_qty integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_event uuid;
  v_kind text;
  v_needed integer;
  v_others integer;
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;
  if p_qty is null or p_qty < 0 or p_qty > 999 then
    raise exception 'Quantité invalide.';
  end if;

  select event_id, kind, qty into v_event, v_kind, v_needed
  from equipment_items where id = p_item;
  if v_event is null or not can_see_event(v_event) then
    raise exception 'Objet introuvable.';
  end if;
  if v_kind <> 'collectif' then
    raise exception 'Cet objet est individuel : utilise « J''ai le mien ».';
  end if;

  if p_qty = 0 then
    delete from equipment_contributions where item_id = p_item and user_id = v_uid;
    return;
  end if;

  -- On sérialise pour ne jamais dépasser le besoin total.
  perform pg_advisory_xact_lock(hashtext(p_item::text));
  select coalesce(sum(qty), 0) into v_others
  from equipment_contributions where item_id = p_item and user_id <> v_uid;
  if p_qty > v_needed - v_others then
    raise exception 'Il n''en reste que % à trouver.', greatest(v_needed - v_others, 0);
  end if;

  insert into equipment_contributions (item_id, user_id, qty)
  values (p_item, v_uid, p_qty)
  on conflict (item_id, user_id) do update set qty = excluded.qty;
end;
$$;
