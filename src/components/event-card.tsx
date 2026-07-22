import Link from "next/link";
import { DateBlock } from "./date-block";
import { RelTime } from "./rel-time";

export type EventCardData = {
  id: string;
  title: string;
  event_date: string;
  event_time: string;
  location_text: string;
  max_participants: number;
  lists: { id: string; name: string; color: string }[];
  yesCount: number;
  myStatus: "yes" | "no" | null;
};

export function EventCard({ ev }: { ev: EventCardData }) {
  return (
    <Link
      href={`/evenements/${ev.id}`}
      className="rounded-2xl p-4 mb-3 flex gap-3 bg-card border-[1.5px] border-line"
    >
      <div className="flex flex-col items-center shrink-0">
        <DateBlock date={ev.event_date} />
        <div className="text-xs font-extrabold mt-1 text-center text-signal">
          <RelTime date={ev.event_date} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {ev.lists.map((l) => (
            <span
              key={l.id}
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: l.color + "1A",
                color: l.color,
                border: `1px solid ${l.color}40`,
              }}
            >
              {l.name}
            </span>
          ))}
          {ev.lists.length === 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sand text-pine">
              🔗 Sur invitation
            </span>
          )}
        </div>
        <div className="font-bold text-base leading-tight">{ev.title}</div>
        <div className="text-sm mt-0.5 text-ink-soft">
          {ev.location_text ? `📍 ${ev.location_text} · ` : ""}
          {ev.event_time.slice(0, 5)}
        </div>
        <div className="text-sm mt-1 font-semibold text-pine">
          {ev.yesCount}/{ev.max_participants} partant
          {ev.yesCount > 1 ? "s" : ""}
          {ev.myStatus === "yes" && (
            <span className="text-ok"> · Tu y seras ✓</span>
          )}
          {ev.myStatus === "no" && (
            <span className="text-refuse"> · Pas dispo</span>
          )}
        </div>
      </div>
    </Link>
  );
}
