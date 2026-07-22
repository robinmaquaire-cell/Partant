"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EmojiPicker } from "@/components/emoji-picker";
import { ListLogo } from "@/components/list-logo";
import { setListEmoji } from "./actions";

// Logo de la liste : un emoji, ou une image envoyée depuis le téléphone.
export function LogoEditor({
  listId,
  name,
  color,
  emoji,
  logoUrl,
}: {
  listId: string;
  name: string;
  color: string;
  emoji: string | null;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(emoji);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const chooseEmoji = (value: string | null) =>
    startTransition(async () => {
      setCurrent(value);
      const result = await setListEmoji(listId, value);
      if (!result.ok) setErr(result.error);
      else router.refresh();
    });

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
    // Toujours le même emplacement : la nouvelle image remplace l'ancienne.
    const path = `${listId}/logo`;
    const { error: upErr } = await supabase.storage
      .from("logos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setBusy(false);
      setErr("L'envoi de l'image a échoué. Réessaie dans un instant.");
      return;
    }
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    const { error: dbErr } = await supabase
      .from("lists")
      .update({ logo_url: `${data.publicUrl}?v=${Date.now()}` })
      .eq("id", listId);
    setBusy(false);
    if (dbErr) {
      setErr("La sauvegarde a échoué. Réessaie dans un instant.");
      return;
    }
    startTransition(() => router.refresh());
  };

  const removeImage = async () => {
    setBusy(true);
    setErr("");
    const supabase = createClient();
    await supabase.storage.from("logos").remove([`${listId}/logo`]);
    const { error } = await supabase
      .from("lists")
      .update({ logo_url: null })
      .eq("id", listId);
    setBusy(false);
    if (error) {
      setErr("La suppression a échoué. Réessaie dans un instant.");
      return;
    }
    startTransition(() => router.refresh());
  };

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-bold underline text-ink-soft mb-3"
      >
        🎨 Changer le logo de la liste
      </button>
    );

  return (
    <div className="rounded-2xl p-4 mb-3 bg-card border-[1.5px] border-line">
      <div className="flex items-center gap-3 mb-3">
        <ListLogo list={{ name, color, emoji: current, logoUrl }} size={48} />
        <div className="font-bold text-sm flex-1">Logo de la liste</div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-bold underline text-ink-soft"
        >
          Fermer
        </button>
      </div>

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
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="px-3 py-1.5 text-sm rounded-xl font-bold text-ink-soft border-[1.5px] border-line disabled:opacity-60"
        >
          {busy ? "Un instant…" : logoUrl ? "Changer l'image" : "Envoyer une image"}
        </button>
        {logoUrl && (
          <button
            type="button"
            disabled={busy}
            onClick={removeImage}
            className="px-3 py-1.5 text-sm rounded-xl font-bold text-refuse border-[1.5px] border-refuse/40 disabled:opacity-60"
          >
            Retirer l&apos;image
          </button>
        )}
      </div>

      <div className="text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft">
        …ou un emoji
      </div>
      <EmojiPicker value={current} onChange={chooseEmoji} />
      {logoUrl && (
        <p className="text-xs mt-2 text-ink-soft">
          L&apos;image passe devant l&apos;emoji : retire-la pour revoir
          l&apos;emoji.
        </p>
      )}
      {err && <p className="text-xs mt-2 font-semibold text-refuse">{err}</p>}
    </div>
  );
}
