-- ============================================================
-- Partants ? — Contacts (réseau social léger)
-- Enregistrer ses contacts, les ajouter manuellement, bloquer leurs
-- événements, les retirer, voir les listes/événements en commun.
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0013-feedback.sql)
-- ============================================================

-- Le lien de contact, du point de vue de user_id vers contact_id.
-- Les contacts « rencontrés » (via une liste ou un événement) sont calculés
-- à la volée ; cette table ne garde que les choix explicites de la personne :
--   manual  = ajouté à la main (apparaît même sans liste/événement commun)
--   blocked = ses événements sont masqués de mon fil
--   removed = retiré de mes contacts
create table public.contact_links (
  user_id uuid not null references public.profiles (id) on delete cascade,
  contact_id uuid not null references public.profiles (id) on delete cascade,
  manual boolean not null default false,
  blocked boolean not null default false,
  removed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, contact_id),
  constraint pas_soi_meme check (user_id <> contact_id)
);

alter table public.contact_links enable row level security;

create policy "contacts: chacun les siens"
  on public.contact_links for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ——— La liste de mes contacts (calculée) ———
-- Union des co-membres de mes listes, des participants aux événements que je
-- vois, et de mes ajouts manuels ; moins ceux que j'ai retirés.
create or replace function public.my_contacts()
returns table (
  contact_id uuid, pseudo text, avatar_url text,
  blocked boolean, manual boolean, via_list boolean, via_event boolean
) language sql security definer set search_path = public stable as $$
  with moi as (select auth.uid() as uid),
  list_contacts as (
    -- co-membres, mais on respecte le réglage « membres masqués » :
    -- une liste masquée ne révèle ses membres qu'à ses admins.
    select distinct them.user_id as cid
    from list_members mine
    join lists l on l.id = mine.list_id
    join list_members them on them.list_id = mine.list_id
    where mine.user_id = (select uid from moi)
      and them.user_id <> (select uid from moi)
      and (l.members_visible or mine.role = 'admin')
  ),
  my_events as (
    select el.event_id as eid from event_lists el
    join list_members m on m.list_id = el.list_id and m.user_id = (select uid from moi)
    union
    select g.event_id from event_guests g where g.user_id = (select uid from moi)
    union
    select o.event_id from event_organizers o where o.user_id = (select uid from moi)
  ),
  event_contacts as (
    select distinct cid from (
      select o.user_id as cid from event_organizers o join my_events e on e.eid = o.event_id
      union
      select r.user_id from rsvps r join my_events e on e.eid = r.event_id
      union
      select g.user_id from event_guests g join my_events e on e.eid = g.event_id
    ) x
    where cid <> (select uid from moi)
  ),
  manual_contacts as (
    select contact_id as cid from contact_links
    where user_id = (select uid from moi) and manual
  ),
  all_cids as (
    select cid, true as vl, false as ve from list_contacts
    union all
    select cid, false, true from event_contacts
    union all
    select cid, false, false from manual_contacts
  ),
  agg as (
    select cid, bool_or(vl) as via_list, bool_or(ve) as via_event
    from all_cids group by cid
  )
  select a.cid, p.pseudo, p.avatar_url,
    coalesce(cl.blocked, false), coalesce(cl.manual, false),
    a.via_list, a.via_event
  from agg a
  join profiles p on p.id = a.cid
  left join contact_links cl
    on cl.user_id = (select uid from moi) and cl.contact_id = a.cid
  where coalesce(cl.removed, false) = false
  order by lower(p.pseudo);
$$;

-- ——— Ajouter un contact par e-mail ou pseudo ———
-- Renvoie 'ok', 'introuvable' ou 'soi'.
create or replace function public.add_manual_contact(p_query text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_q text := trim(coalesce(p_query, ''));
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if v_q = '' then raise exception 'Indique une adresse e-mail ou un pseudo.'; end if;

  if v_q ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    select id into v_target from auth.users where lower(email) = lower(v_q);
  else
    select id into v_target from profiles
    where lower(pseudo) = lower(v_q) order by created_at limit 1;
  end if;

  if v_target is null then return 'introuvable'; end if;
  if v_target = v_uid then return 'soi'; end if;

  insert into contact_links (user_id, contact_id, manual, removed)
  values (v_uid, v_target, true, false)
  on conflict (user_id, contact_id)
  do update set manual = true, removed = false;
  return 'ok';
end;
$$;

-- ——— Bloquer / débloquer les événements d'un contact ———
create or replace function public.set_contact_blocked(p_contact uuid, p_blocked boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  insert into contact_links (user_id, contact_id, blocked)
  values (v_uid, p_contact, coalesce(p_blocked, false))
  on conflict (user_id, contact_id) do update set blocked = excluded.blocked;
end;
$$;

-- ——— Retirer un contact de ma liste ———
create or replace function public.remove_contact(p_contact uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  insert into contact_links (user_id, contact_id, removed, manual, blocked)
  values (v_uid, p_contact, true, false, false)
  on conflict (user_id, contact_id)
  do update set removed = true, manual = false, blocked = false;
end;
$$;

-- ——— Listes et événements en commun avec un contact ———
create or replace function public.contact_common(p_contact uuid)
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'lists', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'name', l.name, 'color', l.color,
        'emoji', l.emoji, 'logo_url', l.logo_url) order by lower(l.name))
      from lists l
      join list_members a on a.list_id = l.id and a.user_id = auth.uid()
      where exists (select 1 from list_members b where b.list_id = l.id and b.user_id = p_contact)
        and (l.members_visible or a.role = 'admin')
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'title', e.title, 'event_date', e.event_date) order by e.event_date desc)
      from events e
      where (
        exists (select 1 from event_lists el join list_members m on m.list_id = el.list_id
                 where el.event_id = e.id and m.user_id = auth.uid())
        or exists (select 1 from event_guests g where g.event_id = e.id and g.user_id = auth.uid())
        or exists (select 1 from event_organizers o where o.event_id = e.id and o.user_id = auth.uid())
      ) and (
        exists (select 1 from event_lists el join list_members m on m.list_id = el.list_id
                 where el.event_id = e.id and m.user_id = p_contact)
        or exists (select 1 from event_guests g where g.event_id = e.id and g.user_id = p_contact)
        or exists (select 1 from event_organizers o where o.event_id = e.id and o.user_id = p_contact)
        or exists (select 1 from rsvps r where r.event_id = e.id and r.user_id = p_contact and r.status = 'yes')
      )
    ), '[]'::jsonb),
    'pseudo', (select pseudo from profiles where id = p_contact),
    'avatar_url', (select avatar_url from profiles where id = p_contact),
    'blocked', coalesce((select blocked from contact_links
       where user_id = auth.uid() and contact_id = p_contact), false)
  );
$$;

-- ——— Le calendrier synchronisé ignore les contacts bloqués ———
-- (redéfinition de calendar_rows du script 0008 + exclusion des créateurs bloqués)
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
        or coalesce(b.category, '') = any (p.categories)
      )
    ) as rule_ok
  ) r
  where p_user is not null and (b.in_any_list or b.by_link) and not b.blocked_creator;
$$;
