-- ============================================================
-- Partants ? — Partage d'un événement déjà créé (jalon R6)
-- Depuis le bouton « Partager » de la page d'un événement existant,
-- l'organisateur peut désormais l'attacher à un nouveau groupe, à
-- une liste de diffusion ou à des contacts (les RPC pour ces deux
-- derniers existent déjà : push_event_to_broadcast_list et
-- invite_contacts_to_event, on les réutilise).
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0023-compte-pro.sql)
-- ============================================================

-- ——— Attacher un événement existant à un groupe ———
-- Réservé au créateur de l'événement, et uniquement pour un groupe
-- dont il est membre. Silencieux si l'événement est déjà attaché.
create or replace function public.add_event_to_list(
  p_event uuid, p_list uuid
) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if not exists (
    select 1 from events where id = p_event and created_by = v_uid
  ) then
    raise exception 'Événement introuvable.';
  end if;
  if not exists (
    select 1 from list_members where list_id = p_list and user_id = v_uid
  ) then
    raise exception 'Tu n''es pas membre de ce groupe.';
  end if;
  insert into event_lists (event_id, list_id)
  values (p_event, p_list)
  on conflict do nothing;
end;
$$;

-- ——— Détacher un événement d'un groupe ———
-- Réservé au créateur.
create or replace function public.remove_event_from_list(
  p_event uuid, p_list uuid
) returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if not exists (
    select 1 from events where id = p_event and created_by = v_uid
  ) then
    raise exception 'Événement introuvable.';
  end if;
  delete from event_lists where event_id = p_event and list_id = p_list;
end;
$$;

-- ——— Membres de plusieurs groupes en une seule requête ———
-- Utilisé pour calculer « N libres / M » par groupe côté modale de
-- partage. Renvoie uniquement les member_ids des groupes dont je suis
-- moi-même membre (sécurité).
create or replace function public.group_member_ids(p_lists uuid[])
returns table (list_id uuid, user_id uuid)
language sql security definer set search_path = public stable as $$
  select m.list_id, m.user_id
  from list_members m
  where m.list_id = any (coalesce(p_lists, '{}'::uuid[]))
    and exists (
      select 1 from list_members mine
      where mine.list_id = m.list_id and mine.user_id = auth.uid()
    );
$$;
