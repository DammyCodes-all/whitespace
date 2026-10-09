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

const TAG_TAKE = "5";

export interface ResolveTagsResult {
  tags: PitchTag[];
  notFoundWords: string[];
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

function pickTag(
  word: string,
  candidates: TagEntry[],
  preferredIds?: ReadonlySet<string>,
): TagEntry | null {
  // Grilled Day 2 decision: lowercased exact match only. No fuzzy matching
  // in code: the AI proposes, Qloo disposes (§7).
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

function toPitchTag(word: string, hit: TagEntry): PitchTag | null {
  const rawId = tagEntryId(hit);
  if (rawId === null) return null;
  return { tag: word, qlooTagId: rawId, pinned: false };
}

/**
 * §6.5: check each suggested word against Qloo tags. Matches become
 * `PitchTag`s (`pinned: false`; pinning is a later U/S decision).
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
    return { tags: [], notFoundWords: [], coverage: 1, calls: [] };
  }
  const tags: PitchTag[] = [];
  const notFoundWords: string[] = [];
  const calls: QlooCall[] = [];

  for (const word of cleaned) {
    try {
      const { data, trace } = await qlooFetch(tagsPath(), {
        "filter.query": word,
        take: TAG_TAKE,
        ...(workType === undefined
          ? {}
          : { "filter.tag.types": TAG_SCOPES[workType] }),
      });
      calls.push(trace);
      const hit = pickTag(word, extractTagEntries(data), preferredTasteIds);
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
