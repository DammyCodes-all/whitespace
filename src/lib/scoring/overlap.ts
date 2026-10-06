/**
 * Day 2 S: rival-overlap rule. Owned by S.
 *
 * Pure logic on frozen `Audience` shapes: no Qloo calls, no scoring.
 * Fixtures here are inline test data only; Q-owned `src/lib/fixtures/`
 * is never touched.
 *
 * Spec ref: §6.3 (a rival more than about a third overlapping the
 * hypothesis or another rival is replaced; up to five builds; the run
 * continues with what exists when fewer than two valid rivals remain),
 * §7 (comparison is our code, not the AI's).
 */

import type { Audience } from "@/lib/types";

/** §6.3 "more than about a third": strictly greater than 1/3. */
export const OVERLAP_LIMIT = 1 / 3;

/** §6.3: three rivals by default. */
export const MAX_RIVALS = 3;

/** §6.3: up to five builds when early rivals fail the test. */
export const MAX_BUILDS = 5;

/**
 * Shared titles ÷ smaller list size, compared by canonical `qlooId`.
 * Empty title lists score 0 (no data, never similar).
 */
export function overlapRatio(a: Audience, b: Audience): number {
  const aIds = new Set(a.titles.map((t) => t.qlooId));
  const bIds = new Set(b.titles.map((t) => t.qlooId));
  if (aIds.size === 0 || bIds.size === 0) return 0;
  let shared = 0;
  for (const id of aIds) {
    if (bIds.has(id)) shared += 1;
  }
  return shared / Math.min(aIds.size, bIds.size);
}

/** True when the pair overlaps by more than a third (§6.3). */
export function isTooSimilar(a: Audience, b: Audience): boolean {
  return overlapRatio(a, b) > OVERLAP_LIMIT;
}

export interface DroppedRival {
  id: string;
  reason: string;
}

export interface RivalSelection {
  kept: Audience[];
  dropped: DroppedRival[];
}

/**
 * Walk up to `maxBuilds` candidates in order, keeping at most `maxKept`.
 * A candidate is dropped when it overlaps the hypothesis or any kept
 * rival. Callers report `dropped` so the run can say it continues with
 * what exists (§6.3).
 */
export function selectRivals(
  hypothesis: Audience,
  candidates: Audience[],
  maxKept: number = MAX_RIVALS,
  maxBuilds: number = MAX_BUILDS,
): RivalSelection {
  const kept: Audience[] = [];
  const dropped: DroppedRival[] = [];
  for (const candidate of candidates.slice(0, maxBuilds)) {
    if (kept.length >= maxKept) break;
    if (isTooSimilar(candidate, hypothesis)) {
      dropped.push({
        id: candidate.id,
        reason: `shares ${overlapRatio(candidate, hypothesis).toFixed(2)} of titles with the hypothesis`,
      });
      continue;
    }
    const clash = kept.find((rival) => isTooSimilar(candidate, rival));
    if (clash !== undefined) {
      dropped.push({
        id: candidate.id,
        reason: `shares ${overlapRatio(candidate, clash).toFixed(2)} of titles with rival ${clash.id}`,
      });
      continue;
    }
    kept.push(candidate);
  }
  return { kept, dropped };
}
