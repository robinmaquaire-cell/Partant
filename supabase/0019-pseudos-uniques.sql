-- ============================================================
-- Partants ? — Un pseudo unique par personne
-- On règle d'abord les doublons existants, puis on impose l'unicité
-- (insensible à la casse et aux espaces). Les pseudos vides restent
-- autorisés en multiple (comptes qui n'ont pas encore choisi de pseudo).
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0018-tags-evenement.sql)
-- ============================================================

-- 1. Renommer les doublons existants : on garde le plus ancien tel quel,
--    les suivants reçoivent un suffixe numérique libre (« Paul », « Paul2 »…).
do $$
declare
  r record;
  n int;
  base text;
  newp text;
begin
  for r in
    select id, pseudo,
      row_number() over (
        partition by lower(btrim(pseudo)) order by created_at, id
      ) as rn
    from public.profiles
    where btrim(pseudo) <> ''
  loop
    if r.rn > 1 then
      base := left(btrim(r.pseudo), 38);
      n := r.rn;
      loop
        newp := base || n::text;
        exit when not exists (
          select 1 from public.profiles p2
          where lower(btrim(p2.pseudo)) = lower(newp)
        );
        n := n + 1;
      end loop;
      update public.profiles set pseudo = newp where id = r.id;
    end if;
  end loop;
end $$;

-- 2. Unicité garantie côté base (le vrai garde-fou, même en cas de course).
--    Index partiel : ne s'applique qu'aux pseudos non vides.
create unique index if not exists profiles_pseudo_unique
  on public.profiles (lower(btrim(pseudo)))
  where btrim(pseudo) <> '';

-- 3. À l'inscription : si le pseudo demandé est déjà pris (ou vide), on crée
--    le compte avec un pseudo vide plutôt que d'échouer — la personne
--    choisira un pseudo libre sur sa page profil (redirection déjà en place).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_req text := btrim(coalesce(new.raw_user_meta_data ->> 'pseudo', ''));
begin
  if v_req <> '' and exists (
    select 1 from public.profiles where lower(btrim(pseudo)) = lower(v_req)
  ) then
    v_req := '';
  end if;
  insert into public.profiles (id, pseudo, contact_mode, contact)
  values (new.id, v_req, 'email', coalesce(new.email, ''));
  return new;
end;
$$;

-- 4. Vérifier si un pseudo est disponible (utilisé par le profil et
--    l'inscription pour prévenir tout de suite). Ignore mon propre compte,
--    pour que « enregistrer » sans changer de pseudo reste possible.
create or replace function public.pseudo_available(p_pseudo text)
returns boolean language sql security definer set search_path = public stable as $$
  select btrim(coalesce(p_pseudo, '')) <> '' and not exists (
    select 1 from public.profiles
    where lower(btrim(pseudo)) = lower(btrim(p_pseudo))
      and id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
$$;

grant execute on function public.pseudo_available(text) to anon, authenticated;
