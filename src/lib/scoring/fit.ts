/**
 * Day 3 fit scoring. Owned by S.
 *
 * Pure functions only: ranked taste lists in, FitScore out. No I/O, no
 * Qloo imports. Rank-normalization lives here (§7: scoring math is our
 * code), so audiences with long and short lists compare fairly (§6.6).
 *
 * v1 formula, CALIBRATION-PENDING: exact margins and cutoffs are set in
 * calibration week by testing on real pitches (§6.7). Do not hard-code
 * behavior on the STUB constants below.
 */

import type { AudienceTastes } from "../qloo/tastes.ts";
import type { FitScore, PitchTag } from "../types.ts";

/**
 * STUB: lists this long or longer count as full, so a missing tag
 * means the audience does not over-index on it (zero). Shorter or
 * truncated lists mean no-data. Recalibrate with real list lengths.
 */
export const LONG_LIST_MIN = 20;

/** Weight of one matched tag: pinned must-haves count double (§6.6). */
export function tagWeight(pinned: boolean, rank: number): number {
  return (pinned ? 2 : 1) * (1 / rank);
}

/**
 * Score one audience 0 to 1 against the pitch tags.
 *
 * Never throws on empty input: no pitch tags yields a zero score with
 * empty evidence arrays (coverage downstream reports Inconclusive).
 * A 0 from all-noDataTags means unmeasured, a 0 from all-zeroTags
 * means measured-low; callers tell them apart via the arrays, never
 * via the number (§10 #4).
 */
export function scoreFit(
  pitchTags: PitchTag[],
  tastes: AudienceTastes,
): FitScore {
  const matchedTags: string[] = [];
  const zeroTags: string[] = [];
  const noDataTags: string[] = [];

  const isFullList = !tastes.truncated && tastes.totalReturned >= LONG_LIST_MIN;

  let matchedWeight = 0;
  let possibleWeight = 0;

  for (const pitchTag of pitchTags) {
    possibleWeight += pitchTag.pinned ? 2 : 1;
    const hit = tastes.tastes.find((t) => t.tag === pitchTag.tag);
    if (hit) {
      matchedWeight += tagWeight(pitchTag.pinned, hit.rank);
      matchedTags.push(pitchTag.tag);
    } else if (isFullList) {
      zeroTags.push(pitchTag.tag);
    } else {
      noDataTags.push(pitchTag.tag);
    }
  }

  const score =
    possibleWeight === 0
      ? 0
      : Math.min(1, Math.max(0, matchedWeight / possibleWeight));

  return {
    audienceId: tastes.audienceId,
    score,
    matchedTags,
    zeroTags,
    noDataTags,
  };
}

/**
 * §6.5 coverage: share of suggested words that matched a real Qloo tag.
 * Takes counts, not lists: tag-matching (Day 2 owner) supplies the
 * denominator when it lands. Clamped to 0..1; zero suggested is 0.
 */
export function coverage(matchedCount: number, suggestedCount: number): number {
  if (suggestedCount <= 0) return 0;
  return Math.min(1, Math.max(0, matchedCount / suggestedCount));
}
