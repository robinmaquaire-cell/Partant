import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import { ListLogo } from "@/components/list-logo";
import { ContactActions } from "./contact-actions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Common = {
  pseudo: string | null;
  avatar_url: string | null;
  blocked: boolean;
  lists: {
    id: string;
    name: string;
    color: string;
    emoji: string | null;
    logo_url: string | null;
  }[];
  events: { id: string; title: string; event_date: string }[];
};

export default async function ContactDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data } = await supabase.rpc("contact_common", { p_contact: id });
  if (!data) notFound();
  const common = data as Common;

  const pseudo = common.pseudo || "(sans pseudo)";

  return (
    <div className="pb-8">
      <Link
        href="/contacts"
        className="inline-block text-sm font-bold mb-3 text-ink-soft"
      >
        ← Mes contacts
      </Link>

      <div className="flex items-center gap-3 mb-4">
        <Avatar pseudo={pseudo} url={common.avatar_url} size={56} />
        <div>
          <h2 className="text-xl font-extrabold font-display">{pseudo}</h2>
          {common.blocked && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-refuse/15 text-refuse">
              Ses événements sont bloqués
            </span>
          )}
        </div>
      </div>

      <ContactActions contactId={id} blocked={common.blocked} />

      <h3 className="font-extrabold mt-6 mb-2 font-display">
        Listes en commun{" "}
        <span className="text-ink-soft">— {common.lists.length}</span>
      </h3>
      {common.lists.length === 0 ? (
        <p className="text-sm text-ink-soft mb-4">Aucune liste en commun.</p>
      ) : (
        <div className="mb-4">
          {common.lists.map((l) => (
            <Link
              key={l.id}
              href={`/listes/${l.id}`}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 mb-1.5 bg-card border-[1.5px] border-line"
            >
              <ListLogo
                list={{
                  name: l.name,
                  color: l.color,
                  emoji: l.emoji,
                  logoUrl: l.logo_url,
                }}
                size={28}
              />
              <span className="font-semibold text-sm">{l.name}</span>
            </Link>
          ))}
        </div>
      )}

      <h3 className="font-extrabold mt-6 mb-2 font-display">
        Événements en commun{" "}
        <span className="text-ink-soft">— {common.events.length}</span>
      </h3>
      {common.events.length === 0 ? (
        <p className="text-sm text-ink-soft">Aucun événement en commun.</p>
      ) : (
        <div>
          {common.events.map((e) => (
            <Link
              key={e.id}
              href={`/evenements/${e.id}`}
              className="flex items-center justify-between rounded-xl px-4 py-3 mb-1.5 bg-card border-[1.5px] border-line"
            >
              <span className="font-semibold text-sm">{e.title}</span>
              <span className="text-xs font-bold text-ink-soft shrink-0 ml-2">
                {new Date(e.event_date + "T00:00").toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
