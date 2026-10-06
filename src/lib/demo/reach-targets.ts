/**
 * Day 7 U: reach target selection. Owned by U.
 *
 * Pure logic: which audiences get a reach plan from a verdict. Best fit
 * always; the runner-up only on Split (spec §6.8); nothing on
 * Inconclusive (no reliable fit means no reach plan). Unjudgeable
 * audiences never qualify as runner-up: a placeholder 0 is not a
 * credential (§10 #4).
 *
 * Plain functions only: must stay runnable under `node --test` type
 * stripping (relative `.ts` imports, no enums, no namespaces).
 */

import { isUnjudgeable } from "../scoring/fit.ts";
import type { Audience, FitScore, VerdictResult } from "../types.ts";

/**
 * Audiences to build reach plans for, best fit first. Returns [] when
 * there is no one to reach (Inconclusive verdict or unknown top).
 */
export function selectReachTargets(
  verdict: VerdictResult,
  scores: FitScore[],
  audiences: Audience[],
): Audience[] {
  if (verdict.verdict === "Inconclusive") return [];
  const top = audiences.find((a) => a.id === verdict.topAudienceId);
  if (!top) return [];
  if (verdict.verdict !== "Split") return [top];
  const byId = new Map(scores.map((s) => [s.audienceId, s]));
  let runnerUp: Audience | null = null;
  let best = -Infinity;
  for (const audience of audiences) {
    if (audience.id === top.id) continue;
    const score = byId.get(audience.id);
    if (!score || isUnjudgeable(score)) continue;
    if (score.score > best) {
      best = score.score;
      runnerUp = audience;
    }
  }
  return runnerUp ? [top, runnerUp] : [top];
}
