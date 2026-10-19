/**
 * Day 4 S: control test plus verdict. Owned by S.
 *
 * Pure logic on the frozen `FitScore` / `VerdictResult` shapes: no Qloo
 * calls, no AI, no rendering. Ranking here is our code, not the AI's
 * (§7). Deterministic, so the same scores always give the same verdict
 * (§10 #7).
 *
 * §6.7, in full, because each row of the table is a branch below:
 * - Strong: the top audience clears control and is clearly ahead of
 *   the measured runner-up.
 * - Mixed: the top clears control but is not clearly ahead of the
 *   runner-up, or its lead only holds thanks to its own title gifts.
 * - Weak: no audience clears control.
 * - Inconclusive: the pooled scoring set is too thin, too many
 *   audiences had no data, the comparison field was unmeasured, or the
 *   top's lead could not be confirmed without its own title gifts.
 * - Surprise headline: the top audience is not the hypothesis and beats
 *   it clearly.
 *
 * Three rules changed on 2026-10-19 (fixes 1, 2, 4 and 7 in
 * docs/build-tracker.md); the old rules are kept in the notes because
 * they explain the new ones:
 *
 * - CONTROLLED BY RANK, NOT BY A FIXED GAP. Scores are a weighted mean
 *   over K pooled tags, so one relationship measured 0.180 at K=12,
 *   0.108 at K=20 and 0.036 at K=60. A fixed 0.05 margin therefore
 *   flipped Strong/Weak on pool size alone. "Clears control" now means
 *   beating every judgeable comparison audience, by any clear margin.
 * - THE COMPARISON FIELD IS THE ~20 OTHER-GENRE CONTROLS (plus strangers
 *   when measured), and it must be measured: at least
 *   MIN_JUDGEABLE_CONTROLS judgeable controls and a strongest
 *   comparison that really holds pooled tags (MIN_CEILING_SHARE).
 * - SUFFICIENCY IS THE POOL, NOT THE PITCH WORD RATE. The verdict gates
 *   on the pooled tag count (MIN_MATCHED_TAGS); the pitch-word coverage
 *   fraction is reported, never a gate — title gifts can carry a run
 *   whose wording matches Qloo poorly.
 * - SELF-FIT GATES STRONG. The pool is built from the titles the user
 *   named, so a named-audience win is circular until it survives a
 *   rescore on the pitch-grounded tags alone (the caller passes
 *   `selfFit`; the rounds themselves live in run-flow).
 *
 * All cutoffs live in one tunable place: `src/lib/config.ts`. Margins v1
 * evidence is recorded in docs/qloo-coverage.md (2026-10-09).
 *
 * Spec ref: §6.7 (verdict), §6.6 (scores in, ranks only), §6.5 (pool
 * gate in), §6.4 (comparison field), §10 #4 (no-data never reads as a
 * low score: an unjudgeable top can never be Strong or Mixed), §7 (our
 * code ranks), §10 #3 (self-fit gate).
 */

import {
  MAX_UNJUDGEABLE_SHARE,
  MIN_CEILING_SHARE,
  MIN_JUDGEABLE_CONTROLS,
  MIN_MATCHED_TAGS,
  SPLIT_SHARE,
  SURPRISE_SHARE,
} from "../config.ts";
import { isUnjudgeable } from "../scoring/fit.ts";
import type { FitScore, SelfFitStatus, VerdictResult } from "../types.ts";

export {
  COVERAGE_FLOOR,
  MIN_CEILING_SHARE,
  MIN_JUDGEABLE_CONTROLS,
  SPLIT_SHARE,
  SURPRISE_SHARE,
} from "../config.ts";

/**
 * Float hygiene: a 0.0999… gap from rank fractions must read as a clear
 * difference, not as a tie. A tie against a comparison audience is NOT a
 * win: an audience that only matches the strongest comparison is not
 * clearly ahead of it.
 */
const MARGIN_EPSILON = 1e-9;

export interface VerdictInput {
  /** Hypothesis audience id, for the surprise check. */
  hypothesisId: string;
  /** Contender scores: hypothesis plus rivals. */
  scores: FitScore[];
  /**
   * Control scores: the comparison field is every judgeable entry here
   * plus the strangers baseline below.
   */
  controlScores: FitScore[];
  /** Judgeable strangers-baseline score when measured, else null. */
  strangerScore?: FitScore | null;
  /**
   * §6.5: pooled tags the run actually scored on (title gifts plus pitch
   * tags). Fewer than MIN_MATCHED_TAGS is Inconclusive — the pooled set
   * is what sufficiency means now, not the pitch-word match rate.
   */
  pooledTags: number;
  /**
   * §6.7 self-fit gate: outcome of rescoring the field on the
   * pitch-grounded tags alone. Omitted when the check does not apply (a
   * rival won, or no Strong was on the table).
   */
  selfFit?: SelfFitStatus;
}

export interface VerdictOptions {
  splitShare?: number;
  surpriseShare?: number;
  maxUnjudgeableShare?: number;
  minJudgeableControls?: number;
  minCeilingHits?: number;
}

/** Why a comparison field could not be used at all. */
export type ControlFieldReason = "no-control" | "no-signal";

/**
 * One audience against the measured comparison field: how many
 * comparison audiences it beats, out of how many, and whether the
 * field itself is usable. Exported so a rescore can grade a proposed
 * rewrite by exactly the same rule as the run.
 */
export interface ControlTest {
  /** True only when every judgeable comparison audience is beaten. */
  clears: boolean;
  beaten: number;
  total: number;
  /** Strongest judgeable comparison score; null when none was measured. */
  ceiling: number | null;
  reason?: ControlFieldReason;
}

export interface ControlTestOptions {
  minJudgeableControls?: number;
  /** Pool size, for the scaled ceiling-support floor. */
  pooledTags?: number;
  /** Overrides the scaled floor (tests pin it). */
  minCeilingHits?: number;
}

function sortedByScore(scores: readonly FitScore[]): FitScore[] {
  return [...scores].sort((a, b) => b.score - a.score);
}

/**
 * §6.7 (fix 2): the rank-based control test. An audience clears control
 * when it beats EVERY judgeable comparison audience — no fixed gap, so
 * the answer does not move when the pooled tag count moves. The field
 * must be real before it can gate anything:
 * - fewer than MIN_JUDGEABLE_CONTROLS judgeable controls → no-control
 *   (placeholder zeros never count, §10 #4);
 * - a strongest comparison holding too little of the pool → no-signal.
 *   The floor is a share (MIN_CEILING_SHARE), never fewer than one tag:
 *   one hit is a third of a 3-tag pitch-only set and a lucky draw on a
 *   60-tag pool.
 */
export function testAgainstControls(
  score: number,
  controlScores: readonly FitScore[],
  strangerScore?: FitScore | null,
  options: ControlTestOptions = {},
): ControlTest {
  const minJudgeable = options.minJudgeableControls ?? MIN_JUDGEABLE_CONTROLS;
  const minCeilingHits =
    options.minCeilingHits ??
    Math.max(1, Math.ceil((options.pooledTags ?? 0) * MIN_CEILING_SHARE));

  const judgeableControls = controlScores.filter((s) => !isUnjudgeable(s));
  const stranger =
    strangerScore !== undefined &&
    strangerScore !== null &&
    !isUnjudgeable(strangerScore)
      ? strangerScore
      : null;
  const field = [
    ...judgeableControls,
    ...(stranger === null ? [] : [stranger]),
  ];

  if (judgeableControls.length < minJudgeable) {
    return {
      clears: false,
      beaten: 0,
      total: field.length,
      ceiling: null,
      reason: "no-control",
    };
  }

  const strongest = sortedByScore(field)[0];
  if (
    strongest === undefined ||
    strongest.matchedTags.length < minCeilingHits
  ) {
    return {
      clears: false,
      beaten: 0,
      total: field.length,
      ceiling: strongest?.score ?? null,
      reason: "no-signal",
    };
  }

  const beaten = field.filter((c) => c.score + MARGIN_EPSILON < score).length;
  return {
    clears: beaten === field.length,
    beaten,
    total: field.length,
    ceiling: strongest.score,
  };
}

function inconclusive(
  scores: readonly FitScore[],
  reason: VerdictResult["inconclusiveReason"],
  topAudienceId?: string | null,
  extra: Partial<VerdictResult> = {},
): VerdictResult {
  const top = topAudienceId ?? sortedByScore(scores)[0]?.audienceId ?? null;
  return {
    verdict: "Inconclusive",
    topAudienceId: top,
    // No measured runner-up: the gap is unknown, so it is null, never a
    // fabricated 0 (§6.7 display honesty, fix 4).
    marginTopVsSecond: null,
    marginTopVsControl: 0,
    clearsControl: false,
    surprise: false,
    inconclusiveReason: reason,
    ...extra,
  };
}

/**
 * §6.7: rank the contenders against the comparison field and return the
 * frozen `VerdictResult`. Never throws on empty or all-no-data input:
 * those are Inconclusive, not errors.
 */
export function decideVerdict(
  input: VerdictInput,
  options: VerdictOptions = {},
): VerdictResult {
  const splitShare = options.splitShare ?? SPLIT_SHARE;
  const surpriseShare = options.surpriseShare ?? SURPRISE_SHARE;
  const maxUnjudgeableShare =
    options.maxUnjudgeableShare ?? MAX_UNJUDGEABLE_SHARE;

  const {
    hypothesisId,
    scores,
    controlScores,
    strangerScore,
    pooledTags,
    selfFit,
  } = input;
  if (scores.length === 0) {
    return inconclusive(scores, "empty");
  }

  // §6.7 Inconclusive first: the pooled scoring set, then the no-data
  // share. Either means the app cannot say anything reliable, so no
  // other branch runs. The pitch-word coverage fraction is NOT here
  // (fix 7): it describes the wording, not the set we scored.
  if (pooledTags < MIN_MATCHED_TAGS) {
    return inconclusive(scores, "pool-thin");
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
  // clear control or win a margin, so it cannot be Strong or Mixed.
  if (isUnjudgeable(top)) {
    return inconclusive(scores, "top-unjudgeable", top.audienceId);
  }

  // Margins measure against real contenders only: unjudgeable
  // placeholder 0s must neither inflate the margin nor mask a close real
  // runner-up further down the ranking. measured[0] is top (judgeable
  // here), so measured[1] is the runner-up.
  const measured = ranked.filter((s) => !isUnjudgeable(s));
  const second = measured[1] ?? null;

  const field = testAgainstControls(top.score, controlScores, strangerScore, {
    minJudgeableControls: options.minJudgeableControls,
    minCeilingHits: options.minCeilingHits,
    pooledTags,
  });
  if (field.reason !== undefined) {
    return inconclusive(scores, field.reason, top.audienceId);
  }

  const marginTopVsControl = top.score - (field.ceiling ?? 0);
  const controlsBeaten = { beaten: field.beaten, total: field.total };
  const marginTopVsSecond = second === null ? null : top.score - second.score;

  if (!field.clears) {
    // Measured field, measured loss: Weak is the honest word. (An
    // unusable field never reaches here — it returned no-control or
    // no-signal above.)
    return {
      verdict: "Weak",
      topAudienceId: top.audienceId,
      marginTopVsSecond,
      marginTopVsControl,
      clearsControl: false,
      surprise: false,
      controlsBeaten,
    };
  }

  // §6.7 self-fit gate: a lead that only exists because of the audience's
  // own title gifts is not a fit we can confirm. "Unverified" (nothing
  // left to judge without those gifts) abstains; "leans" keeps the
  // result visible as Mixed rather than claiming a Strong.
  if (selfFit === "unverified") {
    return inconclusive(scores, "self-fit", top.audienceId, {
      controlsBeaten,
      selfFit,
    });
  }

  const cleared = {
    topAudienceId: top.audienceId,
    marginTopVsSecond,
    marginTopVsControl,
    clearsControl: true,
    controlsBeaten,
    surprise: false,
    ...(selfFit === undefined ? {} : { selfFit }),
  } satisfies Omit<VerdictResult, "verdict">;

  if (selfFit === "leans") {
    return { verdict: "Mixed", ...cleared };
  }
  // Strong means clearly ahead: a photo-finish with the runner-up is
  // Mixed, whichever of the two is stronger. "Clearly" is a share of
  // the winner's own score, so a flat field on a large pool is judged
  // the same way a sharp one on a small pool (SPLIT_SHARE).
  if (
    second !== null &&
    top.score - second.score + MARGIN_EPSILON < splitShare * top.score
  ) {
    return { verdict: "Mixed", ...cleared };
  }

  const hypothesis = scores.find((s) => s.audienceId === hypothesisId) ?? null;
  const surprise =
    hypothesis !== null &&
    top.audienceId !== hypothesisId &&
    !isUnjudgeable(hypothesis) &&
    top.score - hypothesis.score + MARGIN_EPSILON >= surpriseShare * top.score;

  return { verdict: "Strong", ...cleared, surprise };
}
