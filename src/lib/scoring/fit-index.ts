/**
 * The single display conversion for fit scores.
 *
 * Scoring stays 0–1 internally (§6.6). Every surface that shows a score
 * speaks in fit index points, 0–100, relative to the audiences measured
 * in the same run. It is not a probability, so no display path appends a
 * percent sign.
 */

/** The one-line definition shown beside the scores. */
export const FIT_INDEX_NOTE =
  "Fit index is relative to the audiences measured here, out of 100 — not a probability.";

/** 0–1 score in, whole fit-index point out. */
export function fitIndex(score: number): number {
  return Math.round(score * 100);
}

/** The compact form for a bar row or a ledger cell. */
export function fitIndexLabel(score: number): string {
  return `${fitIndex(score)}/100`;
}
