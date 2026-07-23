-- ============================================================
-- Partant ? — Notifications push (application installée sur le téléphone)
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0010-correctif-materiel-individuel.sql)
-- ============================================================

-- Un abonnement = un appareil qui accepte de recevoir les notifications.
-- Une même personne peut en avoir plusieurs (téléphone, ordinateur…).
create table public.push_subscriptions (
  endpoint text primary key,          -- adresse unique fournie par le navigateur
  user_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null,               -- clés de chiffrement du navigateur
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_par_personne
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Chacun ne gère que les abonnements de ses propres appareils.
-- (l'envoi, lui, se fait côté serveur avec la clé service_role, qui
-- ignore ces règles et peut donc lire tous les abonnements.)
create policy "push: lecture de mes appareils"
  on public.push_subscriptions for select using (user_id = auth.uid());
create policy "push: j'enregistre mon appareil"
  on public.push_subscriptions for insert with check (user_id = auth.uid());
create policy "push: je mets à jour mon appareil"
  on public.push_subscriptions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push: je retire mon appareil"
  on public.push_subscriptions for delete using (user_id = auth.uid());
