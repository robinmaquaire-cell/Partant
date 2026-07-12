"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseGps } from "@/lib/parse-gps";
import {
  createEvent,
  updateEvent,
  type EquipmentDraft,
  type EventInput,
} from "./actions";

export type TemplatePayload = {
  title?: string;
  description?: string;
  event_time?: string;
  location_text?: string;
  lat?: number | null;
  lng?: number | null;
  max_participants?: number;
  collaborative?: boolean;
  equipment?: EquipmentDraft[];
};

type ListOption = { id: string; name: string; color: string };
type TemplateOption = { id: string; name: string; payload: TemplatePayload };
type ExistingItem = {
  id: string;
  name: string;
  kind: "indiv" | "collectif";
  qty: number | null;
};

type EditProps = {
  eventId: string;
  initial: {
    title: string;
    description: string;
    date: string;
    time: string;
    location: string;
    lat: number | null;
    lng: number | null;
    max: number;
    collaborative: boolean;
    listIds: string[];
  };
  existingEquipment: ExistingItem[];
};

const label = "text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft";
const input =
  "w-full bg-card border-[1.5px] border-line rounded-xl px-3 py-2.5 text-[15px] text-ink outline-none focus:border-river";

export function EventForm({
  lists,
  templates = [],
  edit,
}: {
  lists: ListOption[];
  templates?: TemplateOption[];
  edit?: EditProps;
}) {
  const router = useRouter();
  const init = edit?.initial;
  const [date, setDate] = useState(init?.date ?? "");
  const [time, setTime] = useState(init?.time ?? "10:00");
  const [title, setTitle] = useState(init?.title ?? "");
  const [description, setDescription] = useState(init?.description ?? "");
  const [location, setLocation] = useState(init?.location ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    init && init.lat !== null && init.lng !== null
      ? { lat: init.lat, lng: init.lng }
      : null
  );
  const [gpsText, setGpsText] = useState("");
  const [gpsErr, setGpsErr] = useState("");
  const [max, setMax] = useState(init?.max ?? 10);
  const [collaborative, setCollaborative] = useState(
    init?.collaborative ?? false
  );
  const [listIds, setListIds] = useState<string[]>(init?.listIds ?? []);

  // Matériel : objets déjà en base (mode édition) + nouveaux objets.
  const [kept, setKept] = useState<ExistingItem[]>(edit?.existingEquipment ?? []);
  const [removed, setRemoved] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<EquipmentDraft[]>([]);
  const [eqKind, setEqKind] = useState<"collectif" | "indiv">("collectif");
  const [eqName, setEqName] = useState("");
  const [eqQty, setEqQty] = useState(1);

  const [saveTpl, setSaveTpl] = useState(false);
  const [tplName, setTplName] = useState("");
  const [usedTpl, setUsedTpl] = useState<string | null>(null);

  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  const applyTemplate = (t: TemplateOption) => {
    const p = t.payload;
    setTitle(p.title ?? "");
    setDescription(p.description ?? "");
    if (p.event_time) setTime(p.event_time.slice(0, 5));
    setLocation(p.location_text ?? "");
    setCoords(
      p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null
    );
    setMax(p.max_participants ?? 10);
    setCollaborative(p.collaborative ?? false);
    setEquipment(
      (p.equipment ?? []).map((e) => ({
        name: e.name,
        kind: e.kind,
        qty: e.kind === "collectif" ? e.qty ?? 1 : null,
      }))
    );
    setUsedTpl(t.id);
  };

  const locate = () => {
    setGpsErr("");
    if (!navigator.geolocation) {
      setGpsErr(
        "La géolocalisation n'est pas disponible — colle un point Google Maps à la place."
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({
          lat: +pos.coords.latitude.toFixed(5),
          lng: +pos.coords.longitude.toFixed(5),
        }),
      () =>
        setGpsErr(
          "Position inaccessible (autorise la localisation dans ton navigateur), ou colle un point Google Maps à la place."
        )
    );
  };

  const toggleList = (id: string) =>
    setListIds((p) =>
      p.includes(id) ? p.filter((l) => l !== id) : [...p, id]
    );

  const addEquipment = () => {
    if (!eqName.trim()) return;
    setEquipment([
      ...equipment,
      {
        name: eqName.trim(),
        kind: eqKind,
        qty: eqKind === "collectif" ? Math.max(1, eqQty || 1) : null,
      },
    ]);
    setEqName("");
    setEqQty(1);
  };

  const submit = () =>
    startTransition(async () => {
      setErr("");
      const payload: EventInput = {
        title,
        description,
        date,
        time,
        location,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        max,
        collaborative,
        listIds,
        equipment,
      };
      const result = edit
        ? await updateEvent(edit.eventId, payload, removed)
        : await createEvent(
            payload,
            saveTpl ? tplName.trim() || title.trim() : null
          );
      // En cas de succès, l'action redirige : on n'arrive ici qu'en erreur.
      if (result && !result.ok) setErr(result.error);
    });

  return (
    <div className="pb-8">
      <h2 className="text-xl font-extrabold mb-4 font-display">
        {edit ? "Modifier l'événement" : "Nouvel événement"}
      </h2>

      {!edit && templates.length > 0 && (
        <div className="mb-3">
          <div className={label}>Partir d&apos;un template</div>
          <div className="flex gap-2 flex-wrap">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className={`px-3 py-1.5 rounded-full text-sm font-bold border-[1.5px] border-pine ${
                  usedTpl === t.id ? "bg-pine text-white" : "text-pine"
                }`}
              >
                ⚡ {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <label className="block mb-3 flex-1">
          <div className={label}>Date</div>
          <input
            type="date"
            className={input}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="block mb-3 flex-1">
          <div className={label}>Heure</div>
          <input
            type="time"
            className={input}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
      </div>

      <label className="block mb-3">
        <div className={label}>Titre</div>
        <input
          className={input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ex. Sortie kayak au lac"
        />
      </label>

      <label className="block mb-3">
        <div className={label}>Description</div>
        <textarea
          className={`${input} min-h-[70px]`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <label className="block mb-3">
        <div className={label}>Lieu de rendez-vous</div>
        <input
          className={input}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="ex. Base nautique, ponton 2"
        />
      </label>

      <div className="mb-3">
        <div className={label}>Point GPS</div>
        {coords ? (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-ok/10 border-[1.5px] border-ok/40">
            <div>
              <div className="text-sm font-bold text-ok">📍 Point enregistré</div>
              <a
                href={`https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=16/${coords.lat}/${coords.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline text-ink-soft"
              >
                {coords.lat}, {coords.lng} — vérifier sur la carte ↗
              </a>
            </div>
            <button
              type="button"
              className="text-refuse font-bold px-2"
              onClick={() => {
                setCoords(null);
                setGpsText("");
              }}
              aria-label="Retirer le point GPS"
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={locate}
              className="w-full px-4 py-2.5 rounded-xl font-bold bg-ink text-paper transition-transform active:scale-95"
            >
              📍 Autour de moi
            </button>
            <input
              className={`${input} mt-2`}
              value={gpsText}
              onChange={(e) => {
                setGpsText(e.target.value);
                const c = parseGps(e.target.value);
                if (c) {
                  setCoords(c);
                  setGpsErr("");
                } else if (e.target.value.trim().length > 8) {
                  setGpsErr(
                    "Point non détecté — utilise un lien Google Maps complet ou « 44.3801, 4.4205 »."
                  );
                }
              }}
              placeholder="…ou colle un point Google Maps"
            />
            <p className="text-xs mt-1 text-ink-soft">
              Dans Google Maps : appui long sur le lieu, puis copie le lien ou
              les coordonnées affichées en haut — le point est détecté
              automatiquement.
            </p>
            {gpsErr && (
              <p className="text-xs mt-1 font-semibold text-refuse">{gpsErr}</p>
            )}
          </>
        )}
      </div>

      <label className="block mb-3">
        <div className={label}>Nombre max de participants</div>
        <input
          type="number"
          min={1}
          max={1000}
          className={input}
          value={max}
          onChange={(e) => setMax(Number(e.target.value))}
        />
      </label>

      <div className="mb-3">
        <div className={label}>Matériel nécessaire</div>
        {kept.map((it) => (
          <div
            key={it.id}
            className="flex items-center justify-between text-sm font-semibold mb-1 px-3 py-2 rounded-xl bg-card border-[1.5px] border-line"
          >
            <span>
              {it.name}{" "}
              <span className="text-ink-soft">
                {it.kind === "indiv" ? "· 1 par personne" : `×${it.qty}`}
              </span>
            </span>
            <button
              type="button"
              className="text-refuse font-bold px-2"
              onClick={() => {
                setKept(kept.filter((k) => k.id !== it.id));
                setRemoved([...removed, it.id]);
              }}
              aria-label={`Retirer ${it.name}`}
            >
              ✕
            </button>
          </div>
        ))}
        {equipment.map((it, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-sm font-semibold mb-1 px-3 py-2 rounded-xl bg-card border-[1.5px] border-line"
          >
            <span>
              {it.name}{" "}
              <span className="text-ink-soft">
                {it.kind === "indiv" ? "· 1 par personne" : `×${it.qty}`}
              </span>
            </span>
            <button
              type="button"
              className="text-refuse font-bold px-2"
              onClick={() => setEquipment(equipment.filter((_, j) => j !== i))}
              aria-label={`Retirer ${it.name}`}
            >
              ✕
            </button>
          </div>
        ))}
        <div className="flex gap-2 mt-1 mb-2">
          {(
            [
              ["collectif", "Pour le groupe"],
              ["indiv", "Un par personne"],
            ] as const
          ).map(([k, lab]) => (
            <button
              key={k}
              type="button"
              onClick={() => setEqKind(k)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold border-[1.5px] ${
                eqKind === k
                  ? "bg-ink text-paper border-ink"
                  : "text-ink-soft border-line"
              }`}
            >
              {lab}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className={`${input} flex-1`}
            value={eqName}
            onChange={(e) => setEqName(e.target.value)}
            placeholder={
              eqKind === "indiv" ? "ex. Gilet de sauvetage" : "ex. Bidon étanche"
            }
          />
          {eqKind === "collectif" && (
            <input
              type="number"
              min={1}
              max={999}
              className={`${input} w-16`}
              value={eqQty}
              onChange={(e) => setEqQty(Number(e.target.value))}
              aria-label="Quantité"
            />
          )}
          <button
            type="button"
            onClick={addEquipment}
            className="px-3 py-1.5 text-sm rounded-xl font-bold bg-ink text-paper"
          >
            +
          </button>
        </div>
      </div>

      <div className="rounded-2xl p-3 mb-3 bg-card border-[1.5px] border-line">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-bold text-ink"
          onClick={() => setCollaborative(!collaborative)}
        >
          <span className="text-lg">{collaborative ? "☑" : "☐"}</span>{" "}
          Événement collaboratif
        </button>
        <p className="text-xs mt-1 text-ink-soft">
          Les participants pourront ajouter eux-mêmes ce qu&apos;ils ramènent à
          la liste de matériel.
        </p>
      </div>

      {!edit && (
        <div className="rounded-2xl p-3 mb-3 bg-card border-[1.5px] border-line">
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-bold text-ink"
            onClick={() => setSaveTpl(!saveTpl)}
          >
            <span className="text-lg">{saveTpl ? "☑" : "☐"}</span> Enregistrer
            comme template
          </button>
          {saveTpl && (
            <input
              className={`${input} mt-2`}
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
              placeholder="Nom du template, ex. Kayak du samedi"
            />
          )}
        </div>
      )}

      <div className="mb-3">
        <div className={label}>Partager avec les listes</div>
        {lists.length === 0 && (
          <p className="text-sm text-ink-soft">
            Tu n&apos;as pas encore de liste de diffusion — crée-en une dans
            l&apos;onglet Listes avant de créer un événement.
          </p>
        )}
        {lists.map((l) => {
          const on = listIds.includes(l.id);
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => toggleList(l.id)}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-xl mb-1 text-sm font-semibold text-left text-ink border-[1.5px]"
              style={{
                background: on ? l.color + "1A" : "#FFFFFF",
                borderColor: on ? l.color : "#DCE6E2",
              }}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: l.color }}
              />
              {l.name} {on ? "✓" : ""}
            </button>
          );
        })}
      </div>

      {err && <p className="text-sm font-semibold mb-2 text-refuse">{err}</p>}

      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-4 py-2.5 rounded-xl font-bold text-ink-soft border-[1.5px] border-line"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-signal transition-transform active:scale-95 disabled:opacity-60"
        >
          {pending
            ? "Enregistrement…"
            : edit
              ? "Enregistrer"
              : "Créer l'événement"}
        </button>
      </div>
    </div>
  );
}
