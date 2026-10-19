/**
 * Qloo similar-title suggestions seeded from the user's own typed
 * titles — never from pitch tags. Owned by Q.
 *
 * One `/v2/insights` call with the resolved title entities as
 * `signal.interests.entities` and `filter.type` set to the pitch's
 * OWN domain entity type, so suggestions are "more titles like the
 * ones you named" (same work type), not tag-overlap guesses. Typed
 * titles are excluded by name so Qloo never suggests back what the
 * user already has.
 *
 * Response order is the rank (§11); nothing is sorted numerically.
 * Convenience only, never a gate: an ordinary Qloo failure yields
 * `{ names: [] }` and records nothing — this route stays trace-free.
 * Rate limits and budget breaches propagate so the route can report a
 * real quota state instead of "no suggestions". Server-only: keys stay
 * server-side.
 *
 * Spec ref: §6.1 (similar-to titles), §7 (Qloo supplies facts),
 * §11 (ranks only, caps guard quota).
 */

import type { WorkType } from "../types.ts";
import { QlooError, qlooFetch } from "./client.ts";
import { WORK_TYPE_TO_ENTITY_TYPE } from "./rival-discovery.ts";

/** Suggestions shown: enough to choose from, few enough to read (§11). */
export const MAX_RELATED_TITLES = 5;

/** Ranked wide so post-trimming leaves enough real names. */
const RELATED_TAKE = "10";

/** Resolved title entities sent as signal (titles cap at 5, §6.2). */
const MAX_SIGNAL_ENTITIES = 5;

export interface RelatedTitlesResult {
  names: string[];
}

interface InsightEntity {
  name?: unknown;
}

function extractNames(data: unknown, exclude: Set<string>): string[] {
  if (typeof data !== "object" || data === null) return [];
  const root = data as Record<string, unknown>;
  const results: unknown = root.results;
  let entries: unknown = [];
  if (Array.isArray(results)) entries = results;
  else if (typeof results === "object" && results !== null) {
    entries = (results as Record<string, unknown>).entities ?? [];
  }
  if (!Array.isArray(entries)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of entries) {
    if (typeof raw !== "object" || raw === null) continue;
    const name = (raw as InsightEntity).name;
    if (typeof name !== "string") continue;
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (trimmed === "") continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key) || exclude.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= MAX_RELATED_TITLES) break;
  }
  return out;
}

/**
 * Suggest same-type titles related to already-resolved title
 * entities. One `/v2/insights` call; never throws on Qloo failure —
 * failures yield `{ names: [] }` with no trace recorded.
 */
export async function suggestFromEntities(
  entityIds: string[],
  excludeNames: string[],
  workType: WorkType,
): Promise<RelatedTitlesResult> {
  if (typeof window !== "undefined") {
    throw new Error("suggestFromEntities is server-only.");
  }
  const ids = entityIds.filter(
    (id): id is string => typeof id === "string" && id.trim() !== "",
  );
  if (ids.length === 0) return { names: [] };
  const exclude = new Set(
    excludeNames
      .filter((n): n is string => typeof n === "string")
      .map((n) => n.trim().toLowerCase())
      .filter((n) => n !== ""),
  );
  try {
    const { data } = await qlooFetch("/v2/insights", {
      "filter.type": WORK_TYPE_TO_ENTITY_TYPE[workType],
      "signal.interests.entities": ids.slice(0, MAX_SIGNAL_ENTITIES).join(","),
      take: RELATED_TAKE,
    });
    return { names: extractNames(data, exclude) };
  } catch (err) {
    // Ordinary Qloo misses are convenience-empty. Rate limits and budget
    // breaches are not misses; let the route return a quota state.
    if (err instanceof QlooError) return { names: [] };
    throw err;
  }
}
