/**
 * Deterministic reach prose built from measured items and gaps.
 *
 * This is the grounding source for the AI rewrite and the fallback when
 * the model is unavailable or its output fails validation. Every
 * sentence here is derived from Qloo's names, ranks and descriptions or
 * from the precomputed gap labels — never from world knowledge.
 *
 * Spec ref: §6.8 (reach plan), §6.10 (result page), §7 (AI writes
 * prose, never facts), §8 (grounding).
 */

import type {
  FlowGapGroup,
  FlowReach,
  FlowReachItem,
  ReachSections,
  ReachSlot,
} from "./contract.ts";

const SLOT_ORDER: ReachSlot[] = [
  "interests",
  "people",
  "podcasts",
  "brands",
  "places",
];

const SLOT_NOUN: Record<Exclude<ReachSlot, "interests">, string> = {
  people: "name",
  podcasts: "show",
  brands: "brand",
  places: "place",
};

const SLOT_LEAD: Record<Exclude<ReachSlot, "interests">, string> = {
  people: "leads",
  podcasts: "is the first listen",
  brands: "is the brand that comes up first",
  places: "is where they turn up first",
};

const DESCRIPTION_MAX = 132;

function upperFirst(value: string): string {
  if (value === "") return value;
  return value[0].toUpperCase() + value.slice(1);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** "A", "A and B", "A, B and C". */
export function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Cut a Qloo blurb at a natural boundary without losing its meaning. */
function shorten(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  // Prefer the first sentence when it can stand alone in an appositive;
  // multi-sentence blurbs would otherwise splice two sentences into one.
  const base = clean.match(/^(.{20,}?[.!?])(?:\s|$)/)?.[1] ?? clean;
  if (base.length <= DESCRIPTION_MAX) return base;
  const head = base.slice(0, DESCRIPTION_MAX);
  const comma = head.lastIndexOf(", ");
  const boundary =
    comma >= 48
      ? comma
      : Math.max(head.lastIndexOf(" "), head.lastIndexOf("; "));
  const cut = boundary > 0 ? head.slice(0, boundary) : head;
  return `${cut.replace(/[\s,;:.!?—–-]+$/, "")}…`;
}

/**
 * Turn "Waterstones is the UK's leading bookseller" into "the UK's
 * leading bookseller" so it can sit in an appositive. Returns null when
 * the description starts with the name in a shape we cannot strip
 * safely; we drop the description rather than duplicate the name.
 */
function stripNamePrefix(name: string, description: string): string | null {
  const lowerName = name.toLowerCase();
  const lowerDescription = description.toLowerCase();
  if (!lowerDescription.startsWith(lowerName)) return description;
  const rest = description.slice(name.length);
  const match = rest.match(/^(?:\s+(?:is|are)\s+|\s*:\s*|\s*,\s*)(.*)$/i);
  if (match === null) return null;
  return match[1].trim();
}

/** The ", description," clause, or "" when no usable description exists. */
function descriptionClause(
  name: string,
  description: string | null | undefined,
): string {
  if (typeof description !== "string" || description.trim() === "") return "";
  const shortened = shorten(description);
  const stripped = stripNamePrefix(name, shortened);
  if (stripped === null || stripped === "") return "";
  const trimmed = stripped.replace(/[.?!]+$/, "");
  const appositive = /^(A|An|The)\s/.test(trimmed)
    ? `${trimmed[0].toLowerCase()}${trimmed.slice(1)}`
    : trimmed;
  return `, ${appositive},`;
}

function rankedSentence(
  slot: Exclude<ReachSlot, "interests">,
  items: FlowReachItem[],
): string | null {
  if (items.length === 0) return null;
  const first = items[0];
  const clause = descriptionClause(first.name, first.description);
  const noun = SLOT_NOUN[slot];
  if (items.length === 1) {
    return `${first.name}${clause} is the only ${noun} that surfaced.`;
  }
  const rest = joinNames(items.slice(1).map((item) => item.name));
  return `${first.name}${clause} ${SLOT_LEAD[slot]}, then ${rest}.`;
}

function interestsSentence(
  items: FlowReachItem[],
  gapGroup: FlowGapGroup | null | undefined,
): string | null {
  if (items.length === 0) return null;
  const first = upperFirst(items[0].name);
  const rest = items.slice(1).map((item) => item.name);
  const lead =
    rest.length === 0
      ? `Their taste list starts with ${first}.`
      : `Their taste list starts with ${first}, then ${joinNames(rest)}.`;

  if (gapGroup === null || gapGroup === undefined || !gapGroup.hasTastes) {
    return lead;
  }

  const interestNames = new Set(items.map((item) => normalize(item.name)));
  const gapLabels = gapGroup.gaps
    .map((gap) => gap.label)
    .filter((label) => interestNames.has(normalize(label)));

  if (gapLabels.length === 0) {
    return `${lead} Your pitch already names these.`;
  }
  const joined = joinNames(gapLabels);
  const tail = gapLabels.length === 1 ? "part" : "parts";
  return `${lead} ${upperFirst(joined)} ${gapLabels.length === 1 ? "is" : "are"} the ${tail} your pitch doesn't reach yet.`;
}

/**
 * Build the four fixed sections plus places when measured. Empty slots
 * are null so the UI can say "not measured" without inventing copy.
 */
export function buildReachSections(
  group: FlowReach,
  gapGroup?: FlowGapGroup | null,
): ReachSections {
  const sections = {} as ReachSections;
  for (const slot of SLOT_ORDER) {
    sections[slot] =
      slot === "interests"
        ? interestsSentence(group.interests, gapGroup)
        : rankedSentence(slot, group[slot]);
  }
  return sections;
}

/**
 * Prefer the attached AI prose, section by section, and fill every other
 * section from the draft. Older saved results and partial model output
 * therefore never render an empty paragraph over measured items.
 */
export function resolveReachSections(
  group: FlowReach,
  gapGroup?: FlowGapGroup | null,
): ReachSections {
  const draft = buildReachSections(group, gapGroup);
  if (group.prose === undefined) return draft;
  const out: ReachSections = { ...draft };
  for (const slot of SLOT_ORDER) {
    if (group[slot].length === 0) continue;
    const text = group.prose[slot];
    if (typeof text === "string" && text.trim() !== "") {
      out[slot] = text;
    }
  }
  return out;
}
