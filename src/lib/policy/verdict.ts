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
 * All cutoffs live in one tunable place. §6.7 says the exact margins get
 * set in week one by testing on real pitches; Day 10 records margins v1.
 * The values here are stubs, not findings.
 *
 * Spec ref: §6.7 (verdict), §6.6 (scores in, ranks only), §6.5
 * (coverage in), §10 #4 (no-data never reads as a low score: an
 * unjudgeable top can never be Strong or Split), §7 (our code ranks).
 */

import { isUnjudgeable } from "../scoring/fit.ts";
import type { FitScore, VerdictResult } from "../types.ts";

/**
 * Provisional stubs. §6.7 sets these by testing on real pitches; Day 10
 * records v1. Change them here and nothing else in the codebase moves.
 */
export const CONTROL_MARGIN = 0.1;
export const SPLIT_MARGIN = 0.05;
export const SURPRISE_MARGIN = 0.1;
export const COVERAGE_FLOOR = 0.34;
export const MAX_UNJUDGEABLE_SHARE = 0.5;

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
  reason: "coverage" | "nodata" | "top-unjudgeable" | "empty",
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

  // No control baseline means nothing can clear it: Weak, not Strong.
  const hasControls = controlScores.length > 0;
  const controlBest = hasControls ? bestScore(controlScores) : 0;
  const marginTopVsControl = top.score - controlBest;
  const clearsControl = hasControls && marginTopVsControl >= controlMargin;
  if (!clearsControl) {
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
    second.score - controlBest >= controlMargin;
  if (secondClears && marginTopVsSecond < splitMargin) {
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
    top.score - hypothesis.score >= surpriseMargin;

  return {
    verdict: "Strong",
    topAudienceId: top.audienceId,
    marginTopVsSecond,
    marginTopVsControl,
    clearsControl: true,
    surprise,
  };
}
