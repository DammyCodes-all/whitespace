/**
 * V2 investigation-lead retrieval (§4G). Owned by Q.
 *
 * Group-seeded reach: up to three frozen core entity IDs from one
 * neighborhood combine into a single multi-interest signal
 * (`signal.interests.entities`) into podcasts and people. Combined
 * signals are a documented multi-interest query, not a proven
 * intersection of people liking every seed — leads are downstream
 * suggestions, never another validation of the hypothesis.
 *
 * Never throws on Qloo failure or budget exhaustion: both become
 * failed outcomes with provenance. Missing leads are acceptable;
 * names, links, and people are never invented. Links surface only
 * when the response carries an http(s) URL; anything else is null.
 *
 * Proposal ref: pipeline-redesign §4D (query mechanics), §4G (leads).
 */

import type { V2Lead } from "../pipeline/v2/types.ts";
import {
  MAX_LEADS_PER_QUERY,
  REACH_SEEDS_PER_GROUP,
} from "../pipeline/v2/types.ts";
import { QlooError, QlooQuotaError, qlooFetch } from "./client.ts";
import type { V2Budget } from "./v2-identity.ts";

/**
 * Reach pair, selected before a run — never swapped per result.
 * Brands/places stay expansion candidates until the core loop proves
 * useful (§4G); maps and headcounts are out of scope.
 */
export const V2_REACH_CATEGORIES = [
  "urn:entity:podcast",
  "urn:entity:person",
] as const;

/** Retrieval window per reach query (versioned heuristic, §4G). */
export const REACH_TAKE = 10;

export interface V2ReachOutcome {
  neighborhoodId: string;
  category: string;
  seedIds: string[];
  status: "ok" | "empty" | "failed";
  leads: V2Lead[];
  queryProvenance: string;
  callId?: string;
  error?: string;
}

/** Accept only returned http(s) URLs; everything else is no link. */
function linkFrom(raw: Record<string, unknown>): string | null {
  const candidates = [
    raw.url,
    raw.link,
    raw.external_url,
    raw.website,
    raw.homepage,
  ];
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
  }
  return null;
}

/**
 * Normalize one reach response into bounded leads. Defensive against
 * `results.entities` and bare-`results` shapes; id-less or nameless
 * entries are skipped, never nulled into the list.
 */
export function normalizeV2Leads(
  data: unknown,
  neighborhoodId: string,
  seedIds: string[],
  category: string,
  queryProvenance: string,
  callId?: string,
): V2Lead[] {
  if (typeof data !== "object" || data === null) return [];
  const results = (data as Record<string, unknown>).results;
  const entries = Array.isArray(results)
    ? results
    : typeof results === "object" && results !== null
      ? (results as Record<string, unknown>).entities
      : [];
  if (!Array.isArray(entries)) return [];
  const out: V2Lead[] = [];
  const seen = new Set<string>();
  for (const raw of entries) {
    if (out.length >= MAX_LEADS_PER_QUERY) break;
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
      type: typeof type === "string" && type !== "" ? type : category,
      neighborhoodId,
      seedIds: [...seedIds],
      category,
      link: linkFrom(entry),
      investigationAction:
        "Ask people familiar with this channel and the returned works to react to the pitch or a sample.",
      queryProvenance,
      ...(callId === undefined ? {} : { callId }),
    });
  }
  return out;
}

/**
 * Fetch one reach category for one neighborhood. Never throws on Qloo
 * failure or budget exhaustion: both become failed outcomes with
 * provenance, so hypotheses survive missing leads.
 */
export async function fetchV2ReachCategory(
  neighborhoodId: string,
  seedIds: string[],
  category: string,
  budget: V2Budget,
  take: number = REACH_TAKE,
): Promise<V2ReachOutcome> {
  const base = { neighborhoodId, category, seedIds: [...seedIds] };
  const seeds = seedIds
    .filter((s) => s.trim() !== "")
    .slice(0, REACH_SEEDS_PER_GROUP);
  if (typeof window !== "undefined") {
    throw new Error("fetchV2ReachCategory is server-only.");
  }
  if (seeds.length === 0) {
    return {
      ...base,
      seedIds: seeds,
      status: "failed",
      leads: [],
      queryProvenance: "v2-reach: no frozen core seeds, no request sent",
    };
  }

  const params: Record<string, string> = {
    "signal.interests.entities": seeds.join(","),
    "filter.type": category,
    take: String(take),
  };

  const started = Date.now();
  const provenanceOf = (status: number | string, callId: string | null) =>
    `v2-reach: /v2/insights seeds=${seeds.length} filter.type=${category} take=${take} ` +
    `status=${status} durationMs=${Date.now() - started}` +
    (callId !== null ? ` callId=${callId}` : "");
  try {
    const { data, trace } = await qlooFetch("/v2/insights", params, budget);
    const provenance = provenanceOf(trace.status, trace.id);
    const leads = normalizeV2Leads(
      data,
      neighborhoodId,
      seeds,
      category,
      provenance,
      trace.id,
    );
    return {
      ...base,
      seedIds: seeds,
      status: leads.length > 0 ? "ok" : "empty",
      leads,
      callId: trace.id,
      queryProvenance: provenance,
    };
  } catch (err) {
    const trace =
      err instanceof QlooError || err instanceof QlooQuotaError
        ? err.trace
        : null;
    const error =
      err instanceof Error ? err.message : "Unknown Qloo request failure.";
    return {
      ...base,
      seedIds: seeds,
      status: "failed",
      leads: [],
      ...(trace === null ? {} : { callId: trace.id }),
      error,
      queryProvenance: `${provenanceOf(trace?.status ?? "error", trace?.id ?? null)} error=${error}`,
    };
  }
}

/**
 * Fetch all reach categories for one neighborhood concurrently.
 * Latency is the slowest single call, not the sum (§6).
 */
export async function fetchV2ReachForNeighborhood(
  neighborhoodId: string,
  seedIds: string[],
  budget: V2Budget,
  categories: readonly string[] = V2_REACH_CATEGORIES,
): Promise<V2ReachOutcome[]> {
  return Promise.all(
    categories.map((category) =>
      fetchV2ReachCategory(neighborhoodId, seedIds, category, budget),
    ),
  );
}
