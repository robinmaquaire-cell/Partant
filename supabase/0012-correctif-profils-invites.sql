-- ============================================================
-- Partant ? — CORRECTIF : pseudo/photo des personnes arrivées par
-- un lien d'invitation d'événement (elles s'affichaient en « ? »)
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- ============================================================

-- « shares_event_with(p) » décide si je peux lire le profil (pseudo, photo)
-- d'une autre personne p, parce que nous partageons un événement.
-- Elle oubliait les ORGANISATEURS : un organisateur ne partage un événement
-- « sur invitation » (sans liste) ni via une liste ni via event_guests, donc
-- il ne pouvait pas voir les invités — et les invités ne le voyaient pas.
-- On ajoute event_organizers des deux côtés.
create or replace function public.shares_event_with(p uuid)
returns boolean language sql security definer set search_path = public stable as $$
  with mine as (
    select el.event_id from event_lists el
    join list_members m on m.list_id = el.list_id and m.user_id = auth.uid()
    union
    select g.event_id from event_guests g where g.user_id = auth.uid()
    union
    select o.event_id from event_organizers o where o.user_id = auth.uid()
  ), theirs as (
    select el.event_id from event_lists el
    join list_members m on m.list_id = el.list_id and m.user_id = p
    union
    select g.event_id from event_guests g where g.user_id = p
    union
    select o.event_id from event_organizers o where o.user_id = p
  )
  select exists (select 1 from mine join theirs using (event_id));
$$;
