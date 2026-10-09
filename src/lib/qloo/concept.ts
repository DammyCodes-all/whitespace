/**
 * Day 11 Q: concept audience tastes. Owned by Q.
 *
 * The hypothesis audience ("fans of these 5 movies") describes film
 * fandom, not the idea itself. The concept audience asks Qloo the
 * complementary question: "who loves THESE TAGS?" — via
 * `signal.interests.tags` on `/v2/insights` with `filter.type=urn:tag`
 * (verified live 2026-10-09: science_fiction tag signal returns
 * tag affinities, 200, tag-scoped). Same rank-order contract as
 * `./tastes.ts`: response order IS the rank (§11), never sorted
 * numerically. Never throws on Qloo failure: failed tastes read as
 * no-data downstream (§6.6, §10 #4).
 *
 * Spec ref: §6.6 (one taste list per audience), §7 (Qloo supplies every
 * number), §8 (one miss never fails the batch), §11 (caps guard quota).
 */

import type { AudienceTastes } from "@/lib/scoring/fit";
import type { QlooCall, WorkType } from "@/lib/types";
import { QlooError, qlooFetch } from "./client.ts";
import { TAG_SCOPES } from "./tag-scopes.ts";

/** At most this many pitch-tag ids signal the concept (quota, focus). */
export const MAX_CONCEPT_TAGS = 5;

/** Same depth as audience tastes: clears the judgement floor with room. */
const CONCEPT_TAKE = "50";

export interface ConceptTastesResult {
  tastes: AudienceTastes;
  /** Null when no fetch ran (no tag ids to signal). */
  call: QlooCall | null;
}

interface ConceptEntry {
  tag_id?: unknown;
  tag_value?: unknown;
  id?: unknown;
  name?: unknown;
}

function toTagId(entry: ConceptEntry): string | null {
  const raw = entry.tag_id ?? entry.tag_value ?? entry.id;
  return typeof raw === "string" && raw.trim() !== "" ? raw : null;
}

function toTagName(entry: ConceptEntry): string {
  return typeof entry.name === "string" ? entry.name.trim() : "";
}

function extractConceptTags(data: unknown): { id: string; name: string }[] {
  if (typeof data !== "object" || data === null) return [];
  const root = data as Record<string, unknown>;
  const results: unknown = root.results;
  let entries: unknown = [];
  if (Array.isArray(results)) {
    entries = results;
  } else if (typeof results === "object" && results !== null) {
    entries = (results as Record<string, unknown>).tags ?? [];
  }
  if (!Array.isArray(entries)) return [];
  const out: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const raw of entries) {
    if (typeof raw !== "object" || raw === null) continue;
    const id = toTagId(raw as ConceptEntry);
    if (id === null || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: toTagName(raw as ConceptEntry) });
  }
  return out;
}

/**
 * Fetch the concept audience's tastes: tags Qloo associates with people
 * who love the given pitch-tag ids. Empty input runs no fetch and
 * returns failed tastes (nothing honest to borrow from).
 */
export async function fetchConceptTastes(
  tagIds: string[],
  workType?: WorkType,
): Promise<ConceptTastesResult> {
  if (typeof window !== "undefined") {
    throw new Error(
      "fetchConceptTastes is server-only and cannot run in the browser.",
    );
  }
  const ids = tagIds
    .filter((id) => id.trim() !== "")
    .slice(0, MAX_CONCEPT_TAGS);
  if (ids.length === 0) {
    return {
      tastes: { audienceId: "concept", tagIds: [], tagNames: [], failed: true },
      call: null,
    };
  }
  try {
    const { data, trace } = await qlooFetch("/v2/insights", {
      "filter.type": "urn:tag",
      "signal.interests.tags": ids.join(","),
      take: CONCEPT_TAKE,
      ...(workType === undefined
        ? {}
        : { "filter.tag.types": TAG_SCOPES[workType] }),
    });
    const tags = extractConceptTags(data);
    return {
      tastes: {
        audienceId: "concept",
        tagIds: tags.map((t) => t.id),
        tagNames: tags.map((t) => t.name),
      },
      call: trace,
    };
  } catch (err) {
    if (err instanceof QlooError) {
      return {
        tastes: {
          audienceId: "concept",
          tagIds: [],
          tagNames: [],
          failed: true,
        },
        call: err.trace,
      };
    }
    throw err;
  }
}
