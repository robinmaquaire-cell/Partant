-- ============================================================
-- Partants ? — Calendrier de disponibilité (étape 1 : lien .ics)
-- Chacun relie son agenda perso via son lien secret .ics. On n'en garde
-- QUE des créneaux « occupé » (début/fin), jamais les titres ni les lieux.
-- Les contacts peuvent voir la grille occupé/libre, jamais le détail.
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0016-ajout-membres-contacts.sql)
-- ============================================================

-- La source d'agenda de chaque personne. Pour l'instant un seul type : un
-- lien .ics (Google, Apple, Outlook exposent tous un lien secret .ics).
create table public.calendar_sources (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  kind text not null default 'ics' check (kind in ('ics')),
  ics_url text,
  last_synced_at timestamptz,
  last_error text, -- message si le dernier rafraîchissement a échoué
  busy_share boolean not null default true, -- partager ma dispo à mes contacts
  created_at timestamptz not null default now()
);

alter table public.calendar_sources enable row level security;

create policy "agenda: le mien"
  on public.calendar_sources for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Les créneaux occupés, sans aucun détail. Remplis par le rafraîchissement
-- (côté serveur, clé service_role) à partir du lien .ics.
create table public.busy_slots (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null
);

create index busy_slots_user_time
  on public.busy_slots (user_id, starts_at, ends_at);

alter table public.busy_slots enable row level security;

-- Chacun peut relire SES propres créneaux (pour voir sa grille dans le profil).
-- La lecture par un contact passe par la fonction contact_busy ci-dessous.
-- L'écriture n'a pas de policy : seul le serveur (service_role) remplit la
-- table, jamais le navigateur.
create policy "créneaux: les miens en lecture"
  on public.busy_slots for select using (user_id = auth.uid());

-- ——— Voir la grille de dispo d'un contact ———
-- Renvoie ses créneaux occupés dans une fenêtre, UNIQUEMENT si :
--   • cette personne fait partie de mes contacts (my_contacts), et
--   • elle a laissé le partage activé (busy_share).
-- Jamais de titre ni de lieu : seulement début/fin.
create or replace function public.contact_busy(
  p_contact uuid, p_from timestamptz, p_to timestamptz
)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql security definer set search_path = public stable as $$
  select bs.starts_at, bs.ends_at
  from busy_slots bs
  join calendar_sources cs on cs.user_id = bs.user_id
  where bs.user_id = p_contact
    and cs.busy_share
    and bs.ends_at > p_from
    and bs.starts_at < p_to
    and exists (
      select 1 from my_contacts() mc where mc.contact_id = p_contact
    )
  order by bs.starts_at;
$$;

-- ——— Est-ce que ces contacts sont occupés sur une plage donnée ? ———
-- Pour la création d'événement : pour chaque personne visible (contact qui
-- partage), dit si elle a au moins un créneau qui chevauche [p_from, p_to].
-- Les personnes sans agenda relié, ou qui ne partagent pas, ou hors de mes
-- contacts, ne renvoient rien (statut « inconnu » côté application).
create or replace function public.contacts_busy_between(
  p_contacts uuid[], p_from timestamptz, p_to timestamptz
)
returns table (contact_id uuid, busy boolean)
language sql security definer set search_path = public stable as $$
  with visibles as (
    select mc.contact_id as cid
    from my_contacts() mc
    join calendar_sources cs on cs.user_id = mc.contact_id and cs.busy_share
    where mc.contact_id = any (p_contacts)
      and cs.ics_url is not null
  )
  select v.cid,
    exists (
      select 1 from busy_slots bs
      where bs.user_id = v.cid
        and bs.ends_at > p_from and bs.starts_at < p_to
    ) as busy
  from visibles v;
$$;
