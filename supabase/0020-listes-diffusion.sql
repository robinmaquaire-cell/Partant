-- ============================================================
-- Partants ? — Listes de diffusion (jalon R3)
-- Chaque utilisateur peut regrouper des contacts dans des listes privées
-- pour leur pousser un événement d'un seul geste, sans partager la liste
-- elle-même. Les destinataires reçoivent l'événement comme un event guest
-- (mécanisme existant du partage par lien).
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0019-pseudos-uniques.sql)
-- ============================================================

-- La liste de diffusion appartient à une seule personne (son propriétaire).
create table public.broadcast_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#2C7DA0' check (color ~ '^#[0-9a-fA-F]{6}$'),
  emoji text,
  created_at timestamptz not null default now()
);

create index broadcast_lists_owner on public.broadcast_lists (owner_id);

-- Qui est dans quelle liste. Un contact peut être dans plusieurs listes.
create table public.broadcast_list_members (
  list_id uuid not null references public.broadcast_lists (id) on delete cascade,
  contact_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, contact_id)
);

-- Sécurité : seul le propriétaire voit et modifie sa liste et ses membres.
alter table public.broadcast_lists enable row level security;
alter table public.broadcast_list_members enable row level security;

create policy "broadcast_lists: propriétaire"
  on public.broadcast_lists for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "broadcast_list_members: via propriétaire"
  on public.broadcast_list_members for all
  using (
    exists (
      select 1 from broadcast_lists bl
      where bl.id = list_id and bl.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from broadcast_lists bl
      where bl.id = list_id and bl.owner_id = auth.uid()
    )
  );

-- ——— Toutes mes listes, avec leur nombre de membres ———
create or replace function public.my_broadcast_lists()
returns table (id uuid, name text, color text, emoji text, member_count bigint)
language sql security definer set search_path = public stable as $$
  select bl.id, bl.name, bl.color, bl.emoji,
    (select count(*) from broadcast_list_members where list_id = bl.id)
  from broadcast_lists bl
  where bl.owner_id = auth.uid()
  order by lower(bl.name);
$$;

-- ——— Détail d'une liste : ses membres (ids uniquement, pour le formulaire) ———
create or replace function public.get_broadcast_list(p_id uuid)
returns table (
  id uuid, name text, color text, emoji text,
  member_contact_ids uuid[]
) language sql security definer set search_path = public stable as $$
  select bl.id, bl.name, bl.color, bl.emoji,
    coalesce((
      select array_agg(contact_id)
      from broadcast_list_members where list_id = bl.id
    ), '{}'::uuid[])
  from broadcast_lists bl
  where bl.id = p_id and bl.owner_id = auth.uid();
$$;

-- ——— Créer une liste + ses membres en une opération ———
-- On ne peut ajouter que des personnes qui sont VRAIMENT dans mes contacts
-- (garde-fou : sinon on pourrait spammer n'importe qui).
create or replace function public.create_broadcast_list(
  p_name text, p_color text, p_emoji text, p_contacts uuid[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_emoji text := nullif(trim(coalesce(p_emoji, '')), '');
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

  insert into broadcast_lists (owner_id, name, color, emoji)
  values (v_uid, v_name, p_color, v_emoji)
  returning id into v_id;

  if p_contacts is not null and array_length(p_contacts, 1) > 0 then
    insert into broadcast_list_members (list_id, contact_id)
    select v_id, c
    from unnest(p_contacts) c
    where exists (select 1 from my_contacts() mc where mc.contact_id = c);
  end if;

  return v_id;
end;
$$;

-- ——— Mettre à jour une liste (remplace complètement la sélection de membres) ———
create or replace function public.update_broadcast_list(
  p_id uuid, p_name text, p_color text, p_emoji text, p_contacts uuid[]
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_emoji text := nullif(trim(coalesce(p_emoji, '')), '');
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

  update broadcast_lists
    set name = v_name, color = p_color, emoji = v_emoji
    where id = p_id;

  delete from broadcast_list_members where list_id = p_id;
  if p_contacts is not null and array_length(p_contacts, 1) > 0 then
    insert into broadcast_list_members (list_id, contact_id)
    select p_id, c
    from unnest(p_contacts) c
    where exists (select 1 from my_contacts() mc where mc.contact_id = c);
  end if;
end;
$$;

-- ——— Supprimer une liste (les membres partent en cascade) ———
create or replace function public.delete_broadcast_list(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  delete from broadcast_lists where id = p_id and owner_id = auth.uid();
end;
$$;

-- ——— Pousser un événement à une liste de diffusion ———
-- Ajoute chaque membre à event_guests, comme s'ils avaient cliqué sur un
-- lien de partage. On ignore silencieusement ceux qui y sont déjà.
-- Renvoie le nombre de personnes ajoutées (utile pour un message de confirmation).
create or replace function public.push_event_to_broadcast_list(
  p_event uuid, p_list uuid
) returns integer language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if not exists (
    select 1 from broadcast_lists where id = p_list and owner_id = v_uid
  ) then
    raise exception 'Liste introuvable.';
  end if;
  if not exists (
    select 1 from events where id = p_event and created_by = v_uid
  ) then
    raise exception 'Événement introuvable.';
  end if;

  with inserted as (
    insert into event_guests (event_id, user_id)
    select p_event, m.contact_id
    from broadcast_list_members m
    where m.list_id = p_list and m.contact_id <> v_uid
    on conflict do nothing
    returning 1
  )
  select count(*)::int into v_count from inserted;

  return coalesce(v_count, 0);
end;
$$;
