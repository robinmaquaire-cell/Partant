import { createClient } from "@/lib/supabase/server";

// Flux iCalendar (.ics) personnel : c'est l'URL qu'on colle dans Google
// Agenda / Apple Calendrier pour voir ses événements « Partant ? ».
// Le jeton dans l'URL fait office de clé — aucune session n'est requise.
export const dynamic = "force-dynamic";

type FeedRow = {
  id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  location_text: string;
  lat: number | null;
  lng: number | null;
  lists_text: string | null;
  my_status: "yes" | "no" | null;
};

// Durée par défaut d'un événement dans l'agenda (l'app ne demande pas d'heure de fin).
const DEFAULT_DURATION_MIN = 120;

// Échappement imposé par le format iCalendar.
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Les lignes de plus de 75 octets doivent être repliées.
function fold(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    parts.push(rest.slice(0, 73));
    rest = rest.slice(73);
  }
  parts.push(rest);
  return parts.join("\r\n ");
}

// Décalage horaire (en minutes) de la France à un instant donné.
function parisOffsetMinutes(at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(
    dtf.formatToParts(at).map((part) => [part.type, part.value])
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second)
  );
  return (asUtc - at.getTime()) / 60000;
}

// « 2026-07-21 » + « 10:00:00 » (heure française) → instant UTC.
function parisToUtc(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  // Deux passes suffisent, y compris les jours de changement d'heure.
  let ts = naive;
  for (let i = 0; i < 2; i++) ts = naive - parisOffsetMinutes(new Date(ts)) * 60000;
  return new Date(ts);
}

function icsStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function GET(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  const { token: raw } = await props.params;
  // L'URL se termine par « .ics » pour que les agendas la reconnaissent.
  const token = raw.replace(/\.ics$/i, "");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Partant//Agenda//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Partant ?",
    "X-WR-TIMEZONE:Europe/Paris",
    // Indication de fréquence de rafraîchissement (respectée par Apple, pas Google).
    "REFRESH-INTERVAL;VALUE=DURATION:PT2H",
    "X-PUBLISHED-TTL:PT2H",
  ];

  if (/^[a-f0-9]{32,80}$/i.test(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("calendar_feed", { p_token: token });
    const rows = (data ?? []) as FeedRow[];

    const origin = new URL(request.url).origin;
    const stamp = icsStamp(new Date());

    for (const ev of rows) {
      const start = parisToUtc(ev.event_date, ev.event_time);
      const end = new Date(start.getTime() + DEFAULT_DURATION_MIN * 60000);
      const details = [
        ev.description,
        ev.lists_text ? `Liste : ${ev.lists_text}` : "",
        ev.my_status === "yes"
          ? "Ta réponse : Partant !"
          : "Tu n'as pas encore répondu.",
        `${origin}/evenements/${ev.id}`,
      ]
        .filter(Boolean)
        .join("\n");

      lines.push(
        "BEGIN:VEVENT",
        `UID:${ev.id}@partant`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsStamp(start)}`,
        `DTEND:${icsStamp(end)}`,
        fold(`SUMMARY:${esc(ev.title)}`),
        fold(`DESCRIPTION:${esc(details)}`),
        `URL:${origin}/evenements/${ev.id}`,
        // Sans réponse = « peut-être » dans l'agenda.
        ev.my_status === "yes" ? "STATUS:CONFIRMED" : "STATUS:TENTATIVE"
      );
      if (ev.location_text) lines.push(fold(`LOCATION:${esc(ev.location_text)}`));
      if (ev.lat !== null && ev.lng !== null)
        lines.push(`GEO:${ev.lat};${ev.lng}`);
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="partant.ics"',
      "Cache-Control": "public, max-age=900",
    },
  });
}
