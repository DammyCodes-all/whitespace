/**
 * Run-level grounding enforcement (§8, §10 #1).
 *
 * `policy/grounding.ts` only compares id sets. This module collects the
 * sets a flow run actually produced and strips anything the comparison
 * rejects, so `ok: false` can never coexist with an ungrounded id still
 * on screen. The run calls it before scoring (tags) and after output
 * assembly (titles, tags, reach entities).
 *
 * Grounded sources per run:
 * - titles: `/search` resolutions (similar titles and control seeds) and
 *   entities `/v2/insights` returned (rivals, strangers, reach items)
 * - tags: the confirmed chip-step matches (resolved by `/v2/tags` in
 *   step 2), every tag id in the run's taste lists, and bridge targets
 *   (validated against those same fetched tastes)
 *
 * Spec ref: §8 (ungrounded output is removed, never displayed), §10 #1
 * (every title/tag in the final output), §6.12 (the trace says what
 * happened).
 */

import type { RelatedResult } from "../qloo/related.ts";
import type { AudienceTastes } from "../scoring/fit.ts";
import type { Audience, GroundingResult } from "../types.ts";

function cleanId(value: string): string | null {
  return value.trim() === "" ? null : value;
}

/** Every title id an audience list carries, deduped. */
export function audienceTitleIds(audiences: readonly Audience[]): string[] {
  const ids = new Set<string>();
  for (const audience of audiences) {
    for (const title of audience.titles) {
      const id = cleanId(title.qlooId);
      if (id !== null) ids.add(id);
    }
  }
  return [...ids];
}

/** Every tag id the run's taste lists returned, failed lists skipped. */
export function tasteTagIds(
  lists: ReadonlyArray<readonly AudienceTastes[]>,
): string[] {
  const ids = new Set<string>();
  for (const list of lists) {
    for (const tastes of list) {
      if (tastes.failed === true) continue;
      for (const id of tastes.tagIds) {
        const clean = cleanId(id);
        if (clean !== null) ids.add(clean);
      }
    }
  }
  return [...ids];
}

/** Every entity id the related fetches returned (the reach card). */
export function relatedEntityIds(
  byAudienceId: Record<string, RelatedResult[]> | undefined,
): string[] {
  const ids = new Set<string>();
  if (byAudienceId === undefined) return [];
  for (const groups of Object.values(byAudienceId)) {
    for (const group of groups) {
      for (const item of group.items) {
        const id = cleanId(item.entityId);
        if (id !== null) ids.add(id);
      }
    }
  }
  return [...ids];
}

/** Drop tags whose id is not in the run's known set. Order is preserved. */
export function groundTags<T>(
  tags: readonly T[],
  idOf: (tag: T) => string,
  known: ReadonlySet<string>,
): { kept: T[]; removed: string[] } {
  const kept: T[] = [];
  const removed: string[] = [];
  for (const tag of tags) {
    const id = idOf(tag);
    if (known.has(id)) kept.push(tag);
    else removed.push(id);
  }
  return { kept, removed };
}

/**
 * Drop ungrounded titles from each audience. The row itself stays: scores
 * and the verdict key off audience ids, so removing a row here would
 * desync the verdict from the chart. Stripping the ids removes the claim
 * without inventing a second failure mode.
 */
export function groundAudiences(
  audiences: readonly Audience[],
  known: ReadonlySet<string>,
): { kept: Audience[]; removed: string[] } {
  const removed: string[] = [];
  const kept = audiences.map((audience) => {
    const titles = audience.titles.filter((title) => {
      if (known.has(title.qlooId)) return true;
      removed.push(title.qlooId);
      return false;
    });
    return titles.length === audience.titles.length
      ? audience
      : { ...audience, titles };
  });
  return { kept, removed };
}

/** Drop ungrounded names from the reach card. Display-only, score-safe. */
export function groundRelated(
  byAudienceId: Record<string, RelatedResult[]> | undefined,
  known: ReadonlySet<string>,
): {
  byAudienceId: Record<string, RelatedResult[]>;
  removed: string[];
} {
  const out: Record<string, RelatedResult[]> = {};
  const removed: string[] = [];
  for (const [audienceId, groups] of Object.entries(byAudienceId ?? {})) {
    out[audienceId] = groups.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (known.has(item.entityId)) return true;
        removed.push(item.entityId);
        return false;
      }),
    }));
  }
  return { byAudienceId: out, removed };
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

/**
 * Fold ids stripped before the final check (pool tags, bridges) into the
 * check result. `ok` stays false when anything was removed, so the trace
 * records the failure even though the output is now clean.
 */
export function mergeGrounding(
  check: GroundingResult,
  removedTitles: readonly string[],
  removedTags: readonly string[],
): GroundingResult {
  const ungroundedTitles = unique([
    ...check.ungroundedTitles,
    ...removedTitles,
  ]);
  const ungroundedTags = unique([...check.ungroundedTags, ...removedTags]);
  return {
    ok: ungroundedTitles.length === 0 && ungroundedTags.length === 0,
    ungroundedTitles,
    ungroundedTags,
  };
}
