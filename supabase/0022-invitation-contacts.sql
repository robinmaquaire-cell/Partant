-- ============================================================
-- Partants ? — Invitation contact par contact (jalon R4)
-- Fonction RPC pour que l'organisateur d'un événement ajoute en une
-- fois plusieurs de ses contacts comme event_guest (mécanisme du
-- partage par lien, mais poussé par l'organisateur). Garde-fous :
--   • l'événement doit m'appartenir (created_by = moi)
--   • chaque contact doit vraiment être dans mes contacts
-- Renvoie le nombre de personnes réellement ajoutées.
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0021-listes-diffusion-publiques.sql)
-- ============================================================

create or replace function public.invite_contacts_to_event(
  p_event uuid, p_contacts uuid[]
) returns integer language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if not exists (
    select 1 from events where id = p_event and created_by = v_uid
  ) then
    raise exception 'Événement introuvable.';
  end if;
  if p_contacts is null or array_length(p_contacts, 1) is null then
    return 0;
  end if;

  with inserted as (
    insert into event_guests (event_id, user_id)
    select p_event, c
    from unnest(p_contacts) c
    where c <> v_uid
      and exists (select 1 from my_contacts() mc where mc.contact_id = c)
    on conflict do nothing
    returning 1
  )
  select count(*)::int into v_count from inserted;

  return coalesce(v_count, 0);
end;
$$;
