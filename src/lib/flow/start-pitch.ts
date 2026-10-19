/**
 * Start-pitch parsing shared by the run pages. The landing hands the
 * pitch over as `?pitch=`; a run page with no usable pitch has nothing
 * to show (entry lives on the landing), so it must send the reader
 * back rather than render an empty stage.
 *
 * Spec ref: §5 (the pitch moves from the landing into the run).
 */

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
