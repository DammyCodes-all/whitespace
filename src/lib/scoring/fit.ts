/**
 * Day 3 S: fit score. Owned by S.
 *
 * Pure logic on the frozen `FitScore` shape: no Qloo calls, no AI, no
 * sorting by strength values. Everything here is deterministic, so the same
 * tastes and tags always produce the same score (§10 #7).
 *
 * §6.6 in full, because each sentence there is a rule:
 * - Qloo ranks each audience's tastes by strength. We keep Qloo's ORDER and
 *   throw the numeric strengths away, turning position into a rank. §11
 *   says ranks only, never counts or audience size, so the strength numbers
 *   are not even accepted by the input type.
 * - A tag sitting at rank r of N scores (N - r + 1) / N: the strongest
 *   taste is 1, the weakest is 1/N. Present-but-last never equals absent.
 * - A tag missing from a long enough list is a ZERO. The audience does not
 *   over-index on it, and it still counts in the denominator.
 * - A tag missing from a short or failed list is NO DATA and is left out
 *   of the score entirely, numerator and denominator alike.
 * - Pinned must-haves count double.
 *
 * The score is the weighted mean of per-tag strength across the judgeable
 * tags, which holds it in 0 to 1 no matter how long the pitch is.
 *
 * Open question for S, resolved before Day 6: §6.6 phrases the zero vs
 * no-data split per audience ("a short or failed list"), so this file
 * treats it as all-or-nothing per audience. The Day 1 mock in
 * `src/lib/demo/mock-run.ts` shows one audience with matched, zero AND
 * no-data tags at once, which the literal reading cannot produce. Either
 * the mock is illustrative or the rule needs a per-tag condition. Flagged,
 * not invented.
 *
 * Spec ref: §6.6 (scoring), §6.5 (only real Qloo tags reach this), §7 (our
 * code scores, the AI never does), §11 (ranks only), §10 #4 (no-data must
 * never read as a low score), §6.7 (cutoffs are provisional until week-one
 * testing, so they live in one tunable place).
 */

import type { FitScore, PitchTag } from "@/lib/types";

/**
 * §6.6: one audience's tastes as Qloo returned them, strongest first.
 *
 * This is the shape Q's `tastes.ts` returns. It is declared here because
 * scoring owns the contract it consumes, and because `src/lib/types.ts` is
 * frozen after Day 1.
 */
export interface AudienceTastes {
  audienceId: string;
  /**
   * Qloo tag ids in strength order. Position is the rank. Raw strength
   * numbers are deliberately not part of the type, so §11 cannot be
   * broken by a caller passing one in.
   */
  tagIds: string[];
  /** The fetch failed. Nothing is judgeable for this audience (§6.6). */
  failed?: boolean;
}

/**
 * §6.6 "a short or failed list". With fewer tastes than this, a missing tag
 * is unknown rather than a zero, because the list was too short to judge.
 *
 * Provisional by design. §6.7 says the exact cutoffs get set in week one by
 * testing on real pitches, and Day 10 records margins v1. Change it here and
 * nothing else in the codebase moves.
 */
export const MIN_TASTES_FOR_JUDGEMENT = 10;

/**
 * §6.6: rank 1 of N is 1, rank N is 1/N, absent is 0. The weakest taste
 * that is actually present keeps a positive share, so "barely there" and
 * "not there" stay distinguishable.
 */
export function rankStrength(rank: number, total: number): number {
  if (total < 1 || rank < 1 || rank > total) return 0;
  return (total - rank + 1) / total;
}

/**
 * Tag id to 1-based rank. A tag repeated by Qloo takes its best rank once;
 * duplicates must not consume a second position.
 */
function rankMap(tastes: AudienceTastes): Map<string, number> {
  const ranks = new Map<string, number>();
  let position = 0;
  for (const id of tastes.tagIds) {
    if (ranks.has(id)) continue;
    position += 1;
    ranks.set(id, position);
  }
  return ranks;
}

export interface ScoreOptions {
  /** Overrides {@link MIN_TASTES_FOR_JUDGEMENT}. */
  minTastesForJudgement?: number;
}

/**
 * §6.6: score one audience against the pitch tags.
 *
 * Returns the frozen `FitScore`. When the audience is unjudgeable the score
 * is 0, but that 0 is a placeholder and must never be drawn; use
 * {@link isUnjudgeable} to tell the no-data case from a real zero.
 */
export function scoreAudience(
  tastes: AudienceTastes,
  tags: PitchTag[],
  options: ScoreOptions = {},
): FitScore {
  const minimum = options.minTastesForJudgement ?? MIN_TASTES_FOR_JUDGEMENT;
  const ranks =
    tastes.failed === true ? new Map<string, number>() : rankMap(tastes);

  // §6.6: a failed or short list judges nothing, so every tag is no-data.
  if (tastes.failed === true || ranks.size < minimum) {
    return {
      audienceId: tastes.audienceId,
      score: 0,
      matchedTags: [],
      zeroTags: [],
      noDataTags: tags.map((tag) => tag.tag),
    };
  }

  const total = ranks.size;
  const matchedTags: string[] = [];
  const zeroTags: string[] = [];
  let weightedStrength = 0;
  let weightTotal = 0;

  for (const tag of tags) {
    // §6.6: a pinned must-have counts double, in both directions.
    const weight = tag.pinned ? 2 : 1;
    weightTotal += weight;

    const rank = ranks.get(tag.qlooTagId);
    if (rank === undefined) {
      zeroTags.push(tag.tag);
      continue;
    }

    matchedTags.push(tag.tag);
    weightedStrength += weight * rankStrength(rank, total);
  }

  return {
    audienceId: tastes.audienceId,
    score: weightTotal === 0 ? 0 : weightedStrength / weightTotal,
    matchedTags,
    zeroTags,
    noDataTags: [],
  };
}

/**
 * Score every audience against one shared tag list. The tag list is the
 * same for all of them (§6.5), so the pipeline calls this once.
 */
export function scoreAll(
  allTastes: AudienceTastes[],
  tags: PitchTag[],
  options: ScoreOptions = {},
): FitScore[] {
  return allTastes.map((tastes) => scoreAudience(tastes, tags, options));
}

/**
 * §10 #4: no-data must never be shown as a low score.
 *
 * `FitScore.score` is a frozen `number`, so an audience we could not judge
 * at all still carries 0. That 0 is a placeholder. Callers must branch on
 * this before rendering a number: when it returns true, draw the no-data
 * state instead.
 */
export function isUnjudgeable(fit: FitScore): boolean {
  return (
    fit.noDataTags.length > 0 &&
    fit.matchedTags.length === 0 &&
    fit.zeroTags.length === 0
  );
}
