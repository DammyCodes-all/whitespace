/**
 * Tag expansion retry. Owned by S.
 *
 * Pure logic, no Qloo calls. Vocabulary mismatch (§6.5/§6.6): a pitch
 * word can resolve to a real Qloo tag yet sit in no audience's taste
 * list (`space` vs `outer_space`, mood words vs top-50 tastes), scoring
 * a row of zeros. Instead of asking the user to reword, the pipeline
 * gives each unmatched word one silent second chance against the
 * hypothesis audience's own top tastes (pseudo-relevance feedback):
 * a taste whose display name covers the word (every word token appears
 * in the name) is borrowed at half weight, labeled `word→Tag Name`
 * wherever it renders. No extra Qloo calls: both sides already arrived.
 *
 * Drift control (research consensus: over-expansion is the main risk):
 * closed fetched-tastes-only list, full token containment (no fuzzy
 * similarity), max 2 expansions per run, half weight, borrowed ids
 * come from fetched tastes so §8 grounding holds. Nothing is invented.
 *
 * Spec ref: §6.5 (only real Qloo tags score), §6.6 (weighted mean;
 * pinned x2 precedent for non-unit weights), §8 (grounding), §7 (our
 * code scores).
 */

/** Local mirror of Q's normalizeKey (file ownership, cf. pipeline/run). */
function normalizeWord(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(value: string): string[] {
  return normalizeWord(value).split(" ").filter(Boolean);
}

/**
 * True when every token of the word appears in the candidate tag name,
 * e.g. `space` in `Outer Space`. Strict containment, never fuzzy
 * similarity: precision over recall.
 */
export function covers(word: string, name: string): boolean {
  const wordTokens = tokens(word);
  if (wordTokens.length === 0) return false;
  const nameTokens = new Set(tokens(name));
  return wordTokens.every((t) => nameTokens.has(t));
}

export interface HypTaste {
  id: string;
  name: string;
}

export interface Expansion {
  /** Original pitch word, e.g. "space". */
  word: string;
  /** Borrowed Qloo tag id, e.g. "urn:tag:keyword:media:outer_space". */
  qlooTagId: string;
  /** Qloo display name, e.g. "Outer Space". */
  name: string;
}

/** At most this many borrowed tags per run (drift control). */
export const MAX_EXPANSIONS = 2;
/** Borrowed tags count half (§6.6 pinned-x2 precedent, inverted). */
export const EXPANSION_WEIGHT = 0.5;
/** Only the hypothesis top tastes may lend vocabulary. */
export const EXPANSION_TOP_TASTES = 15;
/** At most this many unmatched words get a retry (bounded work). */
export const MAX_EXPANSION_WORDS = 4;

/**
 * Pick borrowed tags: per unmatched word, the highest-ranked hypothesis
 * top taste whose name covers the word and whose id is not already
 * scored. Deterministic: same inputs, same expansions (§10 #7).
 */
export function selectExpansions(
  unmatchedWords: string[],
  hypTop: readonly HypTaste[],
  existingIds: ReadonlySet<string>,
  cap: number = MAX_EXPANSIONS,
): Expansion[] {
  const seen = new Set(existingIds);
  const out: Expansion[] = [];
  for (const word of unmatchedWords.slice(0, MAX_EXPANSION_WORDS)) {
    if (out.length >= cap) break;
    const best = hypTop.find((t) => !seen.has(t.id) && covers(word, t.name));
    if (best === undefined) continue;
    seen.add(best.id);
    out.push({ word, qlooTagId: best.id, name: best.name });
  }
  return out;
}
