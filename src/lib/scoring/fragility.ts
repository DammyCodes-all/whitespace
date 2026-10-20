/**
 * §6.6/§6.7: the fragility guard.
 *
 * Pure logic on the hold-out rounds the run ALREADY computes: no Qloo
 * calls, no scoring, no rendering, no second opinion. The run hands
 * over one round per gifting title — the named audience's score and the
 * field's best score, on the full set and on the same reduced set —
 * and this module decides whether the named audience leaned on its own
 * gifts.
 *
 * The rule (§6.6): the named audience is FRAGILE when a round drops it
 * FURTHER than the same round drops the field's best score. It leans on
 * its own gifts more than the field leans on that same removal. The
 * comparison is paired (same round, same reduced set), so it needs no
 * margin of its own, and a gap smaller than one point at the displayed
 * precision (0.01) is display noise, not a signal. A run with no
 * hold-out rounds is never fragile.
 *
 * The cap (§6.7): a fragile named audience cannot read Strong fit. It
 * is capped at Mixed fit and the reason travels with it — which title
 * was removed, what it did to the named audience and to the field.
 * Nothing else moves: the ranking, the scores, the margins and the
 * reach plan stay exactly as measured.
 *
 * Spec ref: §6.6 (the hold-out rounds read as a fragility test),
 * §6.7 (the cap, and the reason that must travel with it),
 * §8 (the rounds are read twice, never recomputed), §10 #14 (the
 * guard's acceptance test), §11 (no strengths, ranks and scores only).
 */

import type { VerdictResult } from "../types.ts";
import { fitIndex } from "./fit-index.ts";

/**
 * One hold-out round: the full set against the same set without one
 * title's gifts. `fieldFull`/`fieldReduced` are the field's BEST score
 * in each round — the "top" row the run ledger already shows, taken
 * over the contender field (the named audience and its rivals).
 *
 * A null score means the audience could not be judged in that round:
 * no data is never a zero (§6.6), and a round that cannot be read
 * carries no signal.
 */
export interface HoldOutRound {
  /** The title whose gifts the round dropped. */
  titleName: string;
  /** How many pooled tags the round dropped. */
  droppedTags: number;
  /** The named audience on the full set. */
  namedFull: number | null;
  /** The named audience on the reduced set. */
  namedReduced: number | null;
  /** The field's best score on the full set. */
  fieldFull: number | null;
  /** The field's best score on the reduced set. */
  fieldReduced: number | null;
}

/** The round that proved the named audience fragile, with its numbers. */
export interface FragileRound {
  /** The title whose gifts the round dropped. */
  titleName: string;
  /** How many pooled tags the round dropped. */
  droppedTags: number;
  /** The named audience on the full set. */
  namedFull: number;
  /** The named audience on the reduced set. */
  namedReduced: number;
  /** The field's best score on the full set. */
  fieldFull: number;
  /** The field's best score on the reduced set. */
  fieldReduced: number;
  /** How far the round dropped the named audience. */
  namedDrop: number;
  /** How far the same round dropped the field's best score. */
  fieldDrop: number;
  /** How much further the named audience fell than the field did. */
  gap: number;
}

/**
 * §6.6: a gap smaller than one point at the displayed precision (0.01)
 * is display noise, not a signal.
 */
export const FRAGILITY_MIN_GAP = 0.01;

/** Float hygiene: the same 1e-9 the verdict policy uses for margins. */
const EPSILON = 1e-9;

/** Fit index points, like every score the run shows. */
function fmt(value: number): string {
  return `${fitIndex(value)}`;
}

/**
 * The round that proves fragility, or null when none does.
 *
 * The worst gap wins, so the title named in the reason is the one that
 * hurt most. A round with an unjudgeable score carries no signal and is
 * skipped; a run with no usable round is never fragile (§6.6).
 */
export function findFragileRound(
  rounds: readonly HoldOutRound[],
): FragileRound | null {
  let worst: FragileRound | null = null;
  for (const round of rounds) {
    if (
      round.namedFull === null ||
      round.namedReduced === null ||
      round.fieldFull === null ||
      round.fieldReduced === null
    ) {
      continue;
    }
    const namedDrop = round.namedFull - round.namedReduced;
    const fieldDrop = round.fieldFull - round.fieldReduced;
    const gap = namedDrop - fieldDrop;
    if (gap + EPSILON < FRAGILITY_MIN_GAP) continue;
    if (worst === null || gap > worst.gap) {
      worst = {
        titleName: round.titleName,
        droppedTags: round.droppedTags,
        namedFull: round.namedFull,
        namedReduced: round.namedReduced,
        fieldFull: round.fieldFull,
        fieldReduced: round.fieldReduced,
        namedDrop,
        fieldDrop,
        gap,
      };
    }
  }
  return worst;
}

/** What the guard found, and what it did about it. */
export interface FragilityFinding {
  /**
   * The named audience is fragile: a hold-out round dropped it further
   * than the same round dropped the field's best score (§6.6). This is
   * the measured fact, whatever the verdict says.
   */
  fragile: boolean;
  /**
   * The verdict is capped at Mixed fit because of it (§6.7). Only a
   * Strong verdict about the named audience can be capped: there is no
   * strong claim to correct otherwise, and a rival's verdict is about
   * that rival's measurement.
   */
  capped: boolean;
  /**
   * The reason, in one sentence: which title was removed, what it did
   * to the named audience and to the field, and whether the verdict was
   * capped. Empty when the named audience is not fragile.
   */
  note: string;
  /** The round that proved it. Null when not fragile. */
  round: FragileRound | null;
}

/** No rounds, no finding: a run without hold-out rounds is never fragile. */
const NOTHING_FRAGILE: FragilityFinding = {
  fragile: false,
  capped: false,
  note: "",
  round: null,
};

/**
 * Read the hold-out rounds as a fragility test and decide whether the
 * verdict is capped (§6.6, §6.7).
 *
 * The cap applies to the named audience's OWN verdict: a Strong verdict
 * whose top audience is the named one. A verdict that is not Strong is
 * left alone — there is no strong claim to correct, and the hold-out
 * rounds in the ledger still show the deltas.
 */
export function assessFragility(input: {
  rounds: readonly HoldOutRound[];
  verdict: VerdictResult;
  hypothesisId: string;
}): FragilityFinding {
  const round = findFragileRound(input.rounds);
  if (round === null) return NOTHING_FRAGILE;

  const { verdict, hypothesisId } = input;
  const capped =
    verdict.verdict === "Strong" && verdict.topAudienceId === hypothesisId;
  const reason = capped
    ? "The verdict is capped at Mixed fit (was Strong fit)."
    : verdict.verdict !== "Strong"
      ? "Not capped: the verdict is not a Strong one, so there is no strong claim to correct."
      : "Not capped: the top audience is not the named audience, so the verdict is not its own.";

  const note = [
    `Without ${round.titleName}'s ${round.droppedTags} gift tag(s) the named audience falls`,
    `from fit index ${fmt(round.namedFull)} to ${fmt(round.namedReduced)}, while the field's best goes`,
    `from ${fmt(round.fieldFull)} to ${fmt(round.fieldReduced)} — it leans on its own gifts`,
    "more than the field leans on that removal.",
    reason,
  ].join(" ");

  return { fragile: true, capped, note, round };
}
