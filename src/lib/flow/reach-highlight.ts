/**
 * Name emphasis inside reach prose.
 *
 * The reach card is prose, not a list (§6.8), but the names inside it
 * are the run's own measured items — Qloo's entities, in Qloo's order.
 * Splitting a sentence into plain and named runs lets the card show
 * *which* things it means without adding a word: the names come from
 * the same items the prose was written from, so emphasis can never
 * introduce a fact the run did not measure.
 *
 * Pure, no I/O, exported for unit tests.
 */

export interface ProseSegment {
  text: string;
  /** True when the run covers a measured item's name. */
  strong: boolean;
  /** Stable id for the segment, so a rendered list needs no index key. */
  id: string;
}

/** Below this a name is too likely to be an ordinary word. */
const MIN_NAME_LENGTH = 4;

/**
 * Function words and bare plurals that show up as taste labels but
 * would light up half a sentence if they were emphasised.
 */
const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "along",
  "also",
  "among",
  "been",
  "being",
  "both",
  "came",
  "come",
  "could",
  "does",
  "doing",
  "done",
  "each",
  "even",
  "ever",
  "from",
  "gave",
  "give",
  "gone",
  "good",
  "have",
  "here",
  "just",
  "keep",
  "kind",
  "know",
  "like",
  "made",
  "make",
  "many",
  "more",
  "most",
  "much",
  "must",
  "near",
  "need",
  "only",
  "other",
  "ours",
  "over",
  "part",
  "same",
  "should",
  "show",
  "side",
  "some",
  "such",
  "take",
  "than",
  "that",
  "them",
  "then",
  "they",
  "this",
  "those",
  "thus",
  "under",
  "upon",
  "used",
  "very",
  "want",
  "well",
  "were",
  "what",
  "when",
  "which",
  "while",
  "will",
  "with",
  "within",
  "work",
  "your",
]);

function isWordChar(char: string): boolean {
  return /[A-Za-z0-9]/.test(char);
}

/**
 * Split prose into plain and named runs. A name matches on word
 * boundaries only ("Heat" never lights up inside "Theater") and the
 * longest name wins where two overlap. Matching is case-insensitive;
 * the original casing is what gets returned.
 */
export function segmentReachProse(
  text: string,
  names: readonly string[],
): ProseSegment[] {
  const usable = Array.from(
    new Set(
      names
        .map((name) => name.trim())
        .filter(
          (name) =>
            name.length >= MIN_NAME_LENGTH &&
            !STOP_WORDS.has(name.toLowerCase()),
        ),
    ),
  ).sort((a, b) => b.length - a.length);
  if (usable.length === 0) return [{ text, strong: false, id: "s0" }];

  const segments: ProseSegment[] = [];
  let plain = "";
  let index = 0;
  while (index < text.length) {
    const match = usable.find((name) => {
      if (
        text.slice(index, index + name.length).toLowerCase() !==
        name.toLowerCase()
      ) {
        return false;
      }
      const before = index === 0 ? "" : text[index - 1];
      const after = text[index + name.length] ?? "";
      if (before !== "" && isWordChar(before)) return false;
      if (after !== "" && isWordChar(after)) return false;
      return true;
    });
    if (match === undefined) {
      plain += text[index];
      index += 1;
      continue;
    }
    if (plain !== "") {
      segments.push({ text: plain, strong: false, id: `s${segments.length}` });
      plain = "";
    }
    segments.push({
      text: text.slice(index, index + match.length),
      strong: true,
      id: `s${segments.length}`,
    });
    index += match.length;
  }
  if (plain !== "") {
    segments.push({ text: plain, strong: false, id: `s${segments.length}` });
  }
  return segments;
}
