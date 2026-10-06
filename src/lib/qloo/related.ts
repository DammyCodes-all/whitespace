/**
 * Day 7 Q: related items per audience (reach plan). Owned by Q.
 *
 * For one audience, fetches what it loves across four categories —
 * podcasts, people, brands, places — via `GET /v2/insights` with
 * `signal.interests.entities` set to the audience's title ids and
 * `filter.type` set per category. The user's own titles are excluded
 * server-side (`filter.exclude.entities`) and filtered client-side
 * (mock mode honors only the latter).
 *
 * Never throws on Qloo failure: a failed category resolves to an empty
 * list with its trace, which downstream renders as no-data (§10 #4).
 * Fixtures first (no live key yet); Day 6-style live swap changes the
 * fetch internals, not this return shape.
 *
 * Spec ref: §6.8 (reach plan, ~5 of each, dedupe user titles),
 * §6.12 (every item links its call), §11 (ranks only, caps guard quota).
 */

import type { Audience, QlooCall } from "../types.ts";
import { QlooError, qlooFetch } from "./client.ts";
import { normalizeKey } from "./resolve-shared.ts";

export const RELATED_KINDS = ["podcast", "person", "brand", "place"] as const;

export type RelatedKind = (typeof RELATED_KINDS)[number];

/** Fetched wide (8) so post-dedupe trimming still leaves ~5 (§6.8). */
export const RELATED_TAKE = "8";

/** §6.8 "about five of each". */
export const RELATED_TRIM = 5;

/** Audience title ids signalled per call: enough to steer, few enough for quota. */
export const MAX_SIGNAL_IDS = 5;

export interface RelatedItem {
  entityId: string;
  name: string;
  kind: RelatedKind;
  /** 1-based position in Qloo's order. Ranks only, never scores (§11). */
  affinityRank: number;
  /** §6.12 trace ref for the call this item came from. */
  callId: string;
}

export interface RelatedResult {
  kind: RelatedKind;
  items: RelatedItem[];
  /** Null when no fetch ran (audience has no titles). */
  call: QlooCall | null;
}

/**
 * Category to `/v2/insights` filter type. Throws on unknown kinds:
 * an unmapped category is a programming bug, fail loud.
 */
export function kindToFilterType(kind: RelatedKind): string {
  switch (kind) {
    case "podcast":
      return "urn:entity:podcast";
    case "person":
      return "urn:entity:person";
    case "brand":
      return "urn:entity:brand";
    case "place":
      return "urn:entity:place";
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unknown related kind: ${String(exhaustive)}`);
    }
  }
}

interface RelatedEntity {
  entity_id?: unknown;
  id?: unknown;
  name?: unknown;
}

/**
 * Entities in, ranked items out. Rank is response position, never any
 * numeric score (§11). Defensive against `results.entities` and
 * bare-`results` array shapes; nameless or id-less entries are skipped.
 */
export function extractRelated(
  data: unknown,
  kind: RelatedKind,
  callId: string,
): RelatedItem[] {
  if (typeof data !== "object" || data === null) return [];
  const root = data as Record<string, unknown>;
  const results: unknown = root.results;
  let entries: unknown = [];
  if (Array.isArray(results)) {
    entries = results;
  } else if (typeof results === "object" && results !== null) {
    entries = (results as Record<string, unknown>).entities ?? [];
  }
  if (!Array.isArray(entries)) return [];
  const items: RelatedItem[] = [];
  const seen = new Set<string>();
  for (const raw of entries) {
    if (typeof raw !== "object" || raw === null) continue;
    const entry = raw as RelatedEntity;
    const rawId = entry.entity_id ?? entry.id;
    const rawName = entry.name;
    if (typeof rawId !== "string" || rawId.trim() === "") continue;
    if (typeof rawName !== "string" || rawName.trim() === "") continue;
    if (seen.has(rawId)) continue;
    seen.add(rawId);
    items.push({
      entityId: rawId,
      name: rawName,
      kind,
      affinityRank: items.length + 1,
      callId,
    });
  }
  return items;
}

/**
 * §6.8: drop the user's own titles from related items. Matches by entity
 * id and by normalized name, so a differently-cased re-listing of an
 * input title is still caught. Runs after fetching, before trimming.
 */
export function dedupeUserTitles(
  items: RelatedItem[],
  excludeIds: string[],
  excludeNames: string[],
): RelatedItem[] {
  const ids = new Set(excludeIds);
  const names = new Set(excludeNames.map(normalizeKey));
  return items.filter(
    (item) => !ids.has(item.entityId) && !names.has(normalizeKey(item.name)),
  );
}

/**
 * §6.8: fetch one category for one audience. Never throws on Qloo
 * failure: returns an empty list with the trace so downstream renders
 * no-data (§10 #4). Programming errors propagate so bugs stay visible.
 */
export async function fetchRelatedKind(
  audience: Audience,
  kind: RelatedKind,
  excludeIds: string[] = [],
): Promise<RelatedResult> {
  if (typeof window !== "undefined") {
    throw new Error(
      "fetchRelatedKind is server-only and cannot run in the browser.",
    );
  }
  const ids = audience.titles
    .map((t) => t.qlooId)
    .filter((id) => id.trim() !== "")
    .slice(0, MAX_SIGNAL_IDS);
  if (ids.length === 0) {
    return { kind, items: [], call: null };
  }
  const params: Record<string, string> = {
    "signal.interests.entities": ids.join(","),
    "filter.type": kindToFilterType(kind),
    take: RELATED_TAKE,
  };
  if (excludeIds.length > 0) {
    params["filter.exclude.entities"] = excludeIds.join(",");
  }
  try {
    const { data, trace } = await qlooFetch("/v2/insights", params);
    const items = dedupeUserTitles(
      extractRelated(data, kind, trace.id),
      excludeIds,
      audience.titles.map((t) => t.name),
    ).slice(0, RELATED_TRIM);
    return { kind, items, call: trace };
  } catch (err) {
    if (err instanceof QlooError) {
      return { kind, items: [], call: err.trace };
    }
    throw err;
  }
}

/**
 * §6.8: fetch all four categories for one audience. Independent calls
 * run concurrently (latency is the slowest single call, not the sum).
 * Never throws: per-kind never-throw makes the batch safe by
 * construction.
 */
export async function fetchRelated(
  audience: Audience,
  excludeIds: string[] = [],
): Promise<RelatedResult[]> {
  return Promise.all(
    RELATED_KINDS.map((kind) => fetchRelatedKind(audience, kind, excludeIds)),
  );
}
