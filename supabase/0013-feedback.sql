-- ============================================================
-- Partants ? — Retours des utilisateurs (feedback texte / audio / images)
-- À coller tel quel dans Supabase : SQL Editor → New query → Run
-- (à exécuter APRÈS 0012-correctif-profils-invites.sql)
-- ============================================================

-- Un retour laissé par un utilisateur, à analyser ensuite pour décider
-- des prochaines évolutions.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 4000),
  audio_path text,                       -- fichier audio dans le bucket « feedback »
  image_paths text[] not null default '{}',
  page text,                             -- l'écran d'où le retour a été envoyé
  user_agent text,
  created_at timestamptz not null default now()
);

create index feedback_par_date on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Chacun envoie ses propres retours et peut relire les siens.
-- L'analyse se fait côté administrateur (dans le tableau de bord Supabase,
-- avec la clé service_role qui ignore ces règles).
create policy "feedback: j'envoie le mien"
  on public.feedback for insert with check (user_id = auth.uid());
create policy "feedback: je relis les miens"
  on public.feedback for select using (user_id = auth.uid());

-- Espace de stockage PRIVÉ pour les pièces jointes (captures, audio).
-- Privé = seuls le déposant et l'administrateur y accèdent.
insert into storage.buckets (id, name, public)
values ('feedback', 'feedback', false)
on conflict (id) do nothing;

create policy "feedback: dépôt dans mon dossier"
  on storage.objects for insert with check (
    bucket_id = 'feedback'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "feedback: lecture de mon dossier"
  on storage.objects for select using (
    bucket_id = 'feedback'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
