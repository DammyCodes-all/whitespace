/**
 * Day 8 S: change-stage contract types. Owned by S.
 *
 * Types only. The `proposeChange` runner that used to live here was
 * retired once `src/app/api/flow/change/route.ts` reimplemented the
 * orchestration inline against the live Qloo path — nothing imported
 * it at runtime, only these shapes. §6.9 behavior is unchanged.
 *
 * The §6.9 seam is preserved on the type: the proposal mechanism
 * receives the constraint and the gaps — never the bar — so no
 * implementation can grade its own homework.
 */

import type { ChangeBar, ChangeCheck } from "../policy/change.ts";
import type { GapItem } from "../scoring/gaps.ts";
import type { FitScore, QlooCall } from "../types.ts";

/**
 * Changed-pitch proposer. Receives the constraint and the research
 * leads — never the bar. Return the full rewritten pitch text.
 */
export type ProposeFn = (
  constraint: string,
  gaps: GapItem[],
) => Promise<string>;

export interface ChangedRun {
  constraint: string;
  proposedPitch: string;
  /** Gap labels the proposal actually used. */
  usedGapLabels: string[];
  bar: ChangeBar;
  check: ChangeCheck;
  /** Null when unrunnable: no judged top means no baseline to rise from. */
  after: FitScore | null;
  coverageAfter: number;
  calls: QlooCall[];
}
