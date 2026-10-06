/**
 * Shared query cleaning for the Day 2 Q resolvers. Owned by Q.
 *
 * Used by `./resolve-titles.ts` and `./resolve-tags.ts`. Matching and
 * dedupe share one normalized key so "slow-burn" and "slow burn" issue a
 * single call (§11 quota).
 */

export function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Trim, drop empties, dedupe, cap. */
export function cleanQueries(values: string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const trimmed = raw.trim();
    if (trimmed === "") continue;
    const key = normalizeKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= cap) break;
  }
  return out;
}
