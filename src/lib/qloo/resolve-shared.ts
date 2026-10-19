/**
 * Shared query cleaning for the Day 2 Q resolvers. Owned by Q.
 *
 * Used by `./resolve-titles.ts` and `./resolve-tags.ts`. Matching and
 * dedupe share one normalized key so "slow-burn" and "slow burn" issue a
 * single call (§11 quota).
 *
 * Plurals fold to one key (2026-10-17): `/v2/tags` is a substring search,
 * so `vampire` finds `Vampires` and the exact gate then rejected it —
 * a silent coverage loss with no error anywhere. Folding a trailing `s`
 * on BOTH sides keeps true exact matches intact and recovers the
 * singular/plural class. Guards keep `-ss`/`-us`/`-is` words whole
 * (madness, census, analysis) instead of shaving a real last letter.
 */

/** Trailing letters that look plural but are part of the word. */
const NOT_PLURAL_ENDINGS = /(?:ss|us|is)$/;

/** Shortest word worth folding (`gas`, `its` stay as typed). */
const MIN_FOLD_LENGTH = 4;

/** Symmetric singular fold: same rule on the query and the Qloo name. */
export function foldPlural(value: string): string {
  if (
    value.length >= MIN_FOLD_LENGTH &&
    value.endsWith("s") &&
    !NOT_PLURAL_ENDINGS.test(value)
  ) {
    return value.slice(0, -1);
  }
  return value;
}

export function normalizeKey(value: string): string {
  const base = value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return foldPlural(base);
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
