/**
 * Day 5 S: grounding check plus coverage reporting. Owned by S.
 *
 * Pure logic, no Qloo calls, no AI. Two honesty jobs live here:
 *
 * 1. Grounding (§8): after the AI writes anything, every title and tag
 *    in the output must have come from that run's Qloo results. Anything
 *    that did not is reported so the pipeline removes or retries it;
 *    results are not shown until the check passes. The chatbot comparison
 *    is exempt (§6.11): its purpose is to show ungrounded output.
 * 2. Coverage (§6.5): how many suggested words matched a real Qloo tag,
 *    plus how many tags were left out of scoring per audience (§6.6).
 *    Unmatched words are no-data and never enter scoring.
 *
 * The pipeline threads the known-good id sets through from Day 2
 * `resolveTitles` / `resolvePitchTags`; this file only compares.
 *
 * Spec ref: §8 (grounding check), §6.5 (coverage), §6.6 (left-out
 * counts), §10 #1 (20-run grounding gate), §10 #4 (no-data honesty).
 */

import type { FitScore, GroundingResult } from "@/lib/types";

export interface CoverageReport {
  /** Suggested words checked against Qloo tags. */
  suggested: number;
  /** Words that matched a real Qloo tag. */
  matched: number;
  /** Words with no Qloo tag: no-data, never scored. */
  notFoundWords: string[];
  /** Share matched (§6.5). Empty input is vacuous coverage, not failure. */
  coverage: number;
}

/**
 * §6.5: build the display-ready coverage report. `matchedTags` are the
 * resolved `PitchTag.tag` words, `notFoundWords` the rest.
 */
export function reportCoverage(
  matchedTags: string[],
  notFoundWords: string[],
): CoverageReport {
  const suggested = matchedTags.length + notFoundWords.length;
  return {
    suggested,
    matched: matchedTags.length,
    notFoundWords: [...notFoundWords],
    coverage: suggested === 0 ? 1 : matchedTags.length / suggested,
  };
}

/**
 * §6.6: how many tags were left out of scoring for one audience. Zero
 * means fully judged; anything above zero renders as an explicit
 * no-data count, never as a low score (§10 #4).
 */
export function countLeftOut(score: FitScore): number {
  return score.noDataTags.length;
}

/**
 * §8: check that every title and tag in the output came from this run's
 * Qloo results. `knownTitleIds` / `knownTagIds` are the ids Qloo
 * returned (resolved titles plus fetched tastes); `outputTitles` /
 * `outputTags` are what the run wants to show. Anything else is
 * ungrounded and must be removed or retried before display.
 */
export function checkGrounding(
  outputTitles: string[],
  outputTags: string[],
  knownTitleIds: string[],
  knownTagIds: string[],
): GroundingResult {
  const knownTitles = new Set(knownTitleIds);
  const knownTags = new Set(knownTagIds);
  return {
    ok:
      outputTitles.every((id) => knownTitles.has(id)) &&
      outputTags.every((id) => knownTags.has(id)),
    ungroundedTitles: outputTitles.filter((id) => !knownTitles.has(id)),
    ungroundedTags: outputTags.filter((id) => !knownTags.has(id)),
  };
}
