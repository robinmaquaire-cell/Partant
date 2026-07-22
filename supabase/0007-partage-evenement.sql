-- ============================================================
-- Partant ? — Lien de partage d'événement, événements sans liste
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0006-roles-categories-calendrier.sql)
-- ============================================================

-- ——— 1. Les liens de partage d'un événement ———

create table public.event_invites (
  token text primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  revoked boolean not null default false
);

-- Les personnes ayant rejoint un événement par ce lien.
-- Celles qui ne sont dans aucune liste de diffusion de l'événement
-- apparaissent « hors liste de diffusion ».
create table public.event_guests (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_invites enable row level security;
alter table public.event_guests enable row level security;

create policy "event_invites: lecture"
  on public.event_invites for select
  using (public.can_see_event(event_id) or public.is_event_organizer(event_id));
-- (écriture via les fonctions ci-dessous uniquement)

create policy "event_guests: lecture"
  on public.event_guests for select
  using (public.can_see_event(event_id) or public.is_event_organizer(event_id));

-- ——— 2. Voir un événement : via ses listes OU via son lien de partage ———

create or replace function public.can_see_event(e uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from event_lists el
    join list_members m on m.list_id = el.list_id
    where el.event_id = e and m.user_id = auth.uid()
  ) or exists (
    select 1 from event_guests g where g.event_id = e and g.user_id = auth.uid()
  ) or exists (
    -- un organisateur garde l'accès même si l'événement n'a plus de liste
    select 1 from event_organizers o where o.event_id = e and o.user_id = auth.uid()
  );
$$;

-- Les pseudos restent lisibles entre personnes qui partagent un événement,
-- que ce soit par une liste ou par un lien de partage.
create or replace function public.shares_event_with(p uuid)
returns boolean language sql security definer set search_path = public stable as $$
  with mine as (
    select el.event_id from event_lists el
    join list_members m on m.list_id = el.list_id and m.user_id = auth.uid()
    union
    select g.event_id from event_guests g where g.user_id = auth.uid()
  ), theirs as (
    select el.event_id from event_lists el
    join list_members m on m.list_id = el.list_id and m.user_id = p
    union
    select g.event_id from event_guests g where g.user_id = p
  )
  select exists (select 1 from mine join theirs using (event_id));
$$;

-- ——— 3. Un événement peut n'être partagé avec aucune liste ———
-- (il n'est alors visible que par son lien de partage)

create or replace function public.set_event_lists(p_event uuid, p_list_ids uuid[])
returns void language plpgsql as $$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[] := coalesce(p_list_ids, '{}'::uuid[]);
begin
  if exists (
    select 1 from unnest(v_ids) as t(list_id)
    where not exists (
      select 1 from list_members m
      where m.list_id = t.list_id and m.user_id = v_uid
    )
  ) then
    raise exception 'Tu dois être membre de chaque liste choisie.';
  end if;
  delete from event_lists
  where event_id = p_event and not (list_id = any (v_ids));
  insert into event_lists (event_id, list_id)
  select distinct p_event, t.list_id from unnest(v_ids) as t(list_id)
  on conflict do nothing;
end;
$$;

-- ——— 4. Créer / lire / utiliser un lien de partage ———

-- Le lien de partage d'un événement (créé à la première demande).
create or replace function public.get_event_share_token(p_event uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_token text;
begin
  if not public.is_event_organizer(p_event) then
    raise exception 'Seuls les organisateurs peuvent partager cet événement.';
  end if;
  select token into v_token from event_invites
  where event_id = p_event and not revoked
  order by created_at desc limit 1;
  if v_token is null then
    v_token := replace(gen_random_uuid()::text, '-', '');
    insert into event_invites (token, event_id, created_by)
    values (v_token, p_event, auth.uid());
  end if;
  return v_token;
end;
$$;

-- Remplacer le lien : l'ancien cesse de fonctionner.
create or replace function public.regenerate_event_share_token(p_event uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_token text;
begin
  if not public.is_event_organizer(p_event) then
    raise exception 'Seuls les organisateurs peuvent partager cet événement.';
  end if;
  update event_invites set revoked = true
  where event_id = p_event and not revoked;
  v_token := replace(gen_random_uuid()::text, '-', '');
  insert into event_invites (token, event_id, created_by)
  values (v_token, p_event, auth.uid());
  return v_token;
end;
$$;

-- Ce que voit une personne qui ouvre le lien (même sans compte).
create or replace function public.get_event_invite(p_token text)
returns table (
  event_id uuid, title text, event_date date, event_time time,
  location_text text, color text, yes_count bigint,
  max_participants integer, already_in boolean
) language sql security definer set search_path = public stable as $$
  select e.id, e.title, e.event_date, e.event_time, e.location_text,
    coalesce(
      (select l.color from event_lists el join lists l on l.id = el.list_id
        where el.event_id = e.id order by l.name limit 1),
      '#2C7DA0'
    ),
    (select count(*) from rsvps r where r.event_id = e.id and r.status = 'yes'),
    e.max_participants,
    public.can_see_event(e.id)
  from event_invites i
  join events e on e.id = i.event_id
  where i.token = p_token and not i.revoked;
$$;

-- Rejoindre un événement grâce à son lien de partage.
create or replace function public.join_event(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_event uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;
  select i.event_id into v_event
  from event_invites i where i.token = p_token and not i.revoked;
  if v_event is null then
    raise exception 'Ce lien de partage est invalide ou a été remplacé.';
  end if;
  insert into event_guests (event_id, user_id)
  values (v_event, v_uid)
  on conflict do nothing;
  return v_event;
end;
$$;

-- Qui, parmi les personnes de cet événement, n'est dans aucune de ses
-- listes de diffusion (affiché « hors liste de diffusion »).
create or replace function public.event_outsiders(p_event uuid)
returns table (user_id uuid)
language sql security definer set search_path = public stable as $$
  select g.user_id
  from event_guests g
  where g.event_id = p_event
    and public.can_see_event(p_event)
    and not exists (
      select 1 from event_lists el
      join list_members m on m.list_id = el.list_id
      where el.event_id = p_event and m.user_id = g.user_id
    );
$$;

-- ——— 5. Le calendrier partagé tient compte des invitations par lien ———

create or replace function public.calendar_feed(p_token text)
returns table (
  id uuid, title text, description text, event_date date, event_time time,
  location_text text, lat double precision, lng double precision,
  lists_text text, my_status text
) language sql security definer set search_path = public stable as $$
  with moi as (
    select p.id as user_id from profiles p
    where p_token is not null and char_length(p_token) >= 32
      and p.calendar_token = p_token
  ), visibles as (
    -- les événements des listes cochées…
    select el.event_id, moi.user_id
    from moi
    join list_members m on m.user_id = moi.user_id and m.in_calendar
    join event_lists el on el.list_id = m.list_id
    union
    -- …et ceux rejoints par un lien de partage
    select g.event_id, moi.user_id
    from moi
    join event_guests g on g.user_id = moi.user_id
  )
  select distinct on (e.id)
    e.id, e.title, e.description, e.event_date, e.event_time,
    e.location_text, e.lat, e.lng,
    (select string_agg(l.name, ', ' order by l.name)
       from event_lists el2 join lists l on l.id = el2.list_id
      where el2.event_id = e.id),
    r.status
  from visibles v
  join events e on e.id = v.event_id
  left join rsvps r on r.event_id = e.id and r.user_id = v.user_id
  where coalesce(r.status, '') <> 'no'
    and e.event_date >= current_date - 60
  order by e.id;
$$;
