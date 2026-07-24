"use server";

import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

// Enregistre un retour utilisateur (texte + éventuels fichiers déjà déposés
// dans le stockage « feedback » par le navigateur). Les chemins de fichiers
// doivent appartenir au dossier de la personne (sécurité).
export async function submitFeedback(input: {
  body: string;
  audioPath: string | null;
  imagePaths: string[];
  page: string;
  userAgent: string;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const body = (input.body ?? "").trim();
  const audioPath = input.audioPath || null;
  const imagePaths = Array.isArray(input.imagePaths) ? input.imagePaths : [];

  if (!body && !audioPath && imagePaths.length === 0)
    return { ok: false, error: "Écris un mot, ou ajoute un audio ou une image." };
  if (body.length > 4000)
    return { ok: false, error: "Ton message est trop long (4000 caractères max)." };
  if (imagePaths.length > 6)
    return { ok: false, error: "6 images maximum par retour." };

  // Les fichiers doivent être dans le dossier de la personne : <son id>/…
  const prefix = `${user.id}/`;
  const mine = (p: string | null) => !!p && p.startsWith(prefix);
  if (audioPath && !mine(audioPath))
    return { ok: false, error: "Fichier audio invalide." };
  if (imagePaths.some((p) => !mine(p)))
    return { ok: false, error: "Image invalide." };

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    body,
    audio_path: audioPath,
    image_paths: imagePaths,
    page: (input.page ?? "").slice(0, 300),
    user_agent: (input.userAgent ?? "").slice(0, 300),
  });
  if (error)
    return { ok: false, error: "L'envoi a échoué. Réessaie dans un instant." };

  return { ok: true };
}
