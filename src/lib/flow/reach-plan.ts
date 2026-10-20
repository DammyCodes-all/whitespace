/**
 * §6.8: who gets a reach plan.
 *
 * The winner always does — the verdict says it cleared the comparison
 * line. A Mixed verdict's runner-up only joins when it cleared the
 * line too ("only when an audience clears control"). A capped verdict
 * (§6.7, the fragility cap) is Mixed by fiat, so its runner-up — which
 * never cleared the line — gets no plan, and the run spends no extra
 * call on it.
 *
 * Pure logic on the frozen shapes: no Qloo calls, no AI, no rendering.
 *
 * Spec ref: §6.8 (reach only past the line), §6.7 (the fragility cap
 * keeps the plan with the top audience).
 */

import { selectReachTargets } from "../demo/reach-targets.ts";
import { CONTROL_MARGIN, MARGIN_EPSILON } from "../policy/verdict.ts";
import { isUnjudgeable } from "../scoring/fit.ts";
import type { Audience, FitScore, VerdictResult } from "../types.ts";

/**
 * The audiences a reach plan is built for, best fit first.
 *
 * `ceiling` is the comparison line the verdict was judged against. It
 * is null only when no line was measured, and then nothing is filtered
 * out: an unknown line never removes a measured audience.
 */
export function reachTargets(
  verdict: VerdictResult,
  scores: FitScore[],
  audiences: Audience[],
  ceiling: number | null,
): Audience[] {
  const targets = selectReachTargets(verdict, scores, audiences);
  if (verdict.verdict !== "Mixed" || targets.length < 2 || ceiling === null) {
    return targets;
  }
  const byId = new Map(scores.map((s) => [s.audienceId, s]));
  return targets.filter((target, index) => {
    // The winner cleared the line by definition (the verdict says so).
    if (index === 0) return true;
    const fit = byId.get(target.id);
    if (fit === undefined || isUnjudgeable(fit)) return false;
    return fit.score - ceiling + MARGIN_EPSILON >= CONTROL_MARGIN;
  });
}
