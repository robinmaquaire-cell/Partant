-- ============================================================
-- Partants ? — Ajouter des membres à une liste depuis ses contacts
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0015-max-participants-illimite.sql)
-- ============================================================

-- Ajoute d'un coup plusieurs personnes à une liste (réservé à ses admins).
-- Renvoie le nombre de personnes effectivement ajoutées.
create or replace function public.add_members_to_list(p_list uuid, p_users uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_added integer;
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;
  if not public.is_list_admin(p_list) then
    raise exception 'Réservé aux admins de la liste.';
  end if;

  insert into list_members (list_id, user_id, role)
  select p_list, u, 'member'
  from unnest(coalesce(p_users, '{}'::uuid[])) as u
  where u <> v_uid
    and exists (select 1 from profiles p where p.id = u)
  on conflict (list_id, user_id) do nothing;

  get diagnostics v_added = row_count;
  return v_added;
end;
$$;
