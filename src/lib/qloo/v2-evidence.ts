/**
 * V2 discovery retrieval. Owned by Q.
 *
 * One frozen reference lens × the pre-selected target categories into
 * `GET /v2/insights`. Fixed take, server-side seed exclusion plus the
 * same exclusion applied locally, normalized entity metadata
 * (id+name together, response position, returned tag ids), and honest
 * status separation: ok, empty (completed but nothing usable), failed
 * (upstream problem — never disguised as empty).
 *
 * Numeric affinities are not read at all: response order is the rank.
 * Category queries run concurrently; attempts share the run budget.
 *
 * Proposal ref: pipeline-redesign §4D.
 */

import type {
  V2LensRetrieval,
  V2ReturnedEntity,
} from "../pipeline/v2/types.ts";
import { RETRIEVAL_TAKE } from "../pipeline/v2/types.ts";
import { QlooError, QlooQuotaError, qlooFetch } from "./client.ts";
import type { V2Budget } from "./v2-identity.ts";

export interface V2DiscoveryOutcome extends V2LensRetrieval {
  error?: string;
}

/**
 * Lean pair, selected before a run — never swapped per result (§4D).
 * Pilot basis (`docs/qloo-coverage.md`): movie/book pairs shared zero
 * entities at depth ≤50 in every test pair, while artist overlap gave
 * a coherent 5-shared neighborhood for related lenses and zero for
 * unrelated ones. Artists carry the grouping; movies stay for
 * reference-shaped exploration.
 */
export const V2_DISCOVERY_CATEGORIES = [
  "urn:entity:movie",
  "urn:entity:artist",
] as const;

function tagIdsFrom(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    let id: unknown = null;
    if (typeof entry === "object" && entry !== null) {
      const record = entry as Record<string, unknown>;
      id = record.id ?? record.tag_id ?? record.tag_value;
    } else if (typeof entry === "string") {
      id = entry;
    }
    if (typeof id === "string" && id !== "" && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Normalize one insights response into ranked entities. Defensive
 * against `results.entities` and bare-`results` shapes; id-less or
 * nameless entries are skipped, never nulled into the list.
 */
export function normalizeV2Entities(data: unknown): V2ReturnedEntity[] {
  if (typeof data !== "object" || data === null) return [];
  const results = (data as Record<string, unknown>).results;
  const entries = Array.isArray(results)
    ? results
    : typeof results === "object" && results !== null
      ? (results as Record<string, unknown>).entities
      : [];
  if (!Array.isArray(entries)) return [];
  const out: V2ReturnedEntity[] = [];
  const seen = new Set<string>();
  for (const raw of entries) {
    if (typeof raw !== "object" || raw === null) continue;
    const entry = raw as Record<string, unknown>;
    const id = entry.entity_id ?? entry.id;
    const name = entry.name;
    if (
      typeof id !== "string" ||
      id === "" ||
      typeof name !== "string" ||
      name.trim() === ""
    ) {
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    const type = entry.subtype ?? entry.type;
    out.push({
      id,
      name: name.trim(),
      type: typeof type === "string" && type !== "" ? type : "urn:entity",
      position: out.length + 1,
      tags: tagIdsFrom(entry.tags),
    });
  }
  return out;
}

/**
 * Fetch one category for one frozen lens. Never throws on Qloo
 * failure or budget exhaustion: both become failed outcomes
 * with provenance, so partial results keep their failure details.
 */
export async function fetchV2DiscoveryCategory(
  entityId: string,
  aspectId: string,
  category: string,
  excludeIds: string[],
  budget: V2Budget,
  take: number = RETRIEVAL_TAKE,
): Promise<V2DiscoveryOutcome> {
  if (typeof window !== "undefined") {
    throw new Error("fetchV2DiscoveryCategory is server-only.");
  }
  const base = { aspectId, category, entities: [], queryProvenance: "" };
  if (entityId.trim() === "") {
    return {
      ...base,
      status: "failed",
      queryProvenance: "v2-discovery: empty seed id, no request sent",
    };
  }

  const params: Record<string, string> = {
    "signal.interests.entities": entityId,
    "filter.type": category,
    take: String(take),
  };
  if (excludeIds.length > 0) {
    params["filter.exclude.entities"] = excludeIds.join(",");
  }

  const started = Date.now();
  const provenanceOf = (status: number | string, callId: string | null) =>
    `v2-discovery: /v2/insights filter.type=${category} take=${take} ` +
    `excluded=${excludeIds.length} status=${status} durationMs=${Date.now() - started}` +
    (callId !== null ? ` callId=${callId}` : "");
  try {
    const { data, trace } = await qlooFetch("/v2/insights", params, budget);
    const banned = new Set(excludeIds);
    const entities = normalizeV2Entities(data).filter((e) => !banned.has(e.id));
    return {
      aspectId,
      category,
      status: entities.length > 0 ? "ok" : "empty",
      entities,
      callId: trace.id,
      queryProvenance: provenanceOf(trace.status, trace.id),
    };
  } catch (err) {
    const trace =
      err instanceof QlooError || err instanceof QlooQuotaError
        ? err.trace
        : null;
    const error =
      err instanceof Error ? err.message : "Unknown Qloo request failure.";
    return {
      aspectId,
      category,
      status: "failed",
      entities: [],
      ...(trace === null ? {} : { callId: trace.id }),
      error,
      queryProvenance: `${provenanceOf(trace?.status ?? "error", trace?.id ?? null)} error=${error}`,
    };
  }
}

/**
 * Fetch all discovery categories for one frozen lens concurrently.
 * Latency is the slowest single call, not the sum (§6).
 */
export async function fetchV2DiscoveryLens(
  entityId: string,
  aspectId: string,
  excludeIds: string[],
  budget: V2Budget,
  categories: readonly string[] = V2_DISCOVERY_CATEGORIES,
): Promise<V2DiscoveryOutcome[]> {
  return Promise.all(
    categories.map((category) =>
      fetchV2DiscoveryCategory(
        entityId,
        aspectId,
        category,
        excludeIds,
        budget,
      ),
    ),
  );
}
