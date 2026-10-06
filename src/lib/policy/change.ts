/**
 * Day 8 S: change bar and withhold reasons. Owned by S.
 *
 * Pure logic: a recorded bar plus before/after evidence in, an
 * accepted-or-withheld verdict out. The bar is evaluated against the
 * value passed in — never recomputed from the result — so no proposal
 * can grade its own homework (§6.9: the bar is set BEFORE the proposal
 * is made).
 *
 * Accept iff the fit rises by at least the bar, coverage holds, every
 * new tag is grounded, and the audience still clears control. The
 * first failure names itself (§10 #5: the page prints which condition
 * failed). A withheld change is a normal outcome, not an error.
 */

import type { FitScore } from "../types.ts";

export interface ChangeBar {
  /** Minimum fit-score rise for acceptance. */
  minRise: number;
  /** The changed pitch must still clear control. */
  requireControl: boolean;
}

/**
 * STUB: provisional rise bar. §6.9 sets real cutoffs by testing;
 * calibration week owns this number. The Q-lane withheld fixture is
 * tuned against ≈0.05 — if this moves, that fixture moves with it.
 */
export const MIN_RISE = 0.05;

export type FailedCondition = "rise" | "coverage" | "grounding" | "control";

export interface ChangeCheck {
  accepted: boolean;
  /** Set exactly when accepted is false: the first failed condition. */
  failedCondition?: FailedCondition;
  before: number;
  after: number;
}

/**
 * Judge a proposed change against a pre-recorded bar. Condition order
 * follows the §6.9 listing (rise, coverage, grounding, control):
 * the first failure wins and names itself.
 */
export function checkChange(
  bar: ChangeBar,
  before: FitScore,
  after: FitScore,
  coverageBefore: number,
  coverageAfter: number,
  grounded: boolean,
  clearsControl: boolean,
): ChangeCheck {
  const check = { before: before.score, after: after.score };
  if (after.score - before.score < bar.minRise) {
    return { accepted: false, failedCondition: "rise", ...check };
  }
  if (coverageAfter < coverageBefore) {
    return { accepted: false, failedCondition: "coverage", ...check };
  }
  if (!grounded) {
    return { accepted: false, failedCondition: "grounding", ...check };
  }
  if (bar.requireControl && !clearsControl) {
    return { accepted: false, failedCondition: "control", ...check };
  }
  return { accepted: true, ...check };
}
