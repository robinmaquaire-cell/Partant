-- ============================================================
-- Partant ? — Jalon M1 : table des profils + sécurité (RLS)
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- ============================================================

-- Table des profils : 1 ligne par utilisateur, liée au compte d'authentification.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text not null default '',
  contact_mode text not null default 'email'
    check (contact_mode in ('email', 'whatsapp', 'sms')),
  contact text not null default '',
  created_at timestamptz not null default now()
);

-- Sécurité ligne par ligne : chacun ne voit et ne modifie que son propre profil.
alter table public.profiles enable row level security;

create policy "profiles: lire son profil"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "profiles: modifier son profil"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- À la création d'un compte (1er clic sur le lien magique), on crée
-- automatiquement le profil avec l'e-mail comme contact par défaut.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, pseudo, contact_mode, contact)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'pseudo', ''),
    'email',
    coalesce(new.email, '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
