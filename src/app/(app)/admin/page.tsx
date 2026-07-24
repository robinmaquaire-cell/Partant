import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { Avatar } from "@/components/avatar";

type FeedbackRow = {
  id: string;
  user_id: string;
  body: string;
  audio_path: string | null;
  image_paths: string[];
  page: string | null;
  created_at: string;
};

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  // Page invisible pour les non-administrateurs (404, comme si elle n'existait pas).
  if (!isAdminEmail(user.email)) notFound();

  const admin = createAdminClient();
  if (!admin) {
    return (
      <div className="pb-8">
        <Link href="/profil" className="text-sm font-bold text-ink-soft">
          ← Retour
        </Link>
        <p className="mt-4 text-sm text-refuse font-semibold">
          Lecture des retours indisponible sur cet environnement (clé serveur
          manquante).
        </p>
      </div>
    );
  }

  const { data } = await admin
    .from("feedback")
    .select("id, user_id, body, audio_path, image_paths, page, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as FeedbackRow[];

  // Pseudos + photos des auteurs, en une requête.
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = userIds.length
    ? await admin
        .from("profiles")
        .select("id, pseudo, avatar_url")
        .in("id", userIds)
    : { data: [] };
  const personOf = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      { pseudo: p.pseudo || "(sans pseudo)", avatarUrl: p.avatar_url ?? null },
    ])
  );

  // Liens signés (temporaires) pour lire les fichiers du bucket privé.
  const allPaths: string[] = [];
  for (const r of rows) {
    if (r.audio_path) allPaths.push(r.audio_path);
    for (const p of r.image_paths) allPaths.push(p);
  }
  const { data: signed } = allPaths.length
    ? await admin.storage.from("feedback").createSignedUrls(allPaths, 3600)
    : { data: [] };
  const urlOf = new Map(
    (signed ?? [])
      .filter((s) => s.signedUrl && s.path)
      .map((s) => [s.path as string, s.signedUrl])
  );

  return (
    <div className="pb-8">
      <Link href="/profil" className="inline-block text-sm font-bold mb-3 text-ink-soft">
        ← Retour au profil
      </Link>
      <h2 className="text-xl font-extrabold mb-1 font-display">
        Retours des utilisateurs
      </h2>
      <p className="text-sm mb-4 text-ink-soft">
        {rows.length} retour{rows.length > 1 ? "s" : ""} · écran privé, visible
        de toi seul.
      </p>

      {rows.length === 0 && (
        <div className="text-center py-12 text-ink-soft">
          Aucun retour pour l&apos;instant.
        </div>
      )}

      {rows.map((r) => {
        const person = personOf.get(r.user_id) ?? {
          pseudo: "(inconnu)",
          avatarUrl: null,
        };
        const when = new Date(r.created_at).toLocaleString("fr-FR", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
        const audioUrl = r.audio_path ? urlOf.get(r.audio_path) : null;
        const images = r.image_paths
          .map((p) => urlOf.get(p))
          .filter((u): u is string => !!u);

        return (
          <div
            key={r.id}
            className="rounded-2xl p-4 mb-3 bg-card border-[1.5px] border-line"
          >
            <div className="flex items-center gap-2 mb-2">
              <Avatar pseudo={person.pseudo} url={person.avatarUrl} size={28} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{person.pseudo}</div>
                <div className="text-xs text-ink-soft">
                  {when}
                  {r.page ? ` · depuis ${r.page}` : ""}
                </div>
              </div>
            </div>

            {r.body && (
              <p className="text-[15px] leading-relaxed whitespace-pre-line mb-2">
                {r.body}
              </p>
            )}

            {audioUrl && (
              <audio controls src={audioUrl} className="w-full h-10 mb-2" />
            )}

            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {images.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire */}
                    <img
                      src={url}
                      alt={`Capture ${i + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border-[1.5px] border-line"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
