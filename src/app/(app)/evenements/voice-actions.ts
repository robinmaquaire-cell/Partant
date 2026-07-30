"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { EquipmentDraft, RoleDraft } from "./actions";

// Ce que Claude renvoie après avoir lu la phrase dictée : les champs de
// l'événement, prêts à pré-remplir le formulaire (rien n'est enregistré ici).
export type VoiceDraft = {
  date: string | null; // AAAA-MM-JJ
  time: string | null; // HH:MM
  title: string;
  tags: string[];
  description: string;
  location: string | null;
  max: number; // 0 = illimité
  equipment: EquipmentDraft[];
  roles: RoleDraft[];
};

type Result =
  | { ok: true; draft: VoiceDraft }
  | { ok: false; error: string };

// Schéma imposé à la réponse de Claude (sorties structurées) : on est certain
// de recevoir un JSON exploitable, jamais du texte libre.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    date: {
      type: ["string", "null"],
      description: "Date au format AAAA-MM-JJ, ou null si non mentionnée.",
    },
    time: {
      type: ["string", "null"],
      description: "Heure de rendez-vous au format 24h HH:MM, ou null.",
    },
    title: {
      type: "string",
      description:
        "Titre court de l'événement (ex. « Sortie kayak »). Jamais vide : déduis-en un si besoin.",
    },
    tags: {
      type: "array",
      description:
        "Un ou plusieurs mots-clés qui décrivent l'événement (ex. Sport, Apéro, Repas, Culture, Week-end, Réunion, ou d'autres). Tableau vide si rien de pertinent.",
      items: { type: "string" },
    },
    description: {
      type: "string",
      description:
        "Description libre reprenant les détails utiles, ou chaîne vide.",
    },
    location: {
      type: ["string", "null"],
      description: "Lieu de rendez-vous en clair, ou null.",
    },
    max_participants: {
      type: "integer",
      description:
        "Nombre maximum de participants. Mets 0 si aucun maximum n'est mentionné (0 = illimité).",
    },
    equipment: {
      type: "array",
      description: "Matériel à prévoir, si mentionné.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          kind: {
            type: "string",
            enum: ["indiv", "collectif"],
            description:
              "« indiv » = chacun apporte le sien ; « collectif » = pour le groupe.",
          },
          qty: {
            type: "integer",
            description: "Quantité (au moins 1).",
          },
          category: { type: ["string", "null"] },
        },
        required: ["name", "kind", "qty", "category"],
      },
    },
    roles: {
      type: "array",
      description: "Rôles à occuper, si mentionnés (ex. responsable transport).",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          capacity: { type: "integer", description: "Nombre de personnes (au moins 1)." },
        },
        required: ["name", "capacity"],
      },
    },
  },
  required: [
    "date",
    "time",
    "title",
    "tags",
    "description",
    "location",
    "max_participants",
    "equipment",
    "roles",
  ],
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

// Date du jour + jour de la semaine, heure de Paris, pour que Claude résolve
// « samedi prochain », « demain », « ce soir »…
function parisContext(): { iso: string; human: string } {
  const now = new Date();
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const human = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  return { iso, human };
}

// Lit une phrase dictée (ou tapée) et en déduit les champs de l'événement.
export async function draftEventFromText(text: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu n'es plus connecté·e." };

  const input = (text ?? "").trim();
  if (input.length < 3)
    return { ok: false, error: "Dis-en un peu plus pour que je puisse t'aider." };
  if (input.length > 2000)
    return { ok: false, error: "C'est un peu long — raccourcis ta description." };

  if (!process.env.ANTHROPIC_API_KEY)
    return {
      ok: false,
      error:
        "L'aide vocale n'est pas encore configurée sur cet environnement (clé manquante).",
    };

  const { iso, human } = parisContext();

  const client = new Anthropic();

  let raw: string;
  try {
    // Sorties structurées + réflexion désactivée : extraction rapide et
    // économique, on récupère directement un JSON conforme au schéma.
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      thinking: { type: "disabled" },
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      system:
        "Tu aides à créer un événement entre amis à partir d'une phrase dictée en français. " +
        `Nous sommes le ${human} (${iso}), fuseau Europe/Paris. ` +
        "Résous les dates relatives (« demain », « samedi prochain », « ce soir ») par rapport à cette date. " +
        "Si une information n'est pas donnée, laisse null (ou 0 pour le nombre max, ou un tableau vide). " +
        "N'invente ni lieu, ni matériel, ni rôle : ne remplis que ce qui est réellement dit. " +
        "Le titre, lui, est toujours renseigné : déduis-en un court et clair.",
      messages: [{ role: "user", content: input }],
      // Le SDK peut être en avance/retard sur ces champs récents : on force le
      // typage pour ne pas bloquer la compilation.
    } as unknown as Anthropic.MessageCreateParamsNonStreaming);

    const block = response.content.find((b) => b.type === "text");
    raw = block && "text" in block ? block.text : "";
  } catch (e) {
    console.error("[voix] échec de l'appel Claude :", e);
    return {
      ok: false,
      error: "L'assistant n'a pas répondu. Réessaie dans un instant.",
    };
  }

  let parsed: {
    date: string | null;
    time: string | null;
    title: string;
    tags: string[];
    description: string;
    location: string | null;
    max_participants: number;
    equipment: { name: string; kind: string; qty: number; category: string | null }[];
    roles: { name: string; capacity: number }[];
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: "Je n'ai pas réussi à comprendre — reformule en une phrase simple.",
    };
  }

  // On nettoie et borne tout côté serveur : la réponse du modèle n'est jamais
  // digne de confiance à 100 %.
  const clampInt = (n: unknown, min: number, max: number, fallback: number) => {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  };
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const strOrNull = (v: unknown) => {
    const s = str(v);
    return s || null;
  };

  const equipment: EquipmentDraft[] = (Array.isArray(parsed.equipment) ? parsed.equipment : [])
    .map((it) => ({
      name: str(it?.name).slice(0, 60),
      kind: it?.kind === "indiv" ? ("indiv" as const) : ("collectif" as const),
      qty: clampInt(it?.qty, 1, 999, 1),
      category: strOrNull(it?.category)?.slice(0, 30) ?? null,
    }))
    .filter((it) => it.name.length > 0)
    .slice(0, 30);

  const roles: RoleDraft[] = (Array.isArray(parsed.roles) ? parsed.roles : [])
    .map((r) => ({
      name: str(r?.name).slice(0, 40),
      capacity: clampInt(r?.capacity, 1, 100, 1),
    }))
    .filter((r) => r.name.length > 0)
    .slice(0, 20);

  const date = DATE_RE.test(str(parsed.date)) ? str(parsed.date) : null;
  const time = TIME_RE.test(str(parsed.time)) ? str(parsed.time) : null;

  // Tags : nettoyés, dédoublonnés (casse ignorée), 8 max, 30 caractères max.
  const seenTags = new Set<string>();
  const tags = (Array.isArray(parsed.tags) ? parsed.tags : [])
    .map((t) => str(t).slice(0, 30))
    .filter((t) => {
      const k = t.toLowerCase();
      if (!t || seenTags.has(k)) return false;
      seenTags.add(k);
      return true;
    })
    .slice(0, 8);

  return {
    ok: true,
    draft: {
      date,
      time,
      title: str(parsed.title).slice(0, 120),
      tags,
      description: str(parsed.description).slice(0, 2000),
      location: strOrNull(parsed.location)?.slice(0, 200) ?? null,
      max: clampInt(parsed.max_participants, 0, 1000, 0),
      equipment,
      roles,
    },
  };
}
