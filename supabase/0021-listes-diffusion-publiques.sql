-- ============================================================
-- Partants ? — Listes de diffusion publiques (jalon R3.1)
-- Une liste peut désormais être publique : chacun peut la rejoindre
-- ou la quitter librement via son lien /l/[id]. Elle reste une liste
-- de diffusion (pas de collaboration) : seul le propriétaire y pousse
-- des événements.
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0020-listes-diffusion.sql)
-- ============================================================

alter table public.broadcast_lists
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private', 'public'));

-- Les fonctions dont on change le type de retour ou la signature doivent
-- être supprimées avant d'être recréées (Postgres n'autorise pas CREATE
-- OR REPLACE dans ces cas). L'ordre est libre, les dépendances sont
-- reconstruites plus bas.
drop function if exists public.my_broadcast_lists();
drop function if exists public.get_broadcast_list(uuid);
drop function if exists public.create_broadcast_list(text, text, text, uuid[]);
drop function if exists public.update_broadcast_list(uuid, text, text, text, uuid[]);

-- Qui a ajouté cette personne à la liste ? null = elle s'est inscrite
-- elle-même via /l/[id]. Sinon, c'est le propriétaire qui l'a piochée
-- parmi ses contacts. Sert à distinguer les deux flux quand on modifie
-- la liste : le propriétaire ne peut remplacer que les gens qu'il a
-- ajoutés lui-même, jamais les auto-inscrits.
alter table public.broadcast_list_members
  add column if not exists added_by uuid
    references public.profiles (id) on delete set null;

-- ——— Lecture des listes publiques ———
-- N'importe qui de connecté peut voir les infos d'une liste publique
-- (nom, couleur, emoji). Complète la policy « propriétaire ».
drop policy if exists "broadcast_lists: publiques visibles"
  on public.broadcast_lists;
create policy "broadcast_lists: publiques visibles"
  on public.broadcast_lists for select
  using (visibility = 'public');

-- ——— Je vois toujours ma propre ligne (utile pour savoir si je suis
-- membre d'une liste publique). La policy « via propriétaire » reste
-- en place pour l'owner.
drop policy if exists "broadcast_list_members: ma propre ligne"
  on public.broadcast_list_members;
create policy "broadcast_list_members: ma propre ligne"
  on public.broadcast_list_members for select
  using (contact_id = auth.uid());

-- ——— Je peux me retirer moi-même de n'importe quelle liste ———
drop policy if exists "broadcast_list_members: je me retire"
  on public.broadcast_list_members;
create policy "broadcast_list_members: je me retire"
  on public.broadcast_list_members for delete
  using (contact_id = auth.uid());

-- L'insertion de ma propre ligne dans une liste publique passe par la
-- RPC join_broadcast_list (security definer), pas par une policy.

-- ——— Rejoindre une liste publique ———
create or replace function public.join_broadcast_list(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if not exists (
    select 1 from broadcast_lists
    where id = p_id and visibility = 'public'
  ) then
    raise exception 'Cette liste n''existe pas ou n''est pas publique.';
  end if;
  insert into broadcast_list_members (list_id, contact_id, added_by)
  values (p_id, v_uid, null)  -- null = auto-inscription
  on conflict do nothing;
end;
$$;

-- ——— Quitter une liste (retire ma propre ligne) ———
create or replace function public.leave_broadcast_list(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  delete from broadcast_list_members
  where list_id = p_id and contact_id = v_uid;
end;
$$;

-- ——— Infos publiques d'une liste (pour la page /l/[id]) ———
create or replace function public.get_public_broadcast_list(p_id uuid)
returns table (
  id uuid, name text, color text, emoji text,
  owner_id uuid, owner_pseudo text,
  member_count bigint, is_member boolean, is_owner boolean
) language sql security definer set search_path = public stable as $$
  select bl.id, bl.name, bl.color, bl.emoji,
    bl.owner_id,
    (select pseudo from profiles where id = bl.owner_id),
    (select count(*) from broadcast_list_members where list_id = bl.id),
    exists (
      select 1 from broadcast_list_members
      where list_id = bl.id and contact_id = auth.uid()
    ),
    bl.owner_id = auth.uid()
  from broadcast_lists bl
  where bl.id = p_id and bl.visibility = 'public';
$$;

-- ——— Mes abonnements : listes publiques d'autres personnes ———
create or replace function public.my_broadcast_subscriptions()
returns table (
  id uuid, name text, color text, emoji text,
  owner_pseudo text
) language sql security definer set search_path = public stable as $$
  select bl.id, bl.name, bl.color, bl.emoji,
    (select pseudo from profiles where id = bl.owner_id)
  from broadcast_lists bl
  join broadcast_list_members m on m.list_id = bl.id
  where m.contact_id = auth.uid()
    and bl.owner_id <> auth.uid()
  order by lower(bl.name);
$$;

-- ——— Mes listes : renvoyer aussi visibility ———
create or replace function public.my_broadcast_lists()
returns table (
  id uuid, name text, color text, emoji text,
  visibility text, member_count bigint
) language sql security definer set search_path = public stable as $$
  select bl.id, bl.name, bl.color, bl.emoji, bl.visibility,
    (select count(*) from broadcast_list_members where list_id = bl.id)
  from broadcast_lists bl
  where bl.owner_id = auth.uid()
  order by lower(bl.name);
$$;

-- ——— get_broadcast_list : ne renvoie que les contacts ajoutés par
-- l'owner (pas les auto-inscrits, qui n'ont pas à s'afficher comme
-- cochables dans le formulaire d'édition) ———
create or replace function public.get_broadcast_list(p_id uuid)
returns table (
  id uuid, name text, color text, emoji text,
  visibility text, member_contact_ids uuid[]
) language sql security definer set search_path = public stable as $$
  select bl.id, bl.name, bl.color, bl.emoji, bl.visibility,
    coalesce((
      select array_agg(contact_id)
      from broadcast_list_members
      where list_id = bl.id and added_by = bl.owner_id
    ), '{}'::uuid[])
  from broadcast_lists bl
  where bl.id = p_id and bl.owner_id = auth.uid();
$$;

-- ——— create_broadcast_list : accepter visibility, marquer added_by ———
create or replace function public.create_broadcast_list(
  p_name text, p_color text, p_emoji text,
  p_visibility text, p_contacts uuid[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_emoji text := nullif(trim(coalesce(p_emoji, '')), '');
  v_vis text := coalesce(p_visibility, 'private');
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'Le nom doit faire entre 1 et 60 caractères.';
  end if;
  if p_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'Couleur invalide.';
  end if;
  if v_emoji is not null and char_length(v_emoji) > 8 then
    raise exception 'Emoji invalide.';
  end if;
  if v_vis not in ('private', 'public') then
    raise exception 'Visibilité invalide.';
  end if;

  insert into broadcast_lists (owner_id, name, color, emoji, visibility)
  values (v_uid, v_name, p_color, v_emoji, v_vis)
  returning id into v_id;

  if p_contacts is not null and array_length(p_contacts, 1) > 0 then
    insert into broadcast_list_members (list_id, contact_id, added_by)
    select v_id, c, v_uid
    from unnest(p_contacts) c
    where exists (select 1 from my_contacts() mc where mc.contact_id = c);
  end if;

  return v_id;
end;
$$;

-- ——— update_broadcast_list : ne touche que les membres ajoutés par
-- l'owner (les auto-inscrits d'une liste publique restent) ———
create or replace function public.update_broadcast_list(
  p_id uuid, p_name text, p_color text, p_emoji text,
  p_visibility text, p_contacts uuid[]
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_emoji text := nullif(trim(coalesce(p_emoji, '')), '');
  v_vis text := coalesce(p_visibility, 'private');
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if not exists (
    select 1 from broadcast_lists where id = p_id and owner_id = v_uid
  ) then
    raise exception 'Liste introuvable.';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'Le nom doit faire entre 1 et 60 caractères.';
  end if;
  if p_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'Couleur invalide.';
  end if;
  if v_emoji is not null and char_length(v_emoji) > 8 then
    raise exception 'Emoji invalide.';
  end if;
  if v_vis not in ('private', 'public') then
    raise exception 'Visibilité invalide.';
  end if;

  update broadcast_lists
    set name = v_name, color = p_color, emoji = v_emoji, visibility = v_vis
    where id = p_id;

  if p_contacts is not null then
    -- Ne toucher qu'aux gens que J'AI ajoutés (added_by = moi).
    -- Les auto-inscrits (added_by is null) sont préservés.
    delete from broadcast_list_members
      where list_id = p_id and added_by = v_uid;
    if array_length(p_contacts, 1) > 0 then
      insert into broadcast_list_members (list_id, contact_id, added_by)
      select p_id, c, v_uid
      from unnest(p_contacts) c
      where exists (select 1 from my_contacts() mc where mc.contact_id = c)
      on conflict do nothing;
    end if;
  end if;
end;
$$;

-- ——— Corriger les lignes existantes créées par 0020 :
-- elles ont added_by = null (défaut) mais viennent en fait du propriétaire.
-- On les rattrape pour préserver la sémantique « auto-inscrit vs manuel ».
update public.broadcast_list_members m
  set added_by = bl.owner_id
  from public.broadcast_lists bl
  where bl.id = m.list_id and m.added_by is null;
