/**
 * Day 2 S: rival-overlap rule. Owned by S.
 *
 * Pure logic on frozen `Audience` shapes: no Qloo calls, no scoring.
 * Fixtures here are inline test data only; Q-owned `src/lib/fixtures/`
 * is never touched.
 *
 * Spec ref: §6.3 (a rival more than about a third overlapping the
 * hypothesis or another rival is replaced; up to five builds; the run
 * continues with what exists when fewer than two valid rivals remain),
 * §6.4 (a control sharing ANY title with the named audience does not
 * set the ceiling; the full set comes back when every control does),
 * §7 (comparison is our code, not the AI's).
 */

import type { Audience } from "@/lib/types";

/** §6.3 "more than about a third": strictly greater than 1/3. */
export const OVERLAP_LIMIT = 1 / 3;

/** §6.3: three rivals by default. */
export const MAX_RIVALS = 3;

/** §6.3: up to five builds when early rivals fail the test. */
export const MAX_BUILDS = 5;

/**
 * Shared titles ÷ smaller list size, compared by canonical `qlooId`.
 * Empty title lists score 0 (no data, never similar).
 */
export function overlapRatio(a: Audience, b: Audience): number {
  const aIds = new Set(a.titles.map((t) => t.qlooId));
  const bIds = new Set(b.titles.map((t) => t.qlooId));
  if (aIds.size === 0 || bIds.size === 0) return 0;
  let shared = 0;
  for (const id of aIds) {
    if (bIds.has(id)) shared += 1;
  }
  return shared / Math.min(aIds.size, bIds.size);
}

/** True when the pair overlaps by more than a third (§6.3). */
export function isTooSimilar(a: Audience, b: Audience): boolean {
  return overlapRatio(a, b) > OVERLAP_LIMIT;
}

/**
 * §6.4: true when the two audiences share at least one title (canonical
 * `qlooId`). This is the CONTROL rule, not the rival rule: a control
 * that shares any title with the named audience is not an unrelated
 * comparison field — it holds the very film under test.
 *
 * The Horror control seed (`Halloween`, `A Nightmare on Elm Street`,
 * `Get Out`) is the case that forced this: name "Get Out" as one of
 * three titles and the control shares exactly one title with the named
 * audience — a third of it, which the ratio rule (`isTooSimilar`, more
 * than a third) let through. The control row was then the subject
 * film's own crowd reading as an independent baseline
 * (`docs/backtest-results.md`, problem 1).
 *
 * Deliberately separate from `isTooSimilar`: the §6.3 rival rule is a
 * deliberate ratio and stays exactly as it is.
 */
export function sharesAnyTitle(a: Audience, b: Audience): boolean {
  const bIds = new Set(b.titles.map((t) => t.qlooId));
  return a.titles.some((t) => bIds.has(t.qlooId));
}

export interface DroppedRival {
  id: string;
  reason: string;
}

export interface RivalSelection {
  kept: Audience[];
  dropped: DroppedRival[];
}
/**
 * Walk up to `maxBuilds` candidates in order, keeping at most `maxKept`.
 * A candidate is dropped when it overlaps the hypothesis or any kept
 * rival. Callers report `dropped` so the run can say it continues with
 * what exists (§6.3).
 */
export function selectRivals(
  hypothesis: Audience,
  candidates: Audience[],
  maxKept: number = MAX_RIVALS,
  maxBuilds: number = MAX_BUILDS,
): RivalSelection {
  const kept: Audience[] = [];
  const dropped: DroppedRival[] = [];
  for (const candidate of candidates.slice(0, maxBuilds)) {
    if (kept.length >= maxKept) break;
    if (isTooSimilar(candidate, hypothesis)) {
      dropped.push({
        id: candidate.id,
        reason: `shares ${overlapRatio(candidate, hypothesis).toFixed(2)} of titles with the hypothesis`,
      });
      continue;
    }
    const clash = kept.find((rival) => isTooSimilar(candidate, rival));
    if (clash !== undefined) {
      dropped.push({
        id: candidate.id,
        reason: `shares ${overlapRatio(candidate, clash).toFixed(2)} of titles with rival ${clash.id}`,
      });
      continue;
    }
    kept.push(candidate);
  }
  return { kept, dropped };
}

/**
 * Pitch-aware control ceiling: drop controls that share ANY title with
 * the hypothesis audience (`sharesAnyTitle`). Hardcoded seeds stay — this
 * only chooses which controls set the verdict ceiling for this pitch.
 *
 * The threshold is "any shared title", not the §6.3 rival ratio: a
 * control that holds one of the titles under test is not an unrelated
 * comparison field, whatever fraction that title is of the control
 * (`docs/backtest-results.md`, problem 1 — the Horror seed holds "Get
 * Out").
 *
 * Never lets the ceiling vanish: when every control is too close, the
 * full set comes back (`fellBack: true`, `filtered: false`) so the
 * verdict still has a baseline. Callers report `excluded` in the
 * controls step so the trace stays honest.
 */
export interface ControlEligibility {
  eligible: Audience[];
  excluded: Audience[];
  /** True when at least one control was actually dropped. */
  filtered: boolean;
  /** True when every control was too close and the full set came back. */
  fellBack: boolean;
}

export function eligibleControls(
  hypothesis: Audience,
  controls: Audience[],
): ControlEligibility {
  const excluded = controls.filter((control) =>
    sharesAnyTitle(control, hypothesis),
  );
  if (excluded.length === 0) {
    return {
      eligible: [...controls],
      excluded: [],
      filtered: false,
      fellBack: false,
    };
  }
  if (controls.length > 0 && excluded.length >= controls.length) {
    return {
      eligible: [...controls],
      excluded,
      filtered: false,
      fellBack: true,
    };
  }
  const excludedIds = new Set(excluded.map((c) => c.id));
  return {
    eligible: controls.filter((c) => !excludedIds.has(c.id)),
    excluded,
    filtered: true,
    fellBack: false,
  };
}
