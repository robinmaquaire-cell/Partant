"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { parseGps } from "@/lib/parse-gps";
import { GpsMap } from "@/components/gps-map";
import { SUGGESTED_CATEGORIES } from "@/lib/equipment-categories";
import { ListLogo } from "@/components/list-logo";
import {
  createEvent,
  updateEvent,
  type EquipmentDraft,
  type EventInput,
  type RoleDraft,
} from "./actions";
import { draftEventFromText } from "./voice-actions";
import {
  ContactAvailability,
  type ContactOption,
} from "./contact-availability";

export type TemplatePayload = {
  title?: string;
  description?: string;
  event_time?: string;
  location_text?: string;
  lat?: number | null;
  lng?: number | null;
  max_participants?: number;
  collaborative?: boolean;
  category?: string | null; // ancien format (un seul tag) — repris si présent
  tags?: string[];
  equipment?: EquipmentDraft[];
  roles?: RoleDraft[];
};

type ListOption = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  logoUrl: string | null;
};
type TemplateOption = { id: string; name: string; payload: TemplatePayload };
type ExistingItem = {
  id: string;
  name: string;
  kind: "indiv" | "collectif";
  qty: number | null;
  category: string | null;
};
type ExistingRole = { id: string; name: string; capacity: number };

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
    tags: string[];
    listIds: string[];
  };
  existingEquipment: ExistingItem[];
  existingRoles: ExistingRole[];
};

// Suggestions de tags d'événement (l'organisateur peut taper les siens).
const EVENT_TAGS = [
  "Sport",
  "Apéro",
  "Repas",
  "Culture",
  "Week-end",
  "Réunion",
];

const label = "text-xs font-bold uppercase tracking-wide mb-1 text-ink-soft";
// Zone d'édition : blanc pur. Tout ce qui se tape reste blanc.
const input =
  "w-full bg-card border-[1.5px] border-line rounded-xl px-3 py-2.5 text-[15px] text-ink outline-none focus:border-river";
// Ligne déjà ajoutée à la liste : légèrement teintée et ombrée, pour qu'on
// voie d'un coup d'œil ce qui est enregistré et ce qui est encore en train
// d'être saisi.
const savedRow =
  "flex items-center justify-between text-sm font-semibold mb-1 px-3 py-2 rounded-xl bg-pine/[0.06] border-[1.5px] border-line shadow-[0_1px_3px_rgba(16,48,44,0.12)]";

export function EventForm({
  lists,
  templates = [],
  usedTags = [],
  edit,
  voiceEnabled = false,
  contacts = [],
}: {
  lists: ListOption[];
  templates?: TemplateOption[];
  usedTags?: string[]; // tags déjà utilisés ailleurs, en suggestion
  edit?: EditProps;
  voiceEnabled?: boolean; // aide vocale dispo (clé Anthropic configurée)
  contacts?: ContactOption[]; // pour vérifier leurs disponibilités
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
  const [mapOpen, setMapOpen] = useState(false);
  const [max, setMax] = useState(init?.max ?? 0);
  const [collaborative, setCollaborative] = useState(
    init?.collaborative ?? false
  );
  const [tags, setTags] = useState<string[]>(init?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [listIds, setListIds] = useState<string[]>(init?.listIds ?? []);

  // Ajoute/retire un tag (casse et espaces ignorés pour comparer).
  const toggleTag = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    setTags((prev) => {
      const key = t.toLowerCase();
      if (prev.some((x) => x.toLowerCase() === key))
        return prev.filter((x) => x.toLowerCase() !== key);
      if (prev.length >= 8) return prev;
      return [...prev, t];
    });
  };
  const addTypedTag = () => {
    if (!tagInput.trim()) return;
    toggleTag(tagInput);
    setTagInput("");
  };

  // Matériel : objets déjà en base (mode édition) + nouveaux objets.
  const [kept, setKept] = useState<ExistingItem[]>(edit?.existingEquipment ?? []);
  const [removed, setRemoved] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<EquipmentDraft[]>([]);
  const [eqKind, setEqKind] = useState<"collectif" | "indiv">("collectif");
  const [eqName, setEqName] = useState("");
  const [eqQty, setEqQty] = useState(1);
  const [eqCat, setEqCat] = useState("");

  // Rôles : ceux déjà en base (mode édition) + les nouveaux.
  const [keptRoles, setKeptRoles] = useState<ExistingRole[]>(
    edit?.existingRoles ?? []
  );
  const [removedRoles, setRemovedRoles] = useState<string[]>([]);
  const [roles, setRoles] = useState<RoleDraft[]>([]);
  const [roleName, setRoleName] = useState("");
  const [roleCap, setRoleCap] = useState(1);

  // Les catégories déjà utilisées, proposées en plus des suggestions.
  const usedCategories = [
    ...new Set(
      [...kept, ...equipment]
        .map((it) => (it.category ?? "").trim())
        .filter(Boolean)
    ),
  ];
  const categoryOptions = [
    ...new Set([...usedCategories, ...SUGGESTED_CATEGORIES]),
  ];

  const [saveTpl, setSaveTpl] = useState(false);
  const [tplName, setTplName] = useState("");
  const [usedTpl, setUsedTpl] = useState<string | null>(null);

  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();

  // Aide vocale : la personne dicte (micro du clavier) ou tape une phrase,
  // et Claude pré-remplit les champs. Réservée à la création (pas à l'édition).
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [voiceErr, setVoiceErr] = useState("");
  const [voiceBusy, setVoiceBusy] = useState(false);

  const runVoiceDraft = () => {
    setVoiceErr("");
    setVoiceBusy(true);
    startTransition(async () => {
      const result = await draftEventFromText(voiceText);
      setVoiceBusy(false);
      if (!result.ok) {
        setVoiceErr(result.error);
        return;
      }
      const d = result.draft;
      // On ne remplit que ce qui a été compris ; le reste garde sa valeur.
      if (d.date) setDate(d.date);
      if (d.time) setTime(d.time);
      if (d.title) setTitle(d.title);
      if (d.tags.length) setTags(d.tags);
      if (d.description) setDescription(d.description);
      if (d.location) setLocation(d.location);
      setMax(d.max);
      if (d.equipment.length) setEquipment(d.equipment);
      if (d.roles.length) setRoles(d.roles);
      setVoiceOpen(false);
      setVoiceText("");
    });
  };

  // Saisie restée en cours d'édition au moment de valider : on demande
  // confirmation avant de l'ajouter (ou de l'abandonner).
  const [ask, setAsk] = useState<{
    item: EquipmentDraft | null;
    role: RoleDraft | null;
  } | null>(null);

  const applyTemplate = (t: TemplateOption) => {
    const p = t.payload;
    setTitle(p.title ?? "");
    setDescription(p.description ?? "");
    if (p.event_time) setTime(p.event_time.slice(0, 5));
    setLocation(p.location_text ?? "");
    setCoords(
      p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null
    );
    setMax(p.max_participants ?? 0);
    setCollaborative(p.collaborative ?? false);
    // Nouveau format (tags) ou ancien (une catégorie unique).
    setTags(
      p.tags && p.tags.length
        ? p.tags
        : p.category
          ? [p.category]
          : []
    );
    setEquipment(
      (p.equipment ?? []).map((e) => ({
        name: e.name,
        kind: e.kind,
        qty: e.qty ?? 1,
        category: e.category ?? null,
      }))
    );
    setRoles(
      (p.roles ?? []).map((r) => ({
        name: r.name,
        capacity: r.capacity ?? 1,
      }))
    );
    setUsedTpl(t.id);
  };

  const toggleList = (id: string) =>
    setListIds((p) =>
      p.includes(id) ? p.filter((l) => l !== id) : [...p, id]
    );

  // L'objet en cours de saisie, tant qu'il n'a pas été ajouté à la liste.
  const draftItem = (): EquipmentDraft | null =>
    eqName.trim()
      ? {
          name: eqName.trim(),
          kind: eqKind,
          qty: Math.max(1, eqQty || 1),
          category: eqCat.trim() || null,
        }
      : null;

  // Le rôle en cours de saisie, tant qu'il n'a pas été ajouté à la liste.
  const draftRole = (): RoleDraft | null =>
    roleName.trim()
      ? { name: roleName.trim(), capacity: Math.max(1, roleCap || 1) }
      : null;

  const addEquipment = () => {
    const it = draftItem();
    if (!it) return;
    setEquipment([...equipment, it]);
    setEqName("");
    setEqQty(1);
    // La catégorie reste en place : on saisit souvent plusieurs objets de suite.
  };

  const addRole = () => {
    const r = draftRole();
    if (!r) return;
    setRoles([...roles, r]);
    setRoleName("");
    setRoleCap(1);
  };

  // Envoi réel. Les éventuelles saisies restées dans la zone d'édition sont
  // ajoutées ou ignorées selon la réponse donnée dans l'alerte.
  const runSubmit = (
    extraItem: EquipmentDraft | null,
    extraRole: RoleDraft | null
  ) => {
    const allEquipment = extraItem ? [...equipment, extraItem] : equipment;
    const allRoles = extraRole ? [...roles, extraRole] : roles;
    if (extraItem) {
      setEquipment(allEquipment);
      setEqName("");
      setEqQty(1);
    }
    if (extraRole) {
      setRoles(allRoles);
      setRoleName("");
      setRoleCap(1);
    }
    setAsk(null);

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
        tags,
        listIds,
        equipment: allEquipment,
        roles: allRoles,
      };
      const result = edit
        ? await updateEvent(edit.eventId, payload, removed, removedRoles)
        : await createEvent(
            payload,
            saveTpl ? tplName.trim() || title.trim() : null
          );
      // En cas de succès, l'action redirige : on n'arrive ici qu'en erreur.
      if (result && !result.ok) setErr(result.error);
    });
  };

  const submit = () => {
    // Rien n'est ajouté à l'insu de la personne : s'il reste une saisie dans
    // la zone d'édition, on demande d'abord ce qu'il faut en faire.
    const item = draftItem();
    const role = draftRole();
    if (item || role) {
      setAsk({ item, role });
      return;
    }
    runSubmit(null, null);
  };

  // « les » quand deux saisies sont en attente, « l' » quand il n'y en a qu'une.
  const askPron = ask?.item && ask?.role ? "les " : "l'";

  return (
    <div className="pb-8">
      <h2 className="text-xl font-extrabold mb-4 font-display">
        {edit ? "Modifier l'événement" : "Nouvel événement"}
      </h2>

      {!edit && voiceEnabled && (
        <div className="rounded-2xl p-3 mb-3 bg-pine/[0.06] border-[1.5px] border-pine/30">
          {!voiceOpen ? (
            <button
              type="button"
              onClick={() => setVoiceOpen(true)}
              className="flex items-center gap-2 text-sm font-bold text-pine"
            >
              🎤 Décrire en une phrase (le formulaire se remplit tout seul)
            </button>
          ) : (
            <>
              <div className={label}>Décris ton événement</div>
              <p className="text-xs mb-2 text-ink-soft">
                Tape, ou touche le micro 🎤 de ton clavier et parle. Ex. : « Kayak
                samedi prochain à 10h à la base nautique, on est max 6, chacun son
                gilet ».
              </p>
              <textarea
                className={`${input} min-h-[80px]`}
                value={voiceText}
                onChange={(e) => setVoiceText(e.target.value)}
                placeholder="Dis à quoi ressemble ton événement…"
                autoFocus
              />
              {voiceErr && (
                <p className="text-xs mt-1 font-semibold text-refuse">{voiceErr}</p>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setVoiceOpen(false);
                    setVoiceErr("");
                  }}
                  className="px-3 py-2 rounded-xl text-sm font-bold text-ink-soft border-[1.5px] border-line"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={runVoiceDraft}
                  disabled={voiceBusy || !voiceText.trim()}
                  className="flex-1 px-3 py-2 rounded-xl text-sm font-bold text-white bg-pine transition-transform active:scale-95 disabled:opacity-60"
                >
                  {voiceBusy ? "Lecture en cours…" : "✨ Pré-remplir le formulaire"}
                </button>
              </div>
              <p className="text-xs mt-2 text-ink-soft">
                Tu pourras tout relire et corriger avant de créer l&apos;événement.
              </p>
            </>
          )}
        </div>
      )}

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

      <div className="mb-3">
        <div className={label}>Tags (facultatif)</div>
        {tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-2">
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold bg-ink text-paper"
              >
                🏷 {t} <span className="opacity-70">✕</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1.5 flex-wrap mb-2">
          {[...new Set([...EVENT_TAGS, ...usedTags])]
            .filter((c) => !tags.some((t) => t.toLowerCase() === c.toLowerCase()))
            .map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleTag(c)}
                disabled={tags.length >= 8}
                className="px-3 py-1.5 rounded-full text-sm font-bold border-[1.5px] text-ink-soft border-line disabled:opacity-50"
              >
                + {c}
              </button>
            ))}
        </div>
        <input
          className={input}
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTypedTag();
            }
          }}
          onBlur={addTypedTag}
          maxLength={30}
          placeholder="…ou tape le tien puis Entrée"
        />
        {tags.length >= 8 && (
          <p className="text-xs mt-1 text-ink-soft">Maximum 8 tags.</p>
        )}
      </div>

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
        {mapOpen ? (
          <GpsMap
            initial={coords}
            onPick={(c, address) => {
              setCoords(c);
              setGpsErr("");
              // L'adresse trouvée remplit le lieu s'il est encore vide.
              if (address && !location.trim()) setLocation(address);
            }}
            onClose={() => setMapOpen(false)}
          />
        ) : coords ? (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-ok/10 border-[1.5px] border-ok/40">
            <div>
              <div className="text-sm font-bold text-ok">📍 Point enregistré</div>
              <div className="text-xs text-ink-soft">
                {coords.lat}, {coords.lng} —{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => setMapOpen(true)}
                >
                  ajuster sur la carte
                </button>
              </div>
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
              onClick={() => setMapOpen(true)}
              className="w-full px-4 py-2.5 rounded-xl font-bold bg-ink text-paper transition-transform active:scale-95"
            >
              📍 Autour de moi — choisir sur la carte
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
          min={0}
          max={1000}
          className={input}
          value={max}
          onChange={(e) => setMax(Number(e.target.value))}
        />
        <p className="text-xs mt-1 text-ink-soft">
          Laisse <strong>0</strong> pour un nombre de places illimité.
        </p>
      </label>

      <div className="mb-3">
        <div className={label}>Matériel nécessaire</div>
        {kept.map((it) => (
          <div
            key={it.id}
            className={savedRow}
          >
            <span>
              {it.name}{" "}
              <span className="text-ink-soft">
                {it.kind === "indiv"
                  ? `· ${it.qty ?? 1} par personne`
                  : `×${it.qty ?? 1}`}
              </span>
              {it.category && (
                <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full bg-sand text-pine">
                  {it.category}
                </span>
              )}
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
            className={savedRow}
          >
            <span>
              {it.name}{" "}
              <span className="text-ink-soft">
                {it.kind === "indiv"
                  ? `· ${it.qty ?? 1} par personne`
                  : `×${it.qty ?? 1}`}
              </span>
              {it.category && (
                <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full bg-sand text-pine">
                  {it.category}
                </span>
              )}
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
              ["indiv", "Par personne"],
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
        <input
          className={`${input} mb-2`}
          value={eqCat}
          onChange={(e) => setEqCat(e.target.value)}
          list="categories-materiel"
          placeholder="Catégorie (facultatif) — ex. Sécurité"
          maxLength={30}
        />
        <datalist id="categories-materiel">
          {categoryOptions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <div className="flex gap-2">
          <input
            className={`${input} flex-1 min-w-0`}
            value={eqName}
            onChange={(e) => setEqName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addEquipment();
              }
            }}
            placeholder={
              eqKind === "indiv" ? "ex. Gilet de sauvetage" : "ex. Bidon étanche"
            }
          />
          <input
            type="number"
            min={1}
            max={999}
            className="w-16 shrink-0 text-center bg-card border-[1.5px] border-line rounded-xl px-2 py-2.5 text-[15px] text-ink outline-none focus:border-river"
            value={eqQty}
            onChange={(e) => setEqQty(Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addEquipment();
              }
            }}
            aria-label={
              eqKind === "indiv" ? "Quantité par personne" : "Quantité totale"
            }
          />
          <button
            type="button"
            onClick={addEquipment}
            className="px-3 py-2.5 text-sm rounded-xl font-bold bg-ink text-paper shrink-0"
          >
            Ajouter
          </button>
        </div>
        {eqName.trim() && (
          <p className="text-xs mt-1 font-semibold text-signal">
            ↑ « {eqName.trim()} » n&apos;est pas encore ajouté — appuie sur
            « Ajouter » pour l&apos;enregistrer dans la liste.
          </p>
        )}
      </div>

      <div className="mb-3">
        <div className={label}>Rôles à occuper</div>
        <p className="text-xs mb-2 text-ink-soft">
          Les participants pourront se proposer pour ces rôles (responsable
          transport, responsable repas…). Tu restes organisateur·rice quoi
          qu&apos;il arrive.
        </p>
        {keptRoles.map((r) => (
          <div
            key={r.id}
            className={savedRow}
          >
            <span>
              {r.name}{" "}
              <span className="text-ink-soft">
                · {r.capacity} personne{r.capacity > 1 ? "s" : ""}
              </span>
            </span>
            <button
              type="button"
              className="text-refuse font-bold px-2"
              onClick={() => {
                setKeptRoles(keptRoles.filter((k) => k.id !== r.id));
                setRemovedRoles([...removedRoles, r.id]);
              }}
              aria-label={`Retirer ${r.name}`}
            >
              ✕
            </button>
          </div>
        ))}
        {roles.map((r, i) => (
          <div
            key={i}
            className={savedRow}
          >
            <span>
              {r.name}{" "}
              <span className="text-ink-soft">
                · {r.capacity} personne{r.capacity > 1 ? "s" : ""}
              </span>
            </span>
            <button
              type="button"
              className="text-refuse font-bold px-2"
              onClick={() => setRoles(roles.filter((_, j) => j !== i))}
              aria-label={`Retirer ${r.name}`}
            >
              ✕
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            className={`${input} flex-1 min-w-0`}
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRole();
              }
            }}
            placeholder="ex. Responsable transport"
            maxLength={40}
          />
          <input
            type="number"
            min={1}
            max={100}
            className="w-16 shrink-0 text-center bg-card border-[1.5px] border-line rounded-xl px-2 py-2.5 text-[15px] text-ink outline-none focus:border-river"
            value={roleCap}
            onChange={(e) => setRoleCap(Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRole();
              }
            }}
            aria-label="Nombre de personnes pour ce rôle"
          />
          <button
            type="button"
            onClick={addRole}
            className="px-3 py-2.5 text-sm rounded-xl font-bold bg-ink text-paper shrink-0"
          >
            Ajouter
          </button>
        </div>
        {roleName.trim() && (
          <p className="text-xs mt-1 font-semibold text-signal">
            ↑ « {roleName.trim()} » n&apos;est pas encore ajouté — appuie sur
            « Ajouter » pour l&apos;enregistrer dans la liste.
          </p>
        )}
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

      {!edit && (
        <ContactAvailability contacts={contacts} date={date} time={time} />
      )}

      <div className="mb-3">
        <div className={label}>Partager avec les listes (facultatif)</div>
        {lists.length === 0 && (
          <p className="text-sm text-ink-soft">
            Tu n&apos;as pas encore de liste de diffusion — ce n&apos;est pas
            grave : tu pourras inviter qui tu veux avec le lien de partage.
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
              <ListLogo
                list={{
                  name: l.name,
                  color: l.color,
                  emoji: l.emoji,
                  logoUrl: l.logoUrl,
                }}
                size={24}
              />
              {l.name} {on ? "✓" : ""}
            </button>
          );
        })}
        {listIds.length === 0 && (
          <p className="text-xs mt-1 text-ink-soft">
            🔗 Sans liste, l&apos;événement ne sera visible que par les
            personnes à qui tu enverras le lien de partage (bouton « Partager »
            une fois l&apos;événement créé).
          </p>
        )}
      </div>

      {err && (
        <p className="text-sm font-semibold mb-2 text-refuse whitespace-pre-line">
          {err}
        </p>
      )}

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

      {ask &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center sm:justify-center"
            onClick={() => setAsk(null)}
          >
            <div
              className="w-full sm:max-w-md bg-paper rounded-t-2xl sm:rounded-2xl p-5 pb-8"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="titre-alerte-saisie"
            >
              <h3
                id="titre-alerte-saisie"
                className="text-lg font-extrabold mb-2 font-display text-signal"
              >
                ⚠️ Attention
              </h3>
              <p className="text-[15px] leading-relaxed mb-4">
                Tu as commencé à ajouter{" "}
                {ask.item && (
                  <>
                    le matériel <strong>« {ask.item.name} »</strong>
                  </>
                )}
                {ask.item && ask.role && " et "}
                {ask.role && (
                  <>
                    le rôle <strong>« {ask.role.name} »</strong>
                  </>
                )}{" "}
                sans {askPron}enregistrer. Veux-tu tout de même {askPron}
                ajouter ?
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => runSubmit(ask.item, ask.role)}
                  className="w-full px-4 py-2.5 rounded-xl font-bold text-white bg-signal transition-transform active:scale-95"
                >
                  Oui, {askPron}ajouter
                </button>
                <button
                  type="button"
                  onClick={() => runSubmit(null, null)}
                  className="w-full px-4 py-2.5 rounded-xl font-bold text-ink-soft bg-card border-[1.5px] border-line"
                >
                  Non, continuer sans
                </button>
                <button
                  type="button"
                  onClick={() => setAsk(null)}
                  className="w-full py-1.5 text-sm font-bold text-ink-soft"
                >
                  ← Revenir au formulaire
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
