/**
 * Day 2 Q: title lookup with not-found list. Owned by Q.
 *
 * Endpoint (per docs.qloo.com): `GET /search?query=&types=&take=`
 * returns `{ success, results: [{ entity_id, name, type, subtype }] }`.
 *
 * Spec ref: §6.2 (titles Qloo cannot find are dropped and listed),
 * §8 (one miss never fails the batch; retry lives in `qlooFetch`),
 * §6.12 (every call returns its trace), §11 (caps guard quota).
 */

import { QlooError, qlooFetch } from "@/lib/qloo/client";
import { cleanQueries, normalizeKey } from "@/lib/qloo/resolve-shared";
import type { QlooCall, ResolvedTitle, WorkType } from "@/lib/types";

/** Grilled Day 2 decision: caps guard quota (§11). */
export const MAX_TITLE_QUERIES = 10;

/**
 * Grilled Day 2 decision: `/search` `take=5`, exact-then-first pick.
 * Request a few candidates so an exact name match can beat a
 * popularity-sorted first result; never send a large page.
 */
const SEARCH_TAKE = "5";

/**
 * Grilled Day 2 decision: WorkType to `/search` types map.
 * Values are taken from the `/search` OpenAPI enum (movie, artist, book,
 * videogame). Unknown types omit `types` rather than guessing.
 */
export const WORK_TYPE_TO_SEARCH_TYPES: Record<WorkType, string> = {
  film: "urn:entity:movie",
  music: "urn:entity:artist",
  book: "urn:entity:book",
  game: "urn:entity:videogame",
};

export interface ResolveTitlesResult {
  resolved: ResolvedTitle[];
  notFoundTitles: string[];
  calls: QlooCall[];
}

interface SearchEntity {
  entity_id?: unknown;
  id?: unknown;
  name?: unknown;
  type?: unknown;
  subtype?: unknown;
}

function asArray(value: unknown): SearchEntity[] {
  return Array.isArray(value) ? (value as SearchEntity[]) : [];
}

function pickSearchResult(
  query: string,
  candidates: SearchEntity[],
): SearchEntity | null {
  const valid = candidates.filter(
    (c) => typeof c.name === "string" && c.name.trim() !== "",
  );
  if (valid.length === 0) return null;
  // Grilled Day 2 decision: case-insensitive exact match wins (hyphens and
  // underscores treated as spaces, so "slow-burn" matches "Slow Burn").
  const want = normalizeKey(query);
  const exact = valid.find((c) => normalizeKey(c.name as string) === want);
  return exact ?? valid[0] ?? null;
}

function toResolvedTitle(
  query: string,
  hit: SearchEntity,
): ResolvedTitle | null {
  const rawId = hit.entity_id ?? hit.id;
  if (typeof rawId !== "string" || rawId.trim() === "") return null;
  const rawName = hit.name;
  if (typeof rawName !== "string" || rawName.trim() === "") return null;
  const rawType = hit.subtype ?? hit.type;
  return {
    query,
    qlooId: rawId,
    name: rawName,
    type:
      typeof rawType === "string" && rawType !== "" ? rawType : "urn:entity",
  };
}

/**
 * §6.2: look up each title in Qloo. Found titles resolve; the rest are
 * dropped and listed as not-found. One miss never throws (§8): its trace
 * is kept in `calls` and the batch always resolves.
 */
export async function resolveTitles(
  queries: string[],
  workType: WorkType,
): Promise<ResolveTitlesResult> {
  if (typeof window !== "undefined") {
    throw new Error(
      "resolveTitles is server-only and cannot run in the browser.",
    );
  }
  const cleaned = cleanQueries(queries, MAX_TITLE_QUERIES);
  const resolved: ResolvedTitle[] = [];
  const notFoundTitles: string[] = [];
  const calls: QlooCall[] = [];
  const types = WORK_TYPE_TO_SEARCH_TYPES[workType];

  for (const query of cleaned) {
    const params: Record<string, string> = { query, take: SEARCH_TAKE };
    if (types !== undefined && types !== "") params.types = types;
    try {
      const { data, trace } = await qlooFetch("/search", params);
      calls.push(trace);
      const candidates = asArray(
        (data as Record<string, unknown> | null)?.results,
      );
      const hit = pickSearchResult(query, candidates);
      const title = hit === null ? null : toResolvedTitle(query, hit);
      if (title === null) {
        notFoundTitles.push(query);
      } else {
        resolved.push(title);
      }
    } catch (err) {
      // Per-item never throws on Qloo failures: record not-found, keep the
      // trace for §6.12. Programming errors propagate so bugs stay visible.
      if (err instanceof QlooError) {
        calls.push(err.trace);
        notFoundTitles.push(query);
      } else {
        throw err;
      }
    }
  }

  return { resolved, notFoundTitles, calls };
}
