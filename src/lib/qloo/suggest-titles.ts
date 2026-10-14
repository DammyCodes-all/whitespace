/**
 * Qloo similar-title suggestions for the tag step. Owned by Q.
 *
 * One `/v2/insights` call with the pitch's matched tag ids as
 * `signal.interests.tags` and `filter.type` set to the pitch's OWN
 * domain entity type, so suggestions are "similar titles" (same work
 * type), not cross-domain readings — rivals already cover those.
 *
 * Response order is the rank (§11); nothing is sorted numerically.
 * Convenience only, never a gate: any Qloo failure yields
 * `{ names: [] }` and records nothing — this route stays trace-free
 * like the check route. Server-only: keys stay server-side.
 *
 * Spec ref: §6.2 (similar-to titles), §7 (Qloo supplies facts),
 * §11 (ranks only, caps guard quota).
 */

import type { WorkType } from "../types.ts";
import { qlooFetch } from "./client.ts";
import { WORK_TYPE_TO_ENTITY_TYPE } from "./rival-discovery.ts";

/** Suggestions shown: enough to choose from, few enough to read (§11). */
export const MAX_SUGGESTED_TITLES = 5;

/** Ranked wide so post-trimming leaves enough real names. */
const SUGGEST_TAKE = "10";

/** Matched tag ids sent as signal (at most TAG_WORDS.max = 8 ids). */
const MAX_SIGNAL_TAGS = 8;

export interface SuggestTitlesResult {
  names: string[];
}

interface InsightEntity {
  name?: unknown;
}

function extractNames(data: unknown): string[] {
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
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= MAX_SUGGESTED_TITLES) break;
  }
  return out;
}

/**
 * Suggest same-type titles sharing the pitch's matched tags. One
 * `/v2/insights` call; never throws on Qloo failure — failures yield
 * `{ names: [] }` with no trace recorded.
 */
export async function suggestTitles(
  tagIds: string[],
  workType: WorkType,
): Promise<SuggestTitlesResult> {
  if (typeof window !== "undefined") {
    throw new Error("suggestTitles is server-only.");
  }
  const ids = tagIds.filter(
    (id): id is string => typeof id === "string" && id.trim() !== "",
  );
  if (ids.length === 0) return { names: [] };
  try {
    const { data } = await qlooFetch("/v2/insights", {
      "filter.type": WORK_TYPE_TO_ENTITY_TYPE[workType],
      "signal.interests.tags": ids.slice(0, MAX_SIGNAL_TAGS).join(","),
      take: SUGGEST_TAKE,
    });
    return { names: extractNames(data) };
  } catch {
    return { names: [] };
  }
}
