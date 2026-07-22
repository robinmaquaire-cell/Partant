-- ============================================================
-- Partant ? — La discussion d'un événement (chat)
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0008-logos-calendrier-synchro.sql)
-- ============================================================

create table public.event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index event_messages_par_evenement
  on public.event_messages (event_id, created_at);

alter table public.event_messages enable row level security;

-- Tous ceux qui voient l'événement lisent la discussion…
create policy "messages: lecture"
  on public.event_messages for select
  using (public.can_see_event(event_id) or public.is_event_organizer(event_id));

-- …et peuvent y écrire, en leur propre nom.
create policy "messages: écriture"
  on public.event_messages for insert with check (
    user_id = auth.uid() and public.can_see_event(event_id)
  );

-- Chacun retire ses messages ; les organisateurs peuvent modérer.
create policy "messages: suppression"
  on public.event_messages for delete using (
    user_id = auth.uid() or public.is_event_organizer(event_id)
  );

-- Diffusion en direct : les nouveaux messages arrivent sans recharger la page.
alter publication supabase_realtime add table public.event_messages;
