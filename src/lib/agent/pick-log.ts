/**
 * Dev-facing one-liners for the title-gift preview and pick stages.
 *
 * The pick has two "nothing was cut" outcomes that look identical from
 * outside: the model genuinely kept every candidate, or the pass failed
 * and the route failed open by design (§7). Both return 200 with every
 * chip intact, so a status code and an unchanged chip row cannot tell
 * them apart. Each pass logs one line naming the outcome. Labels only —
 * never the pitch, never a key.
 *
 * Pure formatting, no I/O, exported for unit tests.
 */

const MAX_LABELS = 12;
const MAX_LABEL_CHARS = 40;

export type PickOutcome =
  | { kind: "kept-all" }
  | { kind: "cut"; labels: readonly string[] }
  | { kind: "cut-all" }
  | { kind: "fail-open"; reason: string }
  | { kind: "error"; reason: string };

export interface PickLogInput {
  candidateCount: number;
  keptCount: number;
  ms: number;
  outcome: PickOutcome;
}

function trimLabel(label: string): string {
  const clean = label.trim().replace(/\s+/g, " ");
  return clean.length > MAX_LABEL_CHARS
    ? `${clean.slice(0, MAX_LABEL_CHARS - 1)}…`
    : clean;
}

/** `"a", "b" (+3 more)` — capped so a long pool never floods the terminal. */
export function describeLabels(labels: readonly string[]): string {
  const shown = labels.slice(0, MAX_LABELS).map((l) => `"${trimLabel(l)}"`);
  const rest = labels.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} (+${rest} more)` : shown.join(", ");
}

export function pickLogLine(input: PickLogInput): string {
  const counts =
    `${input.candidateCount} candidates → kept ${input.keptCount}, ` +
    `cut ${input.candidateCount - input.keptCount} (${input.ms}ms)`;
  switch (input.outcome.kind) {
    case "cut":
      return `[titles/pick] ${counts} — cut ${describeLabels(
        input.outcome.labels,
      )}`;
    case "cut-all":
      return `[titles/pick] ${counts} — model cut every candidate (valid empty kept list)`;
    case "fail-open":
      return `[titles/pick] ${counts} — FAIL-OPEN, nothing cut: ${input.outcome.reason}`;
    case "error":
      return `[titles/pick] ${counts} — ERROR 500: ${input.outcome.reason}`;
    default:
      return `[titles/pick] ${counts} — model kept every candidate (no cuts)`;
  }
}
