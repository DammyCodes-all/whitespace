/**
 * Day 8 S: change bar and withhold reasons. Owned by S.
 *
 * Pure logic: a recorded bar plus before/after evidence in, an
 * accepted-or-withheld verdict out. The bar is evaluated against the
 * value passed in — never recomputed from the result — so no proposal
 * can grade its own homework (§6.9: the bar is set BEFORE the proposal
 * is made).
 *
 * Accept iff the fit rises by at least the bar, the winner's lead over
 * the comparison field does not shrink, coverage holds, every new tag is
 * grounded, and the audience still clears control by the SAME rank-based
 * rule the run uses (`testAgainstControls`, fix 5: an absolute 0.05 gap
 * on a K-tag mean moves as the pool moves, and the old route counted
 * unjudgeable placeholder zeros as competitors — a beat against a
 * baseline nobody could measure). The first failure names itself
 * (§10 #5: the page prints which condition failed). A withheld change
 * is a normal outcome, not an error.
 *
 * Spec ref: §6.9 (bar recorded first, conditions named), §6.7 (control
 * test), §10 #5 (name the failed condition).
 */

import type { FitScore } from "../types.ts";

export interface ChangeBar {
  /** Minimum fit-score rise for acceptance. */
  minRise: number;
  /**
   * Optional scale-aware alternative to `minRise`: a rise clearing this
   * share of where the fit already stood. Stored ON the bar so it is
   * fixed before the proposal, exactly like `minRise`; a bar without it
   * is judged on the absolute rise alone. Scores are a weighted mean
   * over K pooled tags, so a real rewrite is worth ~0.02 on a 60-tag
   * pool and ~0.09 on a 12-tag pool (2026-10-19).
   */
  minShare?: number;
  /** The changed pitch must still clear control. */
  requireControl: boolean;
}

/**
 * STUB: provisional rise bar. §6.9 sets real cutoffs by testing;
 * calibration week owns this number. The Q-lane withheld fixture is
 * tuned against ≈0.05 — if this moves, that fixture moves with it.
 *
 * A rise clears the bar when it is at least MIN_RISE in absolute terms
 * OR, when the recorded bar carries a `minShare`, at least that share
 * of where the fit already stood. Scores are a weighted mean over K
 * pooled tags, so the same rewrite is worth ~0.02 on a 60-tag pool and
 * ~0.09 on a 12-tag pool; an absolute floor alone would quietly refuse
 * every rewrite on a large pool (2026-10-19). The share lives on the
 * bar, not here, so it is still fixed BEFORE the proposal runs.
 *
 * Calibration protocol (Day 10 S): `node scripts/calibrate-margins.ts`
 * with QLOO_API_KEY set; the recorded margins in docs/qloo-coverage.md
 * own this number, not eyeballing one pitch.
 */
export const MIN_RISE = 0.05;

export type FailedCondition =
  | "rise"
  | "separation"
  | "coverage"
  | "grounding"
  | "control";

/**
 * The winner's lead over the strongest judgeable comparison, measured
 * before and after the change on the same two tag sets. A rewrite that
 * lifts the winner by lifting everyone (or lifts the field faster) has
 * not made the winner stand out more, so it is withheld — the rise bar
 * alone cannot see that (fix 5).
 */
export interface ChangeSeparation {
  before: number;
  after: number;
}

export interface ChangeCheck {
  accepted: boolean;
  /** Set exactly when accepted is false: the first failed condition. */
  failedCondition?: FailedCondition;
  before: number;
  after: number;
}

/** Float hygiene: a rise of 0.0999… must read as a rise, not a tie. */
const EPSILON = 1e-9;

/**
 * Judge a proposed change against a pre-recorded bar. Condition order
 * follows the §6.9 listing (rise, separation, coverage, grounding,
 * control): the first failure wins and names itself.
 */
export function checkChange(
  bar: ChangeBar,
  before: FitScore,
  after: FitScore,
  coverageBefore: number,
  coverageAfter: number,
  grounded: boolean,
  clearsControl: boolean,
  separation: ChangeSeparation,
): ChangeCheck {
  const check = { before: before.score, after: after.score };
  const rise = after.score - before.score;
  const clearsRise =
    rise >= bar.minRise ||
    (bar.minShare !== undefined &&
      rise + EPSILON >= bar.minShare * before.score);
  if (!clearsRise) {
    return { accepted: false, failedCondition: "rise", ...check };
  }
  if (separation.after + EPSILON < separation.before) {
    return { accepted: false, failedCondition: "separation", ...check };
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
