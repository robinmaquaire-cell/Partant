"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitFeedback } from "@/app/(app)/feedback-actions";

// Extension de fichier d'après le type MIME renvoyé par l'enregistreur.
function extFromMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg")) return "mp3";
  return "webm";
}

function randomName(ext: string): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

// Bouton « Donner mon avis » flottant, disponible sur tout l'écran.
// Permet d'envoyer un retour écrit, audio et/ou avec des captures d'écran.
export function FeedbackButton({ userId }: { userId: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setBody("");
    setImages([]);
    setAudio(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setErr("");
    setDone(false);
  };

  const close = () => {
    if (recording) stopRecording();
    setOpen(false);
    // On garde ce qui est écrit tant que l'envoi n'a pas réussi.
  };

  // ——— Audio ———
  const startRecording = async () => {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setAudio(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setErr("Micro indisponible — vérifie l'autorisation, ou écris ton retour.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const clearAudio = () => {
    setAudio(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
  };

  // ——— Images ———
  const addImages = (files: FileList | null) => {
    if (!files) return;
    setErr("");
    const next = [...images];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 5 * 1024 * 1024) {
        setErr("Une image dépasse 5 Mo et a été ignorée.");
        continue;
      }
      if (next.length < 6) next.push(f);
    }
    setImages(next);
  };

  // ——— Envoi ———
  const upload = async (blob: Blob, name: string) => {
    const supabase = createClient();
    const path = `${userId}/${name}`;
    const { error } = await supabase.storage
      .from("feedback")
      .upload(path, blob, { contentType: blob.type || undefined, upsert: false });
    if (error) throw error;
    return path;
  };

  const send = async () => {
    setErr("");
    if (!body.trim() && !audio && images.length === 0) {
      setErr("Écris un mot, ou ajoute un audio ou une image.");
      return;
    }
    setBusy(true);
    try {
      let audioPath: string | null = null;
      if (audio) {
        audioPath = await upload(audio, randomName(extFromMime(audio.type)));
      }
      const imagePaths: string[] = [];
      for (const img of images) {
        const ext = img.name.split(".").pop()?.toLowerCase() || "jpg";
        imagePaths.push(await upload(img, randomName(ext)));
      }
      const result = await submitFeedback({
        body,
        audioPath,
        imagePaths,
        page: pathname,
        userAgent: navigator.userAgent,
      });
      if (!result.ok) {
        setErr(result.error);
      } else {
        reset();
        setDone(true);
      }
    } catch {
      setErr("L'envoi a échoué (fichier trop lourd ou connexion). Réessaie.");
    }
    setBusy(false);
  };

  const btnGhost =
    "px-3 py-2 rounded-xl text-sm font-bold text-ink-soft border-[1.5px] border-line";

  return (
    <>
      {/* Bouton flottant, au-dessus de la barre d'onglets */}
      <button
        type="button"
        onClick={() => {
          setDone(false);
          setOpen(true);
        }}
        className="fixed right-4 bottom-[92px] z-30 px-4 py-2.5 rounded-full font-bold text-white bg-river shadow-lg transition-transform active:scale-95"
        aria-label="Donner mon avis"
      >
        💬 Mon avis
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center sm:justify-center"
          onClick={close}
        >
          <div
            className="w-full sm:max-w-md bg-paper rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-extrabold font-display">
                Donner mon avis
              </h3>
              <button
                type="button"
                onClick={close}
                className="text-ink-soft font-bold px-2"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            {done ? (
              <div className="py-4">
                <p className="text-sm font-semibold text-ok mb-3">
                  Merci ! Ton retour est bien arrivé 🙌
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full px-4 py-2.5 rounded-xl font-bold text-white bg-signal"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-ink-soft mb-3">
                  Une idée, un bug, un truc pas pratique ? Dis-le comme tu veux :
                  par écrit, en vocal, ou avec une capture d&apos;écran.
                </p>

                <textarea
                  className="w-full bg-card border-[1.5px] border-line rounded-xl px-3 py-2.5 text-[15px] text-ink outline-none focus:border-river min-h-[90px] mb-3"
                  value={body}
                  maxLength={4000}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Ton retour…"
                />

                {/* Audio */}
                <div className="mb-3">
                  {!audio ? (
                    <button
                      type="button"
                      onClick={recording ? stopRecording : startRecording}
                      className={`${btnGhost} ${
                        recording ? "text-refuse border-refuse/50" : ""
                      }`}
                    >
                      {recording ? "⏹ Arrêter l'enregistrement" : "🎙 Enregistrer un vocal"}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      {audioUrl && (
                        <audio controls src={audioUrl} className="h-9 flex-1 min-w-0" />
                      )}
                      <button
                        type="button"
                        onClick={clearAudio}
                        className="text-refuse font-bold px-2"
                        aria-label="Supprimer le vocal"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  {recording && (
                    <span className="ml-2 text-sm font-bold text-refuse align-middle">
                      ● enregistrement…
                    </span>
                  )}
                </div>

                {/* Images */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addImages(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className={`${btnGhost} mb-2`}
                >
                  🖼 Ajouter une capture / photo
                </button>
                {images.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-2">
                    {images.map((img, i) => (
                      <div key={i} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local */}
                        <img
                          src={URL.createObjectURL(img)}
                          alt={`Capture ${i + 1}`}
                          className="w-16 h-16 object-cover rounded-lg border-[1.5px] border-line"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setImages(images.filter((_, j) => j !== i))
                          }
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-refuse text-white text-xs font-bold"
                          aria-label="Retirer l'image"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {err && (
                  <p className="text-sm font-semibold mb-2 text-refuse">{err}</p>
                )}

                <button
                  type="button"
                  disabled={busy}
                  onClick={send}
                  className="w-full px-4 py-2.5 rounded-xl font-bold text-white bg-signal transition-transform active:scale-95 disabled:opacity-60"
                >
                  {busy ? "Envoi…" : "Envoyer mon retour"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
