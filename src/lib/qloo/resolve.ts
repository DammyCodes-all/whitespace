/**
 * Day 2 Q: title + tag lookup with not-found lists. Owned by Q.
 *
 * Builds on the Day 1 network boundary (`qlooFetch` in `./client.ts`).
 * No AI proposal, no rival logic, no scoring. Those land Day 3 to Day 5
 * and consume the shapes returned here.
 *
 * Endpoints (per docs.qloo.com):
 * - titles: `GET /search?query=&types=&take=` returns
 *   `{ success, results: [{ entity_id, name, type, subtype, ... }] }`.
 * - tags: `GET /v2/tags?query=&take=` returns
 *   `{ success, results: { tags: [{ tag_id, tag_value, id, name, ... }] } }`.
 *   The `/v2/tags/search` variant 404s in the hackathon env, so this file
 *   calls `/v2/tags` by default, overridable via QLOO_TAGS_PATH for the
 *   live spike. Payload parsing is defensive against both
 *   `results.tags` and bare-`results` array shapes.
 *
 * Spec ref: §6.2 (titles Qloo cannot find are dropped and listed),
 * §6.5 (unmatched words are no-data, coverage always shown),
 * §8 (one miss never fails the batch; retry lives in `qlooFetch`),
 * §6.12 (every call returns its trace for the evidence drawer),
 * §11 (caps guard quota; ranks only, no counts).
 */

import { QlooError, qlooFetch } from "@/lib/qloo/client";
import type { PitchTag, QlooCall, ResolvedTitle, WorkType } from "@/lib/types";

/** Grilled Day 2 decision: caps guard quota (§11). */
export const MAX_TITLE_QUERIES = 10;
export const MAX_TAG_WORDS = 20;

/**
 * Grilled Day 2 decision: `/search` `take=5`, exact-then-first pick.
 * Request a few candidates so an exact name match can beat a
 * popularity-sorted first result; never send a large page.
 */
const SEARCH_TAKE = "5";
const TAG_TAKE = "5";

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

export interface ResolveTagsResult {
  tags: PitchTag[];
  notFoundWords: string[];
  /** Share of suggested words that matched a real Qloo tag (§6.5). Empty input => 1. */
  coverage: number;
  calls: QlooCall[];
}

interface SearchEntity {
  entity_id?: unknown;
  id?: unknown;
  name?: unknown;
  type?: unknown;
  subtype?: unknown;
}

interface TagEntry {
  tag_id?: unknown;
  tag_value?: unknown;
  id?: unknown;
  name?: unknown;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Trim, drop empties, dedupe, cap. Dedupe uses the same normalized key
 * as matching, so "slow-burn" and "slow burn" issue one call (§11). */
function cleanQueries(values: string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const trimmed = raw.trim();
    if (trimmed === "") continue;
    const key = normalizeKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= cap) break;
  }
  return out;
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
 * Tag-search path. Default per docs.qloo.com supporting APIs (`GET
 * /v2/tags`; the `/v2/tags/search` variant 404s in the hackathon env).
 * Unverified live: override with QLOO_TAGS_PATH for the spike without a
 * code change, e.g. `QLOO_TAGS_PATH=/v2/tags/search`.
 */
function tagsPath(): string {
  const raw = process.env.QLOO_TAGS_PATH;
  const path = raw === undefined || raw.trim() === "" ? "/v2/tags" : raw.trim();
  return path.startsWith("/") ? path : `/${path}`;
}

function extractTagEntries(data: unknown): TagEntry[] {
  if (typeof data !== "object" || data === null) return [];
  const root = data as Record<string, unknown>;
  const results = root.results as unknown;
  if (Array.isArray(results)) return results as TagEntry[];
  if (typeof results === "object" && results !== null) {
    const tags = (results as Record<string, unknown>).tags;
    if (Array.isArray(tags)) return tags as TagEntry[];
  }
  return [];
}

function pickTag(word: string, candidates: TagEntry[]): TagEntry | null {
  // Grilled Day 2 decision: lowercased exact match only. No fuzzy matching
  // in code: the AI proposes, Qloo disposes (§7).
  const want = normalizeKey(word);
  if (want === "") return null;
  for (const c of candidates) {
    if (typeof c.name !== "string") continue;
    if (normalizeKey(c.name) === want) return c;
  }
  return null;
}

function toPitchTag(word: string, hit: TagEntry): PitchTag | null {
  const rawId = hit.tag_id ?? hit.tag_value ?? hit.id;
  if (typeof rawId !== "string" || rawId.trim() === "") return null;
  return { tag: word, qlooTagId: rawId, pinned: false };
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

/**
 * §6.5: check each suggested word against Qloo tags. Matches become
 * `PitchTag`s (`pinned: false`; pinning is a later U/S decision).
 * Unmatched words are no-data and stay out of scoring.
 */
export async function resolvePitchTags(
  words: string[],
): Promise<ResolveTagsResult> {
  if (typeof window !== "undefined") {
    throw new Error(
      "resolvePitchTags is server-only and cannot run in the browser.",
    );
  }
  const cleaned = cleanQueries(words, MAX_TAG_WORDS);
  if (cleaned.length === 0) {
    // Grilled Day 2 decision: empty input is vacuous coverage, not failure.
    return { tags: [], notFoundWords: [], coverage: 1, calls: [] };
  }
  const tags: PitchTag[] = [];
  const notFoundWords: string[] = [];
  const calls: QlooCall[] = [];

  for (const word of cleaned) {
    try {
      const { data, trace } = await qlooFetch(tagsPath(), {
        query: word,
        take: TAG_TAKE,
      });
      calls.push(trace);
      const hit = pickTag(word, extractTagEntries(data));
      const tag = hit === null ? null : toPitchTag(word, hit);
      if (tag === null) {
        notFoundWords.push(word);
      } else {
        tags.push(tag);
      }
    } catch (err) {
      if (err instanceof QlooError) {
        calls.push(err.trace);
        notFoundWords.push(word);
      } else {
        throw err;
      }
    }
  }

  return {
    tags,
    notFoundWords,
    coverage: tags.length / cleaned.length,
    calls,
  };
}
