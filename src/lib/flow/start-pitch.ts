/**
 * Start-pitch parsing shared by the run pages. The landing hands the
 * pitch over as `?pitch=`; a run page with no usable pitch has nothing
 * to show (entry lives on the landing), so it must send the reader
 * back rather than render an empty stage.
 *
 * A worked example also carries its comparable titles as `?titles=`,
 * comma-separated — the same shape the titles leg already accepts.
 *
 * Spec ref: §5 (the pitch moves from the landing into the run), §6.2
 * (similar-to titles).
 */

import { parseSimilarTitles } from "./similar-titles.ts";

/** Titles a URL may prefill; the run reads at most five for hold-outs. */
export const MAX_START_TITLES = 5;

/** First value of a possibly-repeated search param. */
export function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/**
 * The pitch a run page may start from, or `""` when there is none.
 * Trimmed and capped like the client's own read, so a whitespace-only
 * or oversized param never counts as a start.
 */
export function startPitch(
  params: Record<string, string | string[] | undefined>,
): string {
  return firstParam(params.pitch).slice(0, 2000).trim();
}

/**
 * Comparable titles a worked example handed over, as the comma-joined
 * string the titles field uses. Missing, blank and duplicate titles
 * drop; the cap keeps a crafted URL from spending unbounded searches.
 */
export function startTitles(
  params: Record<string, string | string[] | undefined>,
): string {
  const raw = parseSimilarTitles(firstParam(params.titles).slice(0, 600));
  return [...new Set(raw)].slice(0, MAX_START_TITLES).join(", ");
}
