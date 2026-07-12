"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";

export function AvatarUpload({
  userId,
  pseudo,
  avatarUrl,
}: {
  userId: string;
  pseudo: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const upload = async (file: File) => {
    setErr("");
    if (!file.type.startsWith("image/")) {
      setErr("Choisis une image (photo, JPG, PNG…).");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setErr("Cette image est trop lourde (4 Mo max).");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    // Toujours le même emplacement : la nouvelle photo remplace l'ancienne.
    const path = `${userId}/avatar`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setBusy(false);
      setErr("L'envoi de la photo a échoué. Réessaie dans un instant.");
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    // ?v=… force le navigateur à recharger la nouvelle photo.
    const url = `${data.publicUrl}?v=${Date.now()}`;
    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", userId);
    setBusy(false);
    if (dbErr) {
      setErr("La sauvegarde a échoué. Réessaie dans un instant.");
      return;
    }
    startTransition(() => router.refresh());
  };

  const removePhoto = async () => {
    setErr("");
    setBusy(true);
    const supabase = createClient();
    await supabase.storage.from("avatars").remove([`${userId}/avatar`]);
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      setErr("La suppression a échoué. Réessaie dans un instant.");
      return;
    }
    startTransition(() => router.refresh());
  };

  return (
    <div className="flex items-center gap-4 mb-5">
      <Avatar pseudo={pseudo || "?"} url={avatarUrl} size={64} />
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 text-sm rounded-xl font-bold text-ink-soft border-[1.5px] border-line bg-card disabled:opacity-60"
          >
            {busy ? "Un instant…" : avatarUrl ? "Changer la photo" : "Ajouter une photo"}
          </button>
          {avatarUrl && (
            <button
              type="button"
              disabled={busy}
              onClick={removePhoto}
              className="px-3 py-1.5 text-sm rounded-xl font-bold text-refuse border-[1.5px] border-refuse/40 bg-card disabled:opacity-60"
            >
              Retirer
            </button>
          )}
        </div>
        <p className="text-xs mt-1 text-ink-soft">
          Sans photo, tes initiales font très bien l&apos;affaire.
        </p>
        {err && <p className="text-xs mt-1 font-semibold text-refuse">{err}</p>}
      </div>
    </div>
  );
}
