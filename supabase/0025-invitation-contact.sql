-- ============================================================
-- Partants ? — Lien d'invitation contact (jalon R7)
-- Chaque profil porte un jeton stable qui compose son lien perso
-- « /c/<token> ». N'importe qui ouvrant ce lien peut devenir
-- contact bilatéral : les deux personnes apparaissent dans leur
-- carnet respectif après l'acceptation.
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0024-partage-existant.sql)
-- ============================================================

alter table public.profiles
  add column if not exists contact_token text;

-- Générer un jeton pour tous les profils existants qui n'en ont pas.
update public.profiles
  set contact_token = replace(gen_random_uuid()::text, '-', '')
  where contact_token is null;

-- Unicité + trigger : chaque nouveau profil aura son jeton.
create unique index if not exists profiles_contact_token_key
  on public.profiles (contact_token);

create or replace function public.profiles_set_contact_token()
returns trigger language plpgsql as $$
begin
  if new.contact_token is null then
    new.contact_token := replace(gen_random_uuid()::text, '-', '');
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_contact_token_default on public.profiles;
create trigger profiles_contact_token_default
  before insert on public.profiles
  for each row execute function public.profiles_set_contact_token();

-- ——— Mon jeton (le créer s'il n'existe pas — sécurité ceinture-bretelle) ———
create or replace function public.get_contact_invite_token()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  select contact_token into v_token from profiles where id = v_uid;
  if v_token is null then
    v_token := replace(gen_random_uuid()::text, '-', '');
    update profiles set contact_token = v_token where id = v_uid;
  end if;
  return v_token;
end;
$$;

-- ——— Régénérer mon jeton (l'ancien lien cesse de fonctionner) ———
create or replace function public.regenerate_contact_invite_token()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  v_token := replace(gen_random_uuid()::text, '-', '');
  update profiles set contact_token = v_token where id = v_uid;
  return v_token;
end;
$$;

-- ——— Infos publiques d'un profil à partir de son jeton ———
-- Accessible sans compte (page d'atterrissage /c/[token]).
-- Renvoie aussi is_already_contact si celui qui appelle est connecté.
create or replace function public.resolve_contact_invite(p_token text)
returns table (
  user_id uuid, pseudo text, avatar_url text,
  is_already_contact boolean, is_me boolean
) language sql security definer set search_path = public stable as $$
  select p.id, p.pseudo, p.avatar_url,
    exists (
      select 1 from contact_links cl
      where cl.user_id = auth.uid()
        and cl.contact_id = p.id
        and coalesce(cl.removed, false) = false
        and (coalesce(cl.manual, false) or true) -- inclut aussi les rencontrés
    ),
    p.id = auth.uid()
  from profiles p
  where p.contact_token = p_token;
$$;

-- ——— Accepter l'invitation : ajoute le lien bilatéral ———
-- Insertions manuelles dans contact_links des deux côtés.
create or replace function public.accept_contact_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_other uuid;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;

  select id into v_other from profiles where contact_token = p_token;
  if v_other is null then
    raise exception 'Ce lien est invalide ou a été révoqué.';
  end if;
  if v_other = v_uid then
    raise exception 'C''est ton propre lien.';
  end if;

  -- Je l'ajoute à mes contacts.
  insert into contact_links (user_id, contact_id, manual, removed)
  values (v_uid, v_other, true, false)
  on conflict (user_id, contact_id)
  do update set manual = true, removed = false;

  -- Il me contient aussi (les deux sens : symétrie du carnet).
  insert into contact_links (user_id, contact_id, manual, removed)
  values (v_other, v_uid, true, false)
  on conflict (user_id, contact_id)
  do update set manual = true, removed = false;

  return v_other;
end;
$$;
