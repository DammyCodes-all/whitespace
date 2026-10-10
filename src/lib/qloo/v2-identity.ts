/**
 * V2 reference identity resolution. Owned by Q.
 *
 * Resolves one proposed reference name through Qloo entity search and
 * classifies the outcome as resolved, ambiguous, not_found, or
 * request_failed. Never accepts the first hit merely because something
 * came back: an exact normalized name/alias match inside the requested
 * entity type wins; multiple exact matches are ambiguity, not a pick;
 * fuzzy-only results are not_found with closest names for messaging.
 *
 * Network is a thin wrapper over `qlooFetch`; the classification is
 * pure and fixture-tested. Attempt accounting is request-scoped: the
 * orchestrator owns the budget object, one run never spends another's.
 *
 * Proposal ref: pipeline-redesign §4B. Shape probe: only field names
 * and value vocabulary from live responses informed this code; no
 * response payloads are stored in the repo.
 */

import type { V2IdentityState } from "../pipeline/v2/types.ts";
import {
  QlooError,
  QlooQuotaError,
  type QlooRequestContext,
  qlooFetch,
} from "./client.ts";

/** Small page: enough candidates to beat a popularity-sorted first hit. */
export const V2_SEARCH_TAKE = "5";

/** Request-scoped attempt budget. The orchestrator creates one per run. */
export interface V2Budget extends QlooRequestContext {}

/** True when another HTTP attempt may be spent. */
export function budgetAllows(budget: V2Budget): boolean {
  return !budget.signal?.aborted && budget.used < budget.ceiling;
}

/** Parsed search candidate (opaque catalog text, never invented). */
export interface V2SearchCandidate {
  id: string;
  name: string;
  types: string[];
  akas: string[];
  year: number | null;
  disambiguation: string;
  popularity: number;
  /** Tag ids on the hit: reused for bridge support, no extra call. */
  tagIds: string[];
}

/** Local mirror of the shared normalizeKey (Q-owned file, no import). */
export function normalizeV2Name(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function toYear(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function toStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && v !== "");
}

function tagIdsFrom(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry === "object" && entry !== null) {
      const id = (entry as Record<string, unknown>).id;
      if (typeof id === "string" && id !== "") out.push(id);
    } else if (typeof entry === "string" && entry !== "") {
      out.push(entry);
    }
  }
  return out;
}

/** Parse one raw search hit; null when it lacks identity (no id/name). */
export function parseV2Candidate(raw: unknown): V2SearchCandidate | null {
  if (typeof raw !== "object" || raw === null) return null;
  const hit = raw as Record<string, unknown>;
  const id = hit.entity_id ?? hit.id;
  const name = hit.name;
  if (
    typeof id !== "string" ||
    id === "" ||
    typeof name !== "string" ||
    name.trim() === ""
  ) {
    return null;
  }
  const props =
    typeof hit.properties === "object" && hit.properties !== null
      ? (hit.properties as Record<string, unknown>)
      : {};
  const disambiguation = hit.disambiguation;
  const popularity = hit.popularity;
  return {
    id,
    name: name.trim(),
    types: [
      ...new Set([
        ...toStringList(hit.types),
        ...(typeof hit.types === "string" && hit.types !== ""
          ? [hit.types]
          : []),
        ...toStringList(hit.type),
        ...(typeof hit.type === "string" && hit.type !== "" ? [hit.type] : []),
      ]),
    ],
    akas: toStringList(props.akas),
    year: toYear(props.release_year ?? props.publication_year),
    disambiguation: typeof disambiguation === "string" ? disambiguation : "",
    popularity: typeof popularity === "number" ? popularity : 0,
    tagIds: tagIdsFrom(hit.tags),
  };
}

export interface V2IdentityOutcome {
  state: V2IdentityState;
  query: string;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  year: number | null;
  /** All exact matches, for ambiguity display. Never auto-picked. */
  exactMatches: V2SearchCandidate[];
  /** Fuzzy names, labeled non-matches for not-found messaging. */
  closestNames: string[];
  /** Hit tag ids when resolved, for bridge support without extra calls. */
  tagIds: string[];
  provenance: string;
  callId?: string;
  error?: string;
}

/**
 * Pure classification: exact normalized name/alias matches inside the
 * requested entity type. One match resolves; several are ambiguous;
 * none is not_found. Candidates with a non-empty types list that
 * omits the requested type never match.
 */
export function classifyV2Identity(
  query: string,
  candidates: V2SearchCandidate[],
  entityType: string,
): Omit<V2IdentityOutcome, "provenance"> {
  const base = {
    query,
    entityType,
    entityId: null as string | null,
    entityName: null as string | null,
    year: null as number | null,
    exactMatches: [] as V2SearchCandidate[],
    closestNames: [] as string[],
    tagIds: [] as string[],
  };
  const want = normalizeV2Name(query);
  const typed = candidates.filter(
    (c) => c.types.length === 0 || c.types.includes(entityType),
  );
  const exact = typed.filter(
    (c) =>
      normalizeV2Name(c.name) === want ||
      c.akas.some((a) => normalizeV2Name(a) === want),
  );
  if (exact.length === 1) {
    const hit = exact[0];
    return {
      ...base,
      state: "resolved",
      entityId: hit.id,
      entityName: hit.name,
      year: hit.year,
      exactMatches: exact,
      tagIds: hit.tagIds,
    };
  }
  if (exact.length > 1) {
    return {
      ...base,
      state: "ambiguous",
      exactMatches: [...exact].sort((a, b) => b.popularity - a.popularity),
      closestNames: [],
    };
  }
  return {
    ...base,
    state: "not_found",
    closestNames: typed.slice(0, 3).map((c) => c.name),
  };
}

/**
 * Resolve one reference name. Never throws on Qloo failure: failures
 * become request_failed with provenance. Budget-exhaustion also
 * becomes request_failed without spending a call.
 */
export async function resolveV2Reference(
  query: string,
  entityType: string,
  budget: V2Budget,
): Promise<V2IdentityOutcome> {
  if (typeof window !== "undefined") {
    throw new Error("resolveV2Reference is server-only.");
  }
  const clean = query.trim().replace(/\s+/g, " ");
  if (clean === "") {
    return {
      query,
      entityType,
      state: "not_found",
      entityId: null,
      entityName: null,
      year: null,
      exactMatches: [],
      closestNames: [],
      tagIds: [],
      provenance: "v2-identity: empty query, no request sent",
    };
  }

  const started = Date.now();
  try {
    const { data, trace } = await qlooFetch(
      "/search",
      {
        query: clean,
        types: entityType,
        take: V2_SEARCH_TAKE,
      },
      budget,
    );
    const raw =
      typeof data === "object" && data !== null
        ? (data as Record<string, unknown>).results
        : [];
    const candidates = (Array.isArray(raw) ? raw : [])
      .map(parseV2Candidate)
      .filter((c): c is V2SearchCandidate => c !== null);
    return {
      ...classifyV2Identity(clean, candidates, entityType),
      callId: trace.id,
      provenance:
        `v2-identity: /search types=${entityType} take=${V2_SEARCH_TAKE} ` +
        `status=${trace.status} durationMs=${Date.now() - started} ` +
        `candidates=${candidates.length} callId=${trace.id}`,
    };
  } catch (err) {
    const trace =
      err instanceof QlooError || err instanceof QlooQuotaError
        ? err.trace
        : null;
    const error =
      err instanceof Error ? err.message : "Unknown Qloo request failure.";
    return {
      query: clean,
      entityType,
      state: "request_failed",
      entityId: null,
      entityName: null,
      year: null,
      exactMatches: [],
      closestNames: [],
      tagIds: [],
      ...(trace === null ? {} : { callId: trace.id }),
      error,
      provenance:
        `v2-identity: /search failed: ${error}` +
        (trace !== null
          ? ` status=${trace.status} callId=${trace.id}`
          : " (no trace)") +
        ` durationMs=${Date.now() - started}`,
    };
  }
}
