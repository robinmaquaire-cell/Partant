-- ============================================================
-- Partants ? — Récurrence des créneaux + partage granulaire (jalon R9)
--
--  1. « Journée entière » sur les créneaux manuels ponctuels
--  2. Nouvelle table recurring_busy_rules : règles hebdomadaires
--     (choix des jours + fenêtre d'application + all_day ou heures)
--  3. Nouvelle table busy_share_grants : qui voit ma dispo, à choisir
--     entre « tout le monde », un contact précis, ou un groupe précis.
--     Par défaut : personne. Les personnes qui avaient déjà busy_share
--     activé sont migrées en « tout le monde » pour préserver leur choix.
--  4. my_availability_slots expandit les règles récurrentes à la volée
--     sur la fenêtre demandée.
--  5. contacts_busy_between s'appuie désormais sur busy_share_grants
--     (l'ancien flag busy_share n'est plus consulté).
--
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0026-dispo-manuelle.sql)
-- ============================================================

-- ——— 1. Journée entière sur un créneau ponctuel ———
alter table public.manual_busy_slots
  add column if not exists all_day boolean not null default false;

-- ——— 2. Règles récurrentes hebdomadaires ———
create table if not exists public.recurring_busy_rules (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- weekdays : 0 = lundi, 1 = mardi, … 6 = dimanche (comme isodow - 1).
  weekdays int[] not null check (array_length(weekdays, 1) between 1 and 7),
  all_day boolean not null default false,
  start_time time,
  end_time time,
  starts_on date not null,
  ends_on date,
  note text,
  created_at timestamptz not null default now(),
  constraint recurring_range_ok check (ends_on is null or ends_on >= starts_on),
  constraint recurring_hours_ok check (
    (all_day and start_time is null and end_time is null)
    or (not all_day and start_time is not null and end_time is not null and end_time > start_time)
  )
);

create index if not exists recurring_busy_rules_user
  on public.recurring_busy_rules (user_id);

alter table public.recurring_busy_rules enable row level security;

drop policy if exists "recurring_busy_rules: chacun le sien"
  on public.recurring_busy_rules;
create policy "recurring_busy_rules: chacun le sien"
  on public.recurring_busy_rules for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Ajouter une règle récurrente.
create or replace function public.add_recurring_busy_rule(
  p_weekdays int[],
  p_all_day boolean,
  p_start_time time,
  p_end_time time,
  p_starts_on date,
  p_ends_on date,
  p_note text
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id bigint;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if p_weekdays is null or array_length(p_weekdays, 1) is null then
    raise exception 'Choisis au moins un jour de la semaine.';
  end if;
  if p_starts_on is null then
    raise exception 'Précise une date de début.';
  end if;
  if p_ends_on is not null and p_ends_on < p_starts_on then
    raise exception 'La date de fin doit être après la date de début.';
  end if;
  if v_note is not null and char_length(v_note) > 120 then
    raise exception 'La note est trop longue (120 caractères max).';
  end if;
  if not p_all_day and (p_start_time is null or p_end_time is null or p_end_time <= p_start_time) then
    raise exception 'Heures invalides.';
  end if;

  insert into recurring_busy_rules (
    user_id, weekdays, all_day, start_time, end_time, starts_on, ends_on, note
  ) values (
    v_uid, p_weekdays, p_all_day,
    case when p_all_day then null else p_start_time end,
    case when p_all_day then null else p_end_time end,
    p_starts_on, p_ends_on, v_note
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.remove_recurring_busy_rule(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  delete from recurring_busy_rules where id = p_id and user_id = auth.uid();
end;
$$;

-- ——— 3. Partage granulaire ———
create table if not exists public.busy_share_grants (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('everyone', 'contact', 'group')),
  target_id uuid,
  created_at timestamptz not null default now(),
  constraint valid_target check (
    (target_type = 'everyone' and target_id is null)
    or (target_type in ('contact', 'group') and target_id is not null)
  )
);

-- Unicité : au plus un enregistrement (user, type, cible) — via un index
-- qui traite null comme une valeur pour permettre le doublon check sur
-- l'entrée 'everyone'.
create unique index if not exists busy_share_grants_unique
  on public.busy_share_grants (
    user_id, target_type,
    coalesce(target_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists busy_share_grants_lookup
  on public.busy_share_grants (user_id, target_type);

alter table public.busy_share_grants enable row level security;

-- Chacun voit et modifie ses propres autorisations.
drop policy if exists "busy_share_grants: chacun les siennes"
  on public.busy_share_grants;
create policy "busy_share_grants: chacun les siennes"
  on public.busy_share_grants for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Migration douce : les personnes qui avaient busy_share = true reçoivent
-- une entrée 'everyone' pour conserver leur choix. Les autres restent
-- masquées (nouveau défaut).
insert into public.busy_share_grants (user_id, target_type, target_id)
  select cs.user_id, 'everyone', null
  from public.calendar_sources cs
  where cs.busy_share
    and not exists (
      select 1 from public.busy_share_grants g
      where g.user_id = cs.user_id and g.target_type = 'everyone'
    );

-- Lecture / écriture atomiques du partage (utilisé par le panneau UI).
create or replace function public.set_busy_share_mode(
  p_mode text,               -- 'none' | 'everyone' | 'custom'
  p_contact_ids uuid[],      -- utilisé uniquement si mode = 'custom'
  p_group_ids uuid[]         -- utilisé uniquement si mode = 'custom'
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if p_mode not in ('none', 'everyone', 'custom') then
    raise exception 'Mode invalide.';
  end if;

  -- On repart d'une ardoise vierge pour ce profil.
  delete from busy_share_grants where user_id = v_uid;

  if p_mode = 'everyone' then
    insert into busy_share_grants (user_id, target_type)
      values (v_uid, 'everyone');
  elsif p_mode = 'custom' then
    if p_contact_ids is not null and array_length(p_contact_ids, 1) > 0 then
      insert into busy_share_grants (user_id, target_type, target_id)
      select v_uid, 'contact', c
      from unnest(p_contact_ids) c
      where exists (select 1 from my_contacts() mc where mc.contact_id = c);
    end if;
    if p_group_ids is not null and array_length(p_group_ids, 1) > 0 then
      insert into busy_share_grants (user_id, target_type, target_id)
      select v_uid, 'group', g
      from unnest(p_group_ids) g
      where exists (
        select 1 from list_members m
        where m.list_id = g and m.user_id = v_uid
      );
    end if;
  end if;
end;
$$;

create or replace function public.my_busy_share()
returns table (mode text, contact_ids uuid[], group_ids uuid[])
language sql security definer set search_path = public stable as $$
  select
    case
      when exists (select 1 from busy_share_grants where user_id = auth.uid() and target_type = 'everyone')
        then 'everyone'
      when exists (select 1 from busy_share_grants where user_id = auth.uid())
        then 'custom'
      else 'none'
    end,
    coalesce((
      select array_agg(target_id) from busy_share_grants
      where user_id = auth.uid() and target_type = 'contact'
    ), '{}'::uuid[]),
    coalesce((
      select array_agg(target_id) from busy_share_grants
      where user_id = auth.uid() and target_type = 'group'
    ), '{}'::uuid[]);
$$;

-- ——— 4. Vue unifiée : ajout des règles récurrentes + all_day sur ponctuels ———
create or replace function public.my_availability_slots(
  p_from timestamptz, p_to timestamptz
)
returns table (
  source text,
  slot_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  label text
) language sql security definer set search_path = public stable as $$
  -- Agenda synchronisé (.ics).
  select 'ics'::text, null::text, bs.starts_at, bs.ends_at, null::text
    from busy_slots bs
    where bs.user_id = auth.uid()
      and bs.ends_at > p_from and bs.starts_at < p_to
  union all
  -- Événements Partants ? où j'ai dit « oui » — durée par défaut 2 h.
  select 'partant'::text, e.id::text,
    ((e.event_date::text || ' ' || e.event_time::text)::timestamp at time zone 'Europe/Paris'),
    ((e.event_date::text || ' ' || e.event_time::text)::timestamp at time zone 'Europe/Paris') + interval '2 hours',
    e.title
    from events e
    join rsvps r on r.event_id = e.id
      and r.user_id = auth.uid() and r.status = 'yes'
    where ((e.event_date::text || ' ' || e.event_time::text)::timestamp at time zone 'Europe/Paris') + interval '2 hours' > p_from
      and ((e.event_date::text || ' ' || e.event_time::text)::timestamp at time zone 'Europe/Paris') < p_to
  union all
  -- Créneaux ponctuels manuels (avec support « toute la journée »).
  select 'manual'::text, m.id::text,
    case when m.all_day
      then (date_trunc('day', m.starts_at at time zone 'Europe/Paris') at time zone 'Europe/Paris')
      else m.starts_at
    end,
    case when m.all_day
      then (date_trunc('day', m.starts_at at time zone 'Europe/Paris') + interval '1 day') at time zone 'Europe/Paris'
      else m.ends_at
    end,
    m.note
    from manual_busy_slots m
    where m.user_id = auth.uid()
      and m.ends_at > p_from and m.starts_at < p_to
  union all
  -- Règles récurrentes : on développe chaque jour de la fenêtre qui
  -- correspond aux weekdays et qui tombe dans [starts_on, ends_on].
  -- L'id du slot est préfixé « r- » pour distinguer côté client.
  select 'manual'::text, 'r-' || rr.id::text,
    case when rr.all_day
      then (d::date::text || ' 00:00')::timestamp at time zone 'Europe/Paris'
      else (d::date::text || ' ' || rr.start_time::text)::timestamp at time zone 'Europe/Paris'
    end,
    case when rr.all_day
      then ((d::date + 1)::text || ' 00:00')::timestamp at time zone 'Europe/Paris'
      else (d::date::text || ' ' || rr.end_time::text)::timestamp at time zone 'Europe/Paris'
    end,
    rr.note
    from recurring_busy_rules rr
    cross join lateral (
      select generate_series(
        greatest(rr.starts_on, (p_from at time zone 'Europe/Paris')::date - 1),
        least(
          coalesce(rr.ends_on, (p_to at time zone 'Europe/Paris')::date + 1),
          (p_to at time zone 'Europe/Paris')::date + 1
        ),
        interval '1 day'
      )::date as d
    ) days
    where rr.user_id = auth.uid()
      and ((extract(isodow from d)::int) - 1) = any (rr.weekdays)
  order by starts_at;
$$;

-- ——— 5. Refonte de contacts_busy_between avec partage granulaire ———
-- Une personne (moi, auth.uid()) voit la dispo d'un contact c si c a :
--   • une entrée 'everyone', OU
--   • une entrée 'contact' me ciblant, OU
--   • une entrée 'group' pour un groupe dont on est tous les deux membres.
-- Puis on regarde tous les créneaux occupés de c (ics + manuel + partant +
-- règles récurrentes).
create or replace function public.contacts_busy_between(
  p_contacts uuid[], p_from timestamptz, p_to timestamptz
)
returns table (contact_id uuid, busy boolean)
language sql security definer set search_path = public stable as $$
  with visibles as (
    select mc.contact_id as cid
    from my_contacts() mc
    where mc.contact_id = any (p_contacts)
      and (
        exists (
          select 1 from busy_share_grants g
          where g.user_id = mc.contact_id and g.target_type = 'everyone'
        )
        or exists (
          select 1 from busy_share_grants g
          where g.user_id = mc.contact_id
            and g.target_type = 'contact'
            and g.target_id = auth.uid()
        )
        or exists (
          select 1 from busy_share_grants g
          join list_members mine on mine.list_id = g.target_id and mine.user_id = auth.uid()
          join list_members them on them.list_id = g.target_id and them.user_id = mc.contact_id
          where g.user_id = mc.contact_id and g.target_type = 'group'
        )
      )
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
      where ((e.event_date::text || ' ' || e.event_time::text)::timestamp at time zone 'Europe/Paris') + interval '2 hours' > p_from
        and ((e.event_date::text || ' ' || e.event_time::text)::timestamp at time zone 'Europe/Paris') < p_to
    )
    or exists (
      select 1 from recurring_busy_rules rr
      cross join lateral (
        select generate_series(
          greatest(rr.starts_on, (p_from at time zone 'Europe/Paris')::date - 1),
          least(
            coalesce(rr.ends_on, (p_to at time zone 'Europe/Paris')::date + 1),
            (p_to at time zone 'Europe/Paris')::date + 1
          ),
          interval '1 day'
        )::date as d
      ) days
      where rr.user_id = v.cid
        and ((extract(isodow from d)::int) - 1) = any (rr.weekdays)
        and (
          case when rr.all_day
            then ((d::date + 1)::text || ' 00:00')::timestamp at time zone 'Europe/Paris'
            else (d::date::text || ' ' || rr.end_time::text)::timestamp at time zone 'Europe/Paris'
          end
        ) > p_from
        and (
          case when rr.all_day
            then (d::date::text || ' 00:00')::timestamp at time zone 'Europe/Paris'
            else (d::date::text || ' ' || rr.start_time::text)::timestamp at time zone 'Europe/Paris'
          end
        ) < p_to
    ) as busy
  from visibles v;
$$;
