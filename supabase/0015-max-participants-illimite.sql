-- ============================================================
-- Partants ? — Nombre max de participants facultatif (0 = illimité)
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0014-contacts.sql)
-- ============================================================

-- 0 signifie « pas de limite ». On autorise donc 0 à 1000.
alter table public.events
  drop constraint if exists events_max_participants_check;
alter table public.events
  add constraint events_max_participants_check
  check (max_participants between 0 and 1000);

-- Contrôle des champs à la création/modification : max entre 0 et 1000.
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
  if p_max is null or p_max not between 0 and 1000 then
    raise exception 'Le nombre max de participants doit être entre 0 (illimité) et 1000.';
  end if;
end;
$$;

-- Répondre « Partant ! » : la limite de places est ignorée quand max = 0.
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
    -- max = 0 : aucune limite.
    if v_max > 0 and v_yes >= v_max then
      raise exception 'Cet événement est déjà complet.';
    end if;
  end if;

  insert into rsvps (event_id, user_id, status)
  values (p_event, v_uid, p_status)
  on conflict (event_id, user_id)
  do update set status = excluded.status, updated_at = now();
end;
$$;
