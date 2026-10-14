/**
 * Shared similar-titles parsing (Package C). Owned by U.
 *
 * Comma-separated free text in, trimmed non-empty titles out. The
 * tags-phase editor, the Check-in-Qloo pre-check, and the run all
 * parse through here so the pre-check can never disagree with the run
 * about what was entered. Pure, no I/O — runnable under `node --test`
 * (relative `.ts` imports, no enums, no namespaces).
 */
export function parseSimilarTitles(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}
