/**
 * Day 4 Q: rival retry and replace. Owned by Q.
 *
 * Takes the AI's rival proposals (names and reasons are the AI's; titles
 * and numbers come only from Qloo per §7) and grounds them: every
 * candidate title is checked via Day 2 `resolveTitles`, misses are dropped
 * and listed as not-found (§6.3), and the survivors run through S's
 * overlap rule — more than a third shared with the hypothesis or another
 * rival means replaced, up to five builds, three kept.
 *
 * If fewer than two valid rivals remain the run continues with what
 * exists (§6.3): `hasEnoughRivals` is false so the run can say so.
 *
 * Spec ref: §6.3 (rivals), §6.2 (drop what does not resolve), §8 (one
 * miss never fails the batch), §6.12 (every call traced), §11 (caps
 * guard quota).
 */

import { resolveTitles } from "@/lib/qloo/resolve";
import type { DroppedRival } from "@/lib/scoring/overlap";
import { MAX_BUILDS, MAX_RIVALS, selectRivals } from "@/lib/scoring/overlap";
import type { Audience, QlooCall, WorkType } from "@/lib/types";

/** §6.3: three to five candidate titles per rival. */
export const MAX_TITLES_PER_RIVAL = 5;

/** §6.3: the run needs at least two valid rivals to compare properly. */
export const MIN_VALID_RIVALS = 2;

export interface RivalProposal {
  id: string;
  name: string;
  /** One-sentence reason, written by the AI (§7). */
  reason: string;
  /** Candidate titles; each is checked in Qloo, misses are dropped. */
  titles: string[];
}

export interface BuildRivalsResult {
  rivals: Audience[];
  dropped: DroppedRival[];
  /** Rivals with no resolvable titles are reported here, not kept. */
  emptyRivals: DroppedRival[];
  calls: QlooCall[];
  /** False when fewer than two valid rivals remain (§6.3). */
  hasEnoughRivals: boolean;
}

/**
 * Ground up to five rival proposals and keep at most three that are
 * genuinely different from the hypothesis and each other. Never throws
 * on Qloo failure: misses become not-found titles, empty rivals are
 * reported, and the batch always resolves.
 */
export async function buildRivals(
  hypothesis: Audience,
  proposals: RivalProposal[],
  workType: WorkType,
): Promise<BuildRivalsResult> {
  if (typeof window !== "undefined") {
    throw new Error(
      "buildRivals is server-only and cannot run in the browser.",
    );
  }
  const calls: QlooCall[] = [];
  const emptyRivals: DroppedRival[] = [];
  const built: Audience[] = [];

  for (const proposal of proposals.slice(0, MAX_BUILDS)) {
    const {
      resolved,
      notFoundTitles,
      calls: itemCalls,
    } = await resolveTitles(
      proposal.titles.slice(0, MAX_TITLES_PER_RIVAL),
      workType,
    );
    calls.push(...itemCalls);
    if (resolved.length === 0) {
      emptyRivals.push({
        id: proposal.id,
        reason: "no titles resolved in Qloo, dropped",
      });
      continue;
    }
    built.push({
      id: proposal.id,
      kind: "rival",
      name: proposal.name,
      reason: proposal.reason,
      titles: resolved,
      notFoundTitles,
    });
  }

  const { kept, dropped } = selectRivals(hypothesis, built, MAX_RIVALS);
  return {
    rivals: kept,
    dropped,
    emptyRivals,
    calls,
    hasEnoughRivals: kept.length >= MIN_VALID_RIVALS,
  };
}
