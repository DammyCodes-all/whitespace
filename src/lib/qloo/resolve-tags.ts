/**
 * Day 2 Q: tag lookup with not-found list. Owned by Q.
 *
 * Endpoint (per docs.qloo.com Search Tags, confirmed live):
 * `GET /v2/tags?filter.query=&take=` returns
 * `{ success, results: { tags: [{ name, id, tag_id?, tag_value? }] } }`.
 * The query param is `filter.query`, not `query` (bare `query` 400s).
 * The `/v2/tags/search` variant 404s in the hackathon env, so this file
 * calls `/v2/tags` by default, overridable via QLOO_TAGS_PATH for the
 * live spike. Payload parsing is defensive against both `results.tags`
 * and bare-`results` array shapes.
 *
 * Two passes per word (2026-10-17):
 * 1. Plain substring search, exact-name gate — the original contract.
 * 2. On a miss only, the SAME query with `feature.semantic_search=true`
 *    (verified live 2026-10-17: `lonely` -> `Loneliness`,
 *    `space` -> `Outer Space`; `filter.tag.types` scoping still holds
 *    with the flag on). A semantic hit is the top-ranked result, and its
 *    Qloo display name rides back beside the pitch word so the chip can
 *    show `lonely -> Loneliness` when the two differ. The word stays the
 *    label; Qloo's name is never substituted for it (§6.5).
 *
 * Disable pass 2 with `QLOO_SEMANTIC_TAGS=off` to A/B coverage.
 *
 * Spec ref: §6.5 (unmatched words are no-data, coverage always shown),
 * §8 (one miss never fails the batch), §6.12 (every call traced),
 * §11 (caps guard quota).
 */

import type { PitchTag, QlooCall, WorkType } from "@/lib/types";
import { QlooError, qlooFetch } from "./client.ts";
import { cleanQueries, normalizeKey } from "./resolve-shared.ts";
import { TAG_SCOPES } from "./tag-scopes.ts";

/** Grilled Day 2 decision: caps guard quota (§11). */
export const MAX_TAG_WORDS = 20;

/**
 * Candidates per word. Was 5: substring search on a common word filled
 * all five with near-misses (`Space Opera`, `Living Space`) before the
 * exact hit appeared, so 2026-10-17 raised it to the documented default.
 * Same one call per word, so the raise is free.
 */
const TAG_TAKE = "20";

export interface ResolveTagsResult {
  tags: PitchTag[];
  notFoundWords: string[];
  /** Qloo display names keyed by tag id, for `word -> Name` chips. */
  qlooNames: Record<string, string>;
  /** Words that needed (and got) the semantic pass. */
  semanticWords: string[];
  /** Share of suggested words that matched a real Qloo tag (§6.5). Empty input => 1. */
  coverage: number;
  calls: QlooCall[];
}

interface TagEntry {
  tag_id?: unknown;
  tag_value?: unknown;
  id?: unknown;
  name?: unknown;
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

/**
 * Semantic pass switch, on by default (user call 2026-10-17: "make sure
 * the semantic stuff is actually on"). Opt out for A/B runs with
 * `QLOO_SEMANTIC_TAGS=off|false|0`.
 */
export function semanticTagsEnabled(): boolean {
  const raw = process.env.QLOO_SEMANTIC_TAGS;
  if (raw === undefined || raw.trim() === "") return true;
  const value = raw.trim().toLowerCase();
  return !(value === "off" || value === "false" || value === "0");
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

function tagEntryId(hit: TagEntry): string | null {
  const rawId = hit.tag_id ?? hit.tag_value ?? hit.id;
  return typeof rawId === "string" && rawId.trim() !== "" ? rawId : null;
}

function tagEntryName(hit: TagEntry): string | null {
  return typeof hit.name === "string" && hit.name.trim() !== ""
    ? hit.name.trim()
    : null;
}

function pickTag(
  word: string,
  candidates: TagEntry[],
  preferredIds?: ReadonlySet<string>,
): TagEntry | null {
  // Grilled Day 2 decision: lowercased exact match only. No fuzzy matching
  // in code: the AI proposes, Qloo disposes (§7). Plurals fold to one key
  // (`Vampires` matches `vampire`) inside `normalizeKey`.
  const want = normalizeKey(word);
  if (want === "") return null;
  const exact: TagEntry[] = [];
  for (const c of candidates) {
    if (typeof c.name !== "string") continue;
    if (normalizeKey(c.name) === want) exact.push(c);
  }
  if (exact.length === 0) return null;
  // Same word, several namespaces (e.g. genre:media:dystopia vs
  // keyword:media:dystopia): prefer the variant the audiences actually
  // over-index on, so a real match is not lost to a coin flip. Falls
  // back to the first exact hit when tastes hold none of them.
  if (preferredIds !== undefined) {
    const grounded = exact.find((c) => {
      const id = tagEntryId(c);
      return id !== null && preferredIds.has(id);
    });
    if (grounded !== undefined) return grounded;
  }
  return exact[0] ?? null;
}

/**
 * Semantic-pass pick: an exact name still wins when Qloo returns one;
 * otherwise the top-ranked result is the match Qloo's meaning search
 * chose. Returning null when the top entry carries no id keeps the
 * "not found in Qloo" honesty (§6.5).
 */
function pickSemanticTag(
  word: string,
  candidates: TagEntry[],
  preferredIds?: ReadonlySet<string>,
): TagEntry | null {
  const exact = pickTag(word, candidates, preferredIds);
  if (exact !== null) return exact;
  for (const candidate of candidates) {
    if (tagEntryId(candidate) === null) continue;
    if (tagEntryName(candidate) === null) continue;
    return candidate;
  }
  return null;
}

function toPitchTag(word: string, hit: TagEntry): PitchTag | null {
  const rawId = tagEntryId(hit);
  if (rawId === null) return null;
  return { tag: word, qlooTagId: rawId };
}

function searchParams(
  word: string,
  workType: WorkType | undefined,
  semantic: boolean,
): Record<string, string> {
  return {
    "filter.query": word,
    take: TAG_TAKE,
    ...(workType === undefined
      ? {}
      : { "filter.tag.types": TAG_SCOPES[workType] }),
    ...(semantic ? { "feature.semantic_search": "true" } : {}),
  };
}

/** One word's two-pass lookup: plain, then semantic on a miss. */
async function resolveWord(
  word: string,
  workType: WorkType | undefined,
  preferredTasteIds: ReadonlySet<string> | undefined,
  semanticAllowed: boolean,
  calls: QlooCall[],
): Promise<{ tag: PitchTag; name: string | null; semantic: boolean } | null> {
  try {
    const { data, trace } = await qlooFetch(
      tagsPath(),
      searchParams(word, workType, false),
    );
    calls.push(trace);
    const hit = pickTag(word, extractTagEntries(data), preferredTasteIds);
    if (hit !== null) {
      const tag = toPitchTag(word, hit);
      if (tag !== null) {
        return { tag, name: tagEntryName(hit), semantic: false };
      }
    }
  } catch (err) {
    if (!(err instanceof QlooError)) throw err;
    calls.push(err.trace);
  }
  if (!semanticAllowed) return null;
  try {
    const { data, trace } = await qlooFetch(
      tagsPath(),
      searchParams(word, workType, true),
    );
    calls.push(trace);
    const hit = pickSemanticTag(
      word,
      extractTagEntries(data),
      preferredTasteIds,
    );
    if (hit === null) return null;
    const tag = toPitchTag(word, hit);
    if (tag === null) return null;
    return { tag, name: tagEntryName(hit), semantic: true };
  } catch (err) {
    if (err instanceof QlooError) {
      calls.push(err.trace);
      return null;
    }
    throw err;
  }
}

/**
 * §6.5: check each suggested word against Qloo tags. Matches become
 * `PitchTag`s.
 * Unmatched words are no-data and stay out of scoring. Pass `workType`
 * to scope the search to the domain's namespaces (`./tag-scopes.ts`) so
 * resolved ids share a namespace with audience tastes (§6.6 scoring
 * compares ids); absent scopes nothing (tests, old callers).
 * Pass `preferredTasteIds` (the taste ids audiences actually hold) so a
 * word living in several namespaces resolves to the variant scoring can
 * meet; without it the first exact hit wins. Every id returned still
 * came from Qloo (§7, §8).
 */
export async function resolvePitchTags(
  words: string[],
  workType?: WorkType,
  preferredTasteIds?: ReadonlySet<string>,
): Promise<ResolveTagsResult> {
  if (typeof window !== "undefined") {
    throw new Error(
      "resolvePitchTags is server-only and cannot run in the browser.",
    );
  }
  const cleaned = cleanQueries(words, MAX_TAG_WORDS);
  if (cleaned.length === 0) {
    // Grilled Day 2 decision: empty input is vacuous coverage, not failure.
    return {
      tags: [],
      notFoundWords: [],
      qlooNames: {},
      semanticWords: [],
      coverage: 1,
      calls: [],
    };
  }
  const tags: PitchTag[] = [];
  const notFoundWords: string[] = [];
  const qlooNames: Record<string, string> = {};
  const semanticWords: string[] = [];
  const calls: QlooCall[] = [];
  const semanticAllowed = semanticTagsEnabled();

  for (const word of cleaned) {
    const resolved = await resolveWord(
      word,
      workType,
      preferredTasteIds,
      semanticAllowed,
      calls,
    );
    if (resolved === null) {
      notFoundWords.push(word);
      continue;
    }
    tags.push(resolved.tag);
    if (resolved.name !== null)
      qlooNames[resolved.tag.qlooTagId] = resolved.name;
    if (resolved.semantic) semanticWords.push(word);
  }

  return {
    tags,
    notFoundWords,
    qlooNames,
    semanticWords,
    coverage: tags.length / cleaned.length,
    calls,
  };
}
