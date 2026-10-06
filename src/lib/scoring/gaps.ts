/**
 * Day 7 S: gap finder (what the audience loves that the pitch lacks).
 * Owned by S.
 *
 * Pure functions only: audience tag ids in, displayable gaps out. No
 * I/O, no Qloo calls, no pitch copywriting (§6.8 forbids writing copy
 * from gaps — output stays `{tagId, label, rank}` for Day 8 to consume
 * as research leads).
 *
 * Direction is audience-to-pitch only: a gap is an audience tag absent
 * from the pitch. Pitch tags missing from tastes are coverage's
 * territory, not this file's. Pinned status is ignored: a gap is a
 * gap, pinning only affects scoring weights.
 *
 * Labels come from Q's hand-written map until the live spike resolves
 * real tag names. Unlabeled URNs are skipped and counted (§10 #4).
 */

import type { PitchTag } from "../types.ts";
import type { AudienceTastes } from "./fit.ts";

export interface GapItem {
  tagId: string;
  label: string;
  /** 1-based rank of the tag in the audience's taste list. */
  rank: number;
}

/** Display guess, not a finding: how many gaps the reach UI shows. */
export const GAP_TOP_N = 8;

/**
 * Rank map with first occurrence winning, so a repeated URN cannot
 * occupy two ranks. Shared shape with scoring, computed locally so
 * this file never depends on scoring internals.
 */
function rankMap(tagIds: string[]): Map<string, number> {
  const ranks = new Map<string, number>();
  for (const id of tagIds) {
    if (!ranks.has(id)) ranks.set(id, ranks.size + 1);
  }
  return ranks;
}

/**
 * Find what the audience loves that the pitch lacks, strongest first,
 * capped at `topN`. Failed or empty taste lists yield no gaps (unknown
 * loves means no claimable gaps); unlabeled tags are skipped here and
 * reported via `countUnlabeled`. Never throws.
 */
export function findGaps(
  tastes: AudienceTastes,
  pitchTags: PitchTag[],
  labels: Record<string, string>,
  topN: number = GAP_TOP_N,
): GapItem[] {
  if (tastes.failed === true) return [];
  const ranks = rankMap(tastes.tagIds);
  const pitched = new Set(pitchTags.map((t) => t.qlooTagId));
  const gaps: GapItem[] = [];
  for (const [tagId, rank] of ranks) {
    if (pitched.has(tagId)) continue;
    const label = labels[tagId];
    if (label === undefined) continue;
    gaps.push({ tagId, label, rank });
  }
  gaps.sort((a, b) => a.rank - b.rank);
  return gaps.slice(0, Math.max(0, topN));
}

/**
 * §10 #4 honesty count: audience tags that are neither pitch-covered
 * nor labeled, hence invisible in `findGaps` output. Render this count,
 * never a placeholder gap.
 */
export function countUnlabeled(
  tastes: AudienceTastes,
  pitchTags: PitchTag[],
  labels: Record<string, string>,
): number {
  if (tastes.failed === true) return 0;
  const pitched = new Set(pitchTags.map((t) => t.qlooTagId));
  let skipped = 0;
  for (const tagId of new Set(tastes.tagIds)) {
    if (!pitched.has(tagId) && labels[tagId] === undefined) skipped += 1;
  }
  return skipped;
}
