-- ============================================================
-- Partants ? — Calendrier de disponibilité unifié (jalon R8)
-- Nouvelle table manual_busy_slots : chacun peut y saisir directement
-- des créneaux d'indisponibilité (« WE en famille », « en formation »…)
-- sans passer par un agenda externe.
--
-- Nouvelle vue unifiée my_availability_slots qui rassemble trois sources
-- pour une fenêtre donnée :
--   1. ics       — importé du lien agenda (busy_slots)
--   2. partant   — les événements Partants ? où j'ai répondu « oui »
--   3. manuel    — les créneaux saisis dans l'app
--
-- Mise à jour de contacts_busy_between pour prendre en compte manuel +
-- Partants events (avant elle ne regardait que .ics).
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0025-invitation-contact.sql)
-- ============================================================

-- ——— Créneaux saisis à la main ———
create table if not exists public.manual_busy_slots (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  constraint manual_busy_slots_range_ok check (ends_at > starts_at)
);

create index if not exists manual_busy_slots_user_time
  on public.manual_busy_slots (user_id, starts_at, ends_at);

alter table public.manual_busy_slots enable row level security;

drop policy if exists "manual_busy_slots: chacun le sien"
  on public.manual_busy_slots;
create policy "manual_busy_slots: chacun le sien"
  on public.manual_busy_slots for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ——— Ajouter / retirer un créneau ———
create or replace function public.add_manual_busy_slot(
  p_starts timestamptz, p_ends timestamptz, p_note text default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id bigint;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if p_ends is null or p_starts is null or p_ends <= p_starts then
    raise exception 'Créneau invalide.';
  end if;
  if v_note is not null and char_length(v_note) > 120 then
    raise exception 'La note est trop longue (120 caractères max).';
  end if;
  insert into manual_busy_slots (user_id, starts_at, ends_at, note)
    values (v_uid, p_starts, p_ends, v_note)
    returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.remove_manual_busy_slot(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  delete from manual_busy_slots where id = p_id and user_id = auth.uid();
end;
$$;

-- ——— Vue unifiée : mes créneaux occupés sur une fenêtre ———
-- Renvoie chaque créneau avec sa source (ics / partant / manuel), un
-- éventuel titre (uniquement pour partant et manuel), et l'id
-- (utile pour supprimer un créneau manuel).
create or replace function public.my_availability_slots(
  p_from timestamptz, p_to timestamptz
)
returns table (
  source text,
  slot_id text, -- bigint stringifié pour manuel, uuid pour partant
  starts_at timestamptz,
  ends_at timestamptz,
  label text
) language sql security definer set search_path = public stable as $$
  -- Agenda synchronisé (.ics) : on ne divulgue jamais le titre.
  select 'ics'::text, null::text, bs.starts_at, bs.ends_at, null::text
    from busy_slots bs
    where bs.user_id = auth.uid()
      and bs.ends_at > p_from and bs.starts_at < p_to
  union all
  -- Événements Partants ? où j'ai dit « oui ». Durée par défaut : 2 h.
  select 'partant'::text, e.id::text,
    ((e.event_date::text || ' ' || e.event_time::text)::timestamp at time zone 'Europe/Paris'),
    ((e.event_date::text || ' ' || e.event_time::text)::timestamp at time zone 'Europe/Paris') + interval '2 hours',
    e.title
    from events e
    join rsvps r on r.event_id = e.id
      and r.user_id = auth.uid() and r.status = 'yes'
    where ((e.event_date::text || ' ' || e.event_time::text)::timestamp at time zone 'Europe/Paris')
            + interval '2 hours' > p_from
      and ((e.event_date::text || ' ' || e.event_time::text)::timestamp at time zone 'Europe/Paris') < p_to
  union all
  -- Créneaux saisis à la main.
  select 'manual'::text, m.id::text, m.starts_at, m.ends_at, m.note
    from manual_busy_slots m
    where m.user_id = auth.uid()
      and m.ends_at > p_from and m.starts_at < p_to
  order by starts_at;
$$;

-- ——— Mise à jour de contacts_busy_between : nouveaux facteurs ———
-- La visibilité des contacts (ceux qui sont dans mes contacts + qui
-- partagent leur agenda .ics) reste identique — c'est la même filière
-- de confiance qui portait déjà les créneaux .ics.
-- On considère maintenant occupé si l'un des trois est vrai :
--   • un créneau .ics chevauche
--   • un créneau manuel chevauche
--   • un événement Partants ? où la personne a dit « oui » chevauche
create or replace function public.contacts_busy_between(
  p_contacts uuid[], p_from timestamptz, p_to timestamptz
)
returns table (contact_id uuid, busy boolean)
language sql security definer set search_path = public stable as $$
  with visibles as (
    select mc.contact_id as cid
    from my_contacts() mc
    join calendar_sources cs on cs.user_id = mc.contact_id and cs.busy_share
    where mc.contact_id = any (p_contacts)
      and cs.ics_url is not null
  )
  select v.cid,
    exists (
      select 1 from busy_slots bs
      where bs.user_id = v.cid
        and bs.ends_at > p_from and bs.starts_at < p_to
    )
    or exists (
      select 1 from manual_busy_slots m
      where m.user_id = v.cid
        and m.ends_at > p_from and m.starts_at < p_to
    )
    or exists (
      select 1 from events e
      join rsvps r on r.event_id = e.id
        and r.user_id = v.cid and r.status = 'yes'
      where ((e.event_date::text || ' ' || e.event_time::text)::timestamp at time zone 'Europe/Paris')
              + interval '2 hours' > p_from
        and ((e.event_date::text || ' ' || e.event_time::text)::timestamp at time zone 'Europe/Paris') < p_to
    ) as busy
  from visibles v;
$$;
