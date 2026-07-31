-- ============================================================
-- Partants ? — Type de compte perso / pro (jalon R5)
-- Prépare le terrain pour un compte professionnel événementiel :
--   • perso (par défaut) : le compte de tout le monde aujourd'hui
--   • pro : réservé aux organisateurs qui proposent des activités
--           récurrentes. À ce stade, aucune fonctionnalité pro n'est
--           encore débloquée ; c'est juste le drapeau qui prépare
--           les prochains jalons (catalogue, page publique, etc.).
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0022-invitation-contacts.sql)
-- ============================================================

alter table public.profiles
  add column if not exists account_type text not null default 'perso'
    check (account_type in ('perso', 'pro'));

-- Fonction pour basculer son propre type de compte.
create or replace function public.set_account_type(p_type text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if p_type not in ('perso', 'pro') then
    raise exception 'Type de compte invalide.';
  end if;
  update profiles set account_type = p_type where id = v_uid;
end;
$$;
