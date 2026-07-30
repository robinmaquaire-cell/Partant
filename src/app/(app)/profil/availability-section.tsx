"use client";

import { useState, useTransition } from "react";
import {
  saveCalendarSource,
  syncMyCalendar,
  setBusyShare,
  disconnectCalendar,
} from "./agenda-actions";

type Slot = { start: string; end: string };

const input =
  "w-full bg-card border-[1.5px] border-line rounded-xl px-3 py-2.5 text-[15px] text-ink outline-none focus:border-river";

// Depuis combien de temps, en clair.
function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return `il y a ${j} j`;
}

// Aperçu des 7 prochains jours : pour chaque jour, matin / après-midi / soir
// marqués « occupé » si un créneau les chevauche (heure locale du téléphone).
function WeekStrip({ slots }: { slots: Slot[] }) {
  const parsed = slots.map((s) => [new Date(s.start), new Date(s.end)] as const);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lettres = ["D", "L", "M", "M", "J", "V", "S"];

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const segs = ([[6, 12], [12, 18], [18, 24]] as const).map(([h1, h2]) => {
      const a = new Date(d);
      a.setHours(h1, 0, 0, 0);
      const b = new Date(d);
      b.setHours(h2, 0, 0, 0);
      return parsed.some(([s, e]) => e > a && s < b);
    });
    return { d, segs };
  });

  return (
    <div>
      <div className="flex gap-1.5">
        {days.map(({ d, segs }, i) => (
          <div key={i} className="flex-1 text-center">
            <div className="text-[11px] font-bold text-ink-soft">
              {lettres[d.getDay()]}
            </div>
            <div className="text-xs font-bold mb-1">{d.getDate()}</div>
            <div className="flex flex-col gap-0.5">
              {segs.map((busy, j) => (
                <div
                  key={j}
                  className={`h-2.5 rounded-sm ${busy ? "bg-refuse" : "bg-ok/30"}`}
                  title={busy ? "Occupé" : "Libre"}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 text-[11px] text-ink-soft">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-refuse" /> Occupé
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-ok/30" /> Libre
        </span>
        <span className="ml-auto">Matin · Aprèm · Soir</span>
      </div>
    </div>
  );
}

export function AvailabilitySection({
  connected,
  lastSyncedAt,
  lastError,
  busyShare,
  upcoming,
}: {
  connected: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  busyShare: boolean;
  upcoming: Slot[];
}) {
  const [editing, setEditing] = useState(!connected);
  const [url, setUrl] = useState("");
  const [help, setHelp] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const [pending, startTransition] = useTransition();
  // Suivi optimiste du partage pour que la case réagisse tout de suite.
  const [share, setShare] = useState(busyShare);

  const connect = () =>
    startTransition(async () => {
      setMsg(null);
      const r = await saveCalendarSource(url);
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setUrl("");
      setEditing(false);
      setMsg({
        ok: true,
        text:
          r.count === undefined
            ? "Agenda relié."
            : `Agenda relié — ${r.count} créneau${r.count > 1 ? "x" : ""} occupé${
                r.count > 1 ? "s" : ""
              } trouvé${r.count > 1 ? "s" : ""}.`,
      });
    });

  const refresh = () =>
    startTransition(async () => {
      setMsg(null);
      const r = await syncMyCalendar();
      setMsg(
        r.ok
          ? { ok: true, text: "Disponibilités à jour." }
          : { ok: false, text: r.error }
      );
    });

  const toggleShare = () => {
    const next = !share;
    setShare(next);
    startTransition(async () => {
      const r = await setBusyShare(next);
      if (!r.ok) {
        setShare(!next);
        setMsg({ ok: false, text: r.error });
      }
    });
  };

  const disconnect = () =>
    startTransition(async () => {
      const r = await disconnectCalendar();
      if (!r.ok) {
        setMsg({ ok: false, text: r.error });
        return;
      }
      setConfirmOff(false);
      setEditing(true);
      setMsg(null);
    });

  return (
    <div className="rounded-2xl p-4 mb-4 bg-card border-[1.5px] border-line">
      <div className="font-extrabold font-display mb-1">
        🗓️ Mon calendrier de disponibilité
      </div>
      <p className="text-sm text-ink-soft mb-3">
        Relie ton agenda perso pour que tes contacts voient quand tu es
        disponible. Ils verront seulement <strong>occupé ou libre</strong> —
        jamais le titre ni le lieu de tes rendez-vous.
      </p>

      {connected && !editing ? (
        <>
          {lastError ? (
            <p className="text-sm font-semibold text-refuse mb-2">
              ⚠️ Dernier rafraîchissement en échec : {lastError}
            </p>
          ) : (
            <p className="text-sm text-ok font-semibold mb-2">
              ✓ Agenda relié
              {lastSyncedAt ? ` · mis à jour ${ago(lastSyncedAt)}` : ""}
            </p>
          )}

          {upcoming.length > 0 ? (
            <div className="mb-3">
              <WeekStrip slots={upcoming} />
            </div>
          ) : (
            !lastError && (
              <p className="text-sm text-ink-soft mb-3">
                Aucun créneau occupé sur les 7 prochains jours — tout libre !
              </p>
            )
          )}

          <button
            type="button"
            onClick={toggleShare}
            className="flex items-center gap-2 text-sm font-bold text-ink mb-3"
          >
            <span className="text-lg">{share ? "☑" : "☐"}</span>
            Partager ma dispo avec mes contacts
          </button>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={pending}
              className="px-3 py-2 rounded-xl text-sm font-bold text-white bg-pine disabled:opacity-60"
            >
              {pending ? "…" : "🔄 Rafraîchir"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setMsg(null);
              }}
              className="px-3 py-2 rounded-xl text-sm font-bold text-ink-soft border-[1.5px] border-line"
            >
              Changer de lien
            </button>
            {!confirmOff ? (
              <button
                type="button"
                onClick={() => setConfirmOff(true)}
                className="px-3 py-2 rounded-xl text-sm font-bold text-refuse border-[1.5px] border-refuse/40"
              >
                Débrancher
              </button>
            ) : (
              <button
                type="button"
                onClick={disconnect}
                disabled={pending}
                className="px-3 py-2 rounded-xl text-sm font-bold text-white bg-refuse disabled:opacity-60"
              >
                Confirmer le débranchement
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setHelp((v) => !v)}
            className="text-sm font-bold text-river mb-2"
          >
            {help ? "▾" : "▸"} Où trouver mon lien d&apos;agenda ?
          </button>
          {help && (
            <div className="text-xs text-ink-soft mb-3 space-y-2 leading-relaxed">
              <p>
                <strong>Google Agenda</strong> (sur ordinateur) : Paramètres →
                choisis ton agenda à gauche → « Intégrer l&apos;agenda » → copie
                l&apos;« Adresse secrète au format iCal » (elle finit par
                <em> .ics</em>).
              </p>
              <p>
                <strong>Apple / iCloud</strong> : sur iCloud.com, Calendrier →
                partage un agenda en « Calendrier public » → copie le lien
                (il commence par <em>webcal://</em>, ça marche aussi).
              </p>
              <p>
                <strong>Outlook</strong> : Paramètres → Calendrier → Calendriers
                partagés → Publier → copie le lien <em>.ics</em>.
              </p>
              <p className="text-refuse">
                ⚠️ C&apos;est une adresse secrète : ne la partage pas
                publiquement. Partants ne lit que tes horaires occupés.
              </p>
            </div>
          )}

          <input
            className={input}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Colle ici ton lien d'agenda (…​.ics)"
            inputMode="url"
          />
          <div className="flex gap-2 mt-2">
            {connected && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setMsg(null);
                }}
                className="px-3 py-2 rounded-xl text-sm font-bold text-ink-soft border-[1.5px] border-line"
              >
                Annuler
              </button>
            )}
            <button
              type="button"
              onClick={connect}
              disabled={pending || !url.trim()}
              className="flex-1 px-3 py-2 rounded-xl text-sm font-bold text-white bg-signal transition-transform active:scale-95 disabled:opacity-60"
            >
              {pending ? "Lecture de l'agenda…" : "Relier mon agenda"}
            </button>
          </div>
        </>
      )}

      {msg && (
        <p
          className={`text-sm font-semibold mt-2 ${
            msg.ok ? "text-ok" : "text-refuse"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
