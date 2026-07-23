import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, eventCreatedEmail, sendEmails } from "@/lib/email";
import { pushToUsers } from "@/lib/push";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function frenchDateShort(date: string): string {
  return new Date(date + "T00:00").toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

type MemberRow = {
  user_id: string;
  profiles: {
    pseudo: string | null;
    contact: string | null;
    email_notifications: boolean;
  } | null;
};

// Prévient par e-mail les membres des listes concernées qu'un événement
// vient d'être créé. Ne bloque jamais la création : en cas de pépin,
// on trace l'erreur et c'est tout.
export async function notifyEventCreated(eventId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) {
      console.log("[notif] SUPABASE_SERVICE_ROLE_KEY absente — notification sautée.");
      return;
    }

    const { data: ev } = await admin
      .from("events")
      .select(
        "id, title, event_date, event_time, location_text, created_by, event_lists(list_id, lists(name))"
      )
      .eq("id", eventId)
      .single();
    if (!ev) return;

    const listIds = ev.event_lists.map((el) => el.list_id);
    const listNames = ev.event_lists
      .map((el) => (el.lists as unknown as { name: string } | null)?.name)
      .filter((n): n is string => !!n);

    const { data: memberData } = await admin
      .from("list_members")
      .select("user_id, profiles(pseudo, contact, email_notifications)")
      .in("list_id", listIds);
    const members = (memberData ?? []) as unknown as MemberRow[];

    const creatorPseudo =
      members.find((m) => m.user_id === ev.created_by)?.profiles?.pseudo ??
      "un membre";

    // Un e-mail par personne (même si elle est dans plusieurs listes),
    // jamais au créateur, et seulement si son contact est un e-mail valide.
    // On collecte au passage les destinataires des notifications push.
    const seen = new Set<string>([ev.created_by]);
    const pushTargets: string[] = [];
    const messages = [];
    for (const m of members) {
      if (seen.has(m.user_id)) continue;
      seen.add(m.user_id);
      pushTargets.push(m.user_id);
      const p = m.profiles;
      // Chacun peut refuser les e-mails depuis son profil.
      if (!p || !p.email_notifications) continue;
      const email = (p.contact ?? "").trim();
      if (!EMAIL_RE.test(email)) continue;
      messages.push(
        eventCreatedEmail({
          to: email,
          eventId: ev.id,
          title: ev.title,
          date: ev.event_date,
          time: ev.event_time.slice(0, 5),
          location: ev.location_text,
          listNames,
          creatorPseudo,
        })
      );
    }

    const sent = await sendEmails(messages);

    // Notification push sur les téléphones où elle est activée.
    const pushed = await pushToUsers(admin, pushTargets, {
      title: `Nouveau : ${ev.title}`,
      body: `${frenchDateShort(ev.event_date)} à ${ev.event_time.slice(0, 5)}${
        ev.location_text ? ` · ${ev.location_text}` : ""
      } — proposé par ${creatorPseudo}`,
      url: `${appUrl()}/evenements/${ev.id}`,
      tag: `event-${ev.id}`,
    });

    console.log(
      `[notif] Événement ${ev.id} : ${sent} e-mail(s), ${pushed} notif(s) push.`
    );
  } catch (e) {
    console.error("[notif] Notification de création échouée :", e);
  }
}
