/**
 * Day 4 S: control test plus verdict. Owned by S.
 *
 * Pure logic on the frozen `FitScore` / `VerdictResult` shapes: no Qloo
 * calls, no AI, no rendering. Ranking here is our code, not the AI's
 * (§7). Deterministic, so the same scores always give the same verdict
 * (§10 #7).
 *
 * §6.7 in full, because each row of the table is a branch below:
 * - Strong: the top audience clears control and is clearly ahead of
 *   the second.
 * - Split: the top two both clear control and are close together.
 * - Weak: no audience clears control.
 * - Inconclusive: too few pitch words matched Qloo tags (coverage
 *   floor), or too many audiences had no data.
 * - Surprise headline: the top audience is not the hypothesis and beats
 *   it clearly.
 *
 * All cutoffs live in one tunable place: `src/lib/config.ts`. §6.7 says
 * the exact margins get set in week one by testing on real pitches;
 * Margins v1 are recorded in docs/qloo-coverage.md (2026-10-09).
 *
 * Spec ref: §6.7 (verdict), §6.6 (scores in, ranks only), §6.5
 * (coverage in), §10 #4 (no-data never reads as a low score: an
 * unjudgeable top can never be Strong or Split), §7 (our code ranks).
 */

import {
  CONTROL_MARGIN,
  COVERAGE_FLOOR,
  MAX_UNJUDGEABLE_SHARE,
  SPLIT_MARGIN,
  SURPRISE_MARGIN,
} from "../config.ts";
import { isUnjudgeable } from "../scoring/fit.ts";
import type { FitScore, VerdictResult } from "../types.ts";

export {
  CONTROL_MARGIN,
  COVERAGE_FLOOR,
  SPLIT_MARGIN,
  SURPRISE_MARGIN,
} from "../config.ts";

/**
 * Margins v1, set 2026-10-09 from live runs (was: provisional stubs).
 * Evidence (hackathon Qloo, film domain):
 * - Genuine signal: space pitch, mid-specificity words
 *   (alien/survival/dystopia/scientist) -> hyp 0.744, best control
 *   (Sci-fi epic) 0.644, gap 0.0999…
 * - Noise ceiling: broad genre words -> best gap 0.028 (rival-amb tie
 *   with Horror control); mood-word pitches -> all zeros, gap 0.
 * - Nonsense stays out via the coverage floor, not the margin.
 * CONTROL_MARGIN 0.05 sits between observed noise (<=0.03) and observed
 * signal (0.10). SPLIT/SURPRISE stay stubbed: no live Split or surprise
 * case observed yet — do not tune them until one is.
 * Change them here and nothing else in the codebase moves.
 *
 * Re-calibration protocol: `node scripts/calibrate-margins.ts` with
 * QLOO_API_KEY set runs the Day 8 pack through the real pipeline and
 * prints fresh margin distributions. Note the pack's hardcoded words are
 * mood-level (margins 0 on every entry as of 2026-10-09); re-calibrate
 * against sharp-worded inputs when the pack is updated, and record the
 * run in docs/qloo-coverage.md (§6.7: margins are findings, not defaults).
 *
 * Invariant: MIN_RISE (policy/change.ts) must stay >= SPLIT_MARGIN —
 * otherwise the change bar would accept a move smaller than the verdict
 * policy calls a tie. The Day 8 pack fixture note tracks this.
 */

/** Float hygiene: a 0.0999… gap from rank fractions must read as 0.1. */
const MARGIN_EPSILON = 1e-9;

export interface VerdictInput {
  /** Hypothesis audience id, for the surprise check. */
  hypothesisId: string;
  /** Contender scores: hypothesis plus rivals. */
  scores: FitScore[];
  /** Control scores: the ceiling is their best. */
  controlScores: FitScore[];
  /** Share of suggested words that matched a real Qloo tag (§6.5). */
  coverage: number;
}

export interface VerdictOptions {
  controlMargin?: number;
  splitMargin?: number;
  surpriseMargin?: number;
  coverageFloor?: number;
  maxUnjudgeableShare?: number;
}

function sortedByScore(scores: FitScore[]): FitScore[] {
  return [...scores].sort((a, b) => b.score - a.score);
}

function bestScore(scores: FitScore[]): number {
  let best = 0;
  for (const s of scores) {
    if (s.score > best) best = s.score;
  }
  return best;
}

function inconclusive(
  scores: FitScore[],
  reason:
    | "coverage"
    | "nodata"
    | "top-unjudgeable"
    | "empty"
    | "no-control"
    | "no-signal",
): VerdictResult {
  const ranked = sortedByScore(scores);
  const top = ranked[0] ?? null;
  return {
    verdict: "Inconclusive",
    topAudienceId: top?.audienceId ?? null,
    marginTopVsSecond: 0,
    marginTopVsControl: 0,
    clearsControl: false,
    surprise: false,
    inconclusiveReason: reason,
  };
}

/**
 * §6.7: rank the contenders against the control ceiling and return the
 * frozen `VerdictResult`. Never throws on empty or all-no-data input:
 * those are Inconclusive, not errors.
 */
export function decideVerdict(
  input: VerdictInput,
  options: VerdictOptions = {},
): VerdictResult {
  const controlMargin = options.controlMargin ?? CONTROL_MARGIN;
  const splitMargin = options.splitMargin ?? SPLIT_MARGIN;
  const surpriseMargin = options.surpriseMargin ?? SURPRISE_MARGIN;
  const coverageFloor = options.coverageFloor ?? COVERAGE_FLOOR;
  const maxUnjudgeableShare =
    options.maxUnjudgeableShare ?? MAX_UNJUDGEABLE_SHARE;

  const { hypothesisId, scores, controlScores, coverage } = input;
  if (scores.length === 0) {
    return inconclusive(scores, "empty");
  }

  // §6.7 Inconclusive first: coverage floor, then no-data share. Either
  // means the app cannot say anything reliable, so no other branch runs.
  if (coverage < coverageFloor) {
    return inconclusive(scores, "coverage");
  }
  const unjudgeable = scores.filter((s) => isUnjudgeable(s)).length;
  if (unjudgeable / scores.length > maxUnjudgeableShare) {
    return inconclusive(scores, "nodata");
  }

  const ranked = sortedByScore(scores);
  const top = ranked[0];
  if (top === undefined) {
    return inconclusive(scores, "empty");
  }

  // §10 #4: an unjudgeable top carries a placeholder 0. It must never
  // clear control or win a margin, so it cannot be Strong or Split.
  if (isUnjudgeable(top)) {
    return {
      verdict: "Inconclusive",
      topAudienceId: top.audienceId,
      marginTopVsSecond: 0,
      marginTopVsControl: 0,
      clearsControl: false,
      surprise: false,
      inconclusiveReason: "top-unjudgeable",
    };
  }

  // Margins measure against real contenders only: unjudgeable
  // placeholder 0s must neither inflate the margin nor mask a close real
  // runner-up further down the ranking. measured[0] is top (judgeable
  // here), so measured[1] is the runner-up.
  const measured = ranked.filter((s) => !isUnjudgeable(s));
  const second = measured[1] ?? null;

  // Control ceiling (§6.7). Only JUDGEABLE controls set the ceiling: a
  // placeholder 0 from an unjudgeable control is not a measured low, so
  // it must never act as a floor the top audience can beat. A control
  // batch with nothing judgeable in it has NO ceiling, which is
  // Inconclusive — a real Strong needs a real baseline. Untested
  // book/game scopes land here first (docs/qloo-coverage.md).
  const judgeableControls = controlScores.filter((s) => !isUnjudgeable(s));
  const hasControls = controlScores.length > 0;
  const hasCeiling = judgeableControls.length > 0;
  const controlBest = hasCeiling ? bestScore(judgeableControls) : 0;
  // A judgeable ceiling of exactly 0 means no control audience matched
  // any pitch tag: the baseline is uninformative, and a degraded Qloo
  // window reads exactly this way (repeat probe 2026-10-12: a Strong
  // won against 0.000 and never recurred). A real Strong needs a real
  // baseline, so this is Inconclusive — never Strong, never Weak.
  if (hasCeiling && controlBest === 0) {
    return inconclusive(scores, "no-signal");
  }
  const marginTopVsControl = hasCeiling ? top.score - controlBest : 0;
  const clearsControl =
    hasCeiling && marginTopVsControl + MARGIN_EPSILON >= controlMargin;
  if (!clearsControl) {
    // Controls exist but none could be judged: the baseline itself was
    // not measured, so this is Inconclusive, never Weak ("measured and
    // low") and never Strong (nothing was beaten).
    if (hasControls && !hasCeiling) {
      return inconclusive(scores, "no-control");
    }
    return {
      verdict: "Weak",
      topAudienceId: top.audienceId,
      marginTopVsSecond: second === null ? top.score : top.score - second.score,
      marginTopVsControl,
      clearsControl: false,
      surprise: false,
    };
  }

  const marginTopVsSecond =
    second === null ? top.score : top.score - second.score;
  const secondClears =
    second !== null &&
    !isUnjudgeable(second) &&
    second.score - controlBest + MARGIN_EPSILON >= controlMargin;
  if (secondClears && marginTopVsSecond + MARGIN_EPSILON < splitMargin) {
    return {
      verdict: "Split",
      topAudienceId: top.audienceId,
      marginTopVsSecond,
      marginTopVsControl,
      clearsControl: true,
      surprise: false,
    };
  }

  const hypothesis = scores.find((s) => s.audienceId === hypothesisId) ?? null;
  const surprise =
    hypothesis !== null &&
    top.audienceId !== hypothesisId &&
    !isUnjudgeable(hypothesis) &&
    top.score - hypothesis.score + MARGIN_EPSILON >= surpriseMargin;

  return {
    verdict: "Strong",
    topAudienceId: top.audienceId,
    marginTopVsSecond,
    marginTopVsControl,
    clearsControl: true,
    surprise,
  };
}
