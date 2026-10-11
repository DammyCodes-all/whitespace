/**
 * Package A: interests for the reach plan, served from already-fetched
 * taste tags. Owned by Q.
 *
 * The new flow asks for the top 5 interests per winning audience, ranked
 * by Qloo affinity. No new Qloo call is needed: `fetchAudienceTastes`
 * already returns each audience's tags in affinity rank order with
 * display names (live-verified 2026-10-10: 50/50 tags named on a film
 * probe, aggregates only, no payloads stored). The top-N taste tags ARE
 * the interests list — same data, same rank contract (§11), zero calls.
 *
 * A failed or empty taste list yields [], which the adapter renders as
 * not-measured (§10 #4), never as an empty claim.
 *
 * Spec ref: §6.8 (reach plan), §6.6 (taste lists), §11 (ranks only),
 * §10 #4 (no-data honesty).
 */

import type { AudienceTastes } from "../scoring/fit.ts";

export interface InterestItem {
  tagId: string;
  name: string;
  /** 1-based position in Qloo's affinity order. Ranks only (§11). */
  rank: number;
}

/** The flow asks for the top 5 interests per audience. */
export const INTEREST_TRIM = 5;

/** Top taste tags in rank order. Pure: no Qloo calls, no AI. */
export function interestsFromTastes(
  tastes: AudienceTastes,
  limit: number = INTEREST_TRIM,
): InterestItem[] {
  if (tastes.failed === true || tastes.tagIds.length === 0) return [];
  const names = tastes.tagNames ?? [];
  return tastes.tagIds.slice(0, Math.max(0, limit)).map((tagId, index) => ({
    tagId,
    name: names[index] ?? "",
    rank: index + 1,
  }));
}
