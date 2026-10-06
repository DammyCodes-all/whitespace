/**
 * Day 3 Q: audience tastes fetch. Owned by Q.
 *
 * Builds on the Day 1 network boundary (`qlooFetch` in `./client.ts`).
 * No scoring, no verdict, no AI. S consumes the `tagIds` order in
 * `src/lib/scoring/fit.ts`; U links each step to its trace (§6.12).
 * Fixtures first: without a key `qlooFetch` returns a mock payload, so
 * this resolves to failed tastes and the pipeline reports no-data (§6.6).
 *
 * Endpoint (provisional, fixtures first): `GET /v2/insights` with
 * `signal.interests.entities` set to the audience's Qloo entity ids joined
 * by comma. The Day 1 mock uses a single id (`moon-id`); multi-title join
 * is the natural extension and gets confirmed on the live spike. `take`
 * caps the list length so quota stays bounded (§11).
 *
 * Spec ref: §6.6 (one taste list per audience, strongest first, short or
 * failed lists are no-data), §8 (one miss never fails the batch), §6.12
 * (every call returns its trace), §11 (ranks only, never counts; caps
 * guard quota).
 */

import { QlooError, qlooFetch } from "@/lib/qloo/client";
import type { AudienceTastes } from "@/lib/scoring/fit";
import type { Audience, QlooCall } from "@/lib/types";

/** Covers hypothesis + 3 rivals + 20 controls + exclusion with headroom. */
export const MAX_TASTE_AUDIENCES = 25;

/** Quota guard: at most this many entity ids signal one audience. */
export const MAX_ENTITIES_PER_AUDIENCE = 5;

/** Long enough to clear S's judgement floor (10) with headroom. */
const INSIGHTS_TAKE = "50";

export interface FetchTastesResult {
  tastes: AudienceTastes;
  /** Null when no fetch ran (audience has no titles). */
  call: QlooCall | null;
}

export interface FetchAllTastesResult {
  all: AudienceTastes[];
  calls: QlooCall[];
}

interface TasteEntry {
  tag_id?: unknown;
  tag_value?: unknown;
  id?: unknown;
}

function toTagId(entry: TasteEntry): string | null {
  const raw = entry.tag_id ?? entry.tag_value ?? entry.id;
  return typeof raw === "string" && raw.trim() !== "" ? raw : null;
}

/**
 * Pull tag ids in response order. Response order IS the rank (§11), so
 * this never sorts by any numeric affinity field. Defensive against
 * `results.tags` and bare-`results` array shapes; unknown shapes yield [].
 */
function extractTagIds(data: unknown): string[] {
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
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of entries) {
    if (typeof raw !== "object" || raw === null) continue;
    const id = toTagId(raw as TasteEntry);
    if (id === null || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * §6.6: fetch one audience's tastes, strongest first. Never throws on Qloo
 * failure: returns a failed taste list so S reports no-data (§10 #4) and
 * the trace stays available for §6.12.
 */
export async function fetchAudienceTastes(
  audience: Audience,
): Promise<FetchTastesResult> {
  if (typeof window !== "undefined") {
    throw new Error(
      "fetchAudienceTastes is server-only and cannot run in the browser.",
    );
  }
  const ids = audience.titles
    .map((t) => t.qlooId)
    .filter((id) => id.trim() !== "")
    .slice(0, MAX_ENTITIES_PER_AUDIENCE);
  if (ids.length === 0) {
    return {
      tastes: { audienceId: audience.id, tagIds: [], failed: true },
      call: null,
    };
  }
  try {
    const { data, trace } = await qlooFetch("/v2/insights", {
      "signal.interests.entities": ids.join(","),
      take: INSIGHTS_TAKE,
    });
    return {
      tastes: { audienceId: audience.id, tagIds: extractTagIds(data) },
      call: trace,
    };
  } catch (err) {
    if (err instanceof QlooError) {
      return {
        tastes: { audienceId: audience.id, tagIds: [], failed: true },
        call: err.trace,
      };
    }
    throw err;
  }
}

/**
 * Fetch tastes for a batch of audiences in order. One miss never throws
 * (§8): the batch always resolves and every attempted call is traced.
 */
export async function fetchAllAudienceTastes(
  audiences: Audience[],
): Promise<FetchAllTastesResult> {
  if (typeof window !== "undefined") {
    throw new Error(
      "fetchAllAudienceTastes is server-only and cannot run in the browser.",
    );
  }
  const all: AudienceTastes[] = [];
  const calls: QlooCall[] = [];
  for (const audience of audiences.slice(0, MAX_TASTE_AUDIENCES)) {
    const { tastes, call } = await fetchAudienceTastes(audience);
    all.push(tastes);
    if (call !== null) calls.push(call);
  }
  return { all, calls };
}
