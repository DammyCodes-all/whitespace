/**
 * Day 5 S: exclusion subtract. Owned by S.
 *
 * Pure logic on frozen shapes: no Qloo calls, no AI. The "nothing like"
 * titles form an exclusion audience; its tastes are subtracted from each
 * audience before scoring, so the pitch is never credited for matching
 * an audience through things the creator wants to avoid.
 *
 * Subtraction is set removal on tag ids with order preserved: the
 * audience's rank order survives, only banned tastes drop out. Ranks are
 * recomputed downstream by position, so no renormalization is needed
 * here. An empty exclusion (no "nothing like" titles, or none resolved)
 * leaves every list untouched.
 *
 * Design note (§6.6): this subtraction "needs testing on real pitches.
 * If it behaves badly, the fallback is to show an overlap warning
 * instead." That fallback is a Day 8+ call; this file stays mechanical.
 *
 * Spec ref: §6.6 (exclusion), §7 (subtraction is our code), §11 (ranks
 * only: ids out, no counts involved).
 */

import type { AudienceTastes } from "@/lib/scoring/fit";

/**
 * §6.6: remove the exclusion audience's tastes from one taste list.
 * Order preserved, duplicates impossible (tag ids are a rank order).
 */
export function subtractExclusion(
  tastes: AudienceTastes,
  exclusion: AudienceTastes,
): AudienceTastes {
  if (exclusion.tagIds.length === 0) return tastes;
  const banned = new Set(exclusion.tagIds);
  const kept = tastes.tagIds.filter((id) => !banned.has(id));
  if (kept.length === tastes.tagIds.length) return tastes;
  return { ...tastes, tagIds: kept };
}

/**
 * §6.6: subtract the exclusion audience from every audience before
 * scoring. The pipeline calls this once, between fetch and score.
 */
export function subtractExclusionFromAll(
  allTastes: AudienceTastes[],
  exclusion: AudienceTastes,
): AudienceTastes[] {
  if (exclusion.tagIds.length === 0) return allTastes;
  return allTastes.map((tastes) => subtractExclusion(tastes, exclusion));
}
