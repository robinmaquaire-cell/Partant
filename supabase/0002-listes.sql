-- ============================================================
-- Partant ? — Jalon M2 : listes de diffusion, membres, invitations
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- ============================================================

-- Les listes de diffusion.
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#2C7DA0' check (color ~ '^#[0-9a-fA-F]{6}$'),
  members_visible boolean not null default true,
  created_at timestamptz not null default now()
);

-- Qui est membre de quelle liste (role admin ou member).
create table public.list_members (
  list_id uuid not null references public.lists (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

-- Les liens d'invitation (token aléatoire dans l'URL).
create table public.list_invites (
  token text primary key,
  list_id uuid not null references public.lists (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  revoked boolean not null default false
);

-- Fonctions utilitaires (security definer = évite que les règles se
-- rappellent elles-mêmes en boucle).
create or replace function public.is_list_member(l uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from list_members where list_id = l and user_id = auth.uid()
  );
$$;

create or replace function public.is_list_admin(l uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from list_members
    where list_id = l and user_id = auth.uid() and role = 'admin'
  );
$$;

-- Sécurité ligne par ligne.
alter table public.lists enable row level security;
alter table public.list_members enable row level security;
alter table public.list_invites enable row level security;

create policy "lists: membres lisent"
  on public.lists for select using (public.is_list_member(id));
create policy "lists: admins modifient"
  on public.lists for update
  using (public.is_list_admin(id)) with check (public.is_list_admin(id));
create policy "lists: admins suppriment"
  on public.lists for delete using (public.is_list_admin(id));

-- Membres visibles : soi-même toujours, tout pour les admins,
-- les autres seulement si la liste est en « membres visibles ».
create policy "members: lecture selon confidentialité"
  on public.list_members for select using (
    user_id = auth.uid()
    or public.is_list_admin(list_id)
    or (
      public.is_list_member(list_id)
      and exists (select 1 from lists where id = list_id and members_visible)
    )
  );
create policy "members: quitter ou être retiré par un admin"
  on public.list_members for delete using (
    user_id = auth.uid() or public.is_list_admin(list_id)
  );
create policy "members: promotion par un admin"
  on public.list_members for update
  using (public.is_list_admin(list_id)) with check (public.is_list_admin(list_id));

create policy "invites: membres lisent"
  on public.list_invites for select using (public.is_list_member(list_id));
create policy "invites: admins créent"
  on public.list_invites for insert
  with check (public.is_list_admin(list_id) and created_by = auth.uid());
create policy "invites: admins révoquent"
  on public.list_invites for update
  using (public.is_list_admin(list_id)) with check (public.is_list_admin(list_id));

-- Les pseudos des co-membres deviennent lisibles (nécessaire pour
-- afficher « Léa, Marco… ») — dans le respect des règles ci-dessus.
create policy "profiles: pseudos des co-membres"
  on public.profiles for select using (
    exists (
      select 1
      from list_members me
      join list_members them on them.list_id = me.list_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
  );

-- ——— Opérations « guichet » (RPC), avec leurs propres contrôles ———

-- Créer une liste : la liste + moi en admin + un lien d'invitation.
create or replace function public.create_list(
  p_name text, p_color text, p_members_visible boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;
  if p_name is null or char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 60 then
    raise exception 'Le nom de la liste doit faire entre 1 et 60 caractères.';
  end if;
  if p_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'Couleur invalide.';
  end if;

  insert into lists (name, color, members_visible)
  values (trim(p_name), p_color, p_members_visible)
  returning id into v_id;

  insert into list_members (list_id, user_id, role)
  values (v_id, v_uid, 'admin');

  insert into list_invites (token, list_id, created_by)
  values (replace(gen_random_uuid()::text, '-', ''), v_id, v_uid);

  return v_id;
end;
$$;

-- Mes listes, avec le nombre de membres (compté côté serveur).
create or replace function public.my_lists()
returns table (
  id uuid, name text, color text, members_visible boolean,
  role text, member_count bigint
) language sql security definer set search_path = public stable as $$
  select l.id, l.name, l.color, l.members_visible, my.role,
    (select count(*) from list_members m where m.list_id = l.id)
  from lists l
  join list_members my on my.list_id = l.id and my.user_id = auth.uid()
  order by l.created_at;
$$;

-- Infos d'une invitation (accessible sans compte, pour la page d'accueil).
create or replace function public.get_invite(p_token text)
returns table (
  list_id uuid, list_name text, list_color text,
  member_count bigint, already_member boolean
) language sql security definer set search_path = public stable as $$
  select l.id, l.name, l.color,
    (select count(*) from list_members m where m.list_id = l.id),
    exists (
      select 1 from list_members m
      where m.list_id = l.id and m.user_id = auth.uid()
    )
  from list_invites i
  join lists l on l.id = i.list_id
  where i.token = p_token and not i.revoked;
$$;

-- Rejoindre une liste via un lien d'invitation valide.
create or replace function public.join_list(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_list uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;
  select i.list_id into v_list
  from list_invites i where i.token = p_token and not i.revoked;
  if v_list is null then
    raise exception 'Cette invitation est invalide ou a été révoquée.';
  end if;
  insert into list_members (list_id, user_id, role)
  values (v_list, v_uid, 'member')
  on conflict (list_id, user_id) do nothing;
  return v_list;
end;
$$;

-- Ajout manuel par un admin, à partir d'une adresse e-mail déjà inscrite.
create or replace function public.add_member_by_email(p_list uuid, p_email text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  if not public.is_list_admin(p_list) then
    raise exception 'Réservé aux admins de la liste.';
  end if;
  select id into v_user from auth.users
  where lower(email) = lower(trim(p_email));
  if v_user is null then
    return 'introuvable';
  end if;
  insert into list_members (list_id, user_id)
  values (p_list, v_user)
  on conflict (list_id, user_id) do nothing;
  return 'ok';
end;
$$;
