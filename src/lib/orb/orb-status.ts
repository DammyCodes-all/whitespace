/**
 * One true line under the orb per leg. Each message names only the call
 * actually in flight (or the action actually needed) — never invented
 * progress, never guessed counts. Counts arrive from the caller, which
 * read them off the response it just received.
 *
 * Spec ref: §5 (the run reports itself as it goes).
 */

export type OrbLeg = "entry" | "tags" | "titles" | "aggregate" | "run" | "done";

/** Shown while the leg's request is in flight. */
export function legWorkingMessage(leg: OrbLeg, detail = ""): string {
  switch (leg) {
    case "entry":
      return "Reading your pitch's tags…";
    case "tags":
      return "Reading your pitch's tags…";
    case "titles":
      return detail === ""
        ? "Checking titles in Qloo…"
        : `Checking ${detail} in Qloo…`;
    case "aggregate":
      return "Gathering the tags…";
    case "run":
      return "Scoring your idea against audiences…";
    case "done":
      return "Measured — your verdict is below.";
  }
}

/** The Check's chained tail (gifts' tags, fit-pick, suggestions) runs
 *  inside the check's own orb cycle (spec §6.1): the orb names the
 *  family until the whole tail lands. Same words as the section busy
 *  line — one process, one vocabulary. */
export const CHECK_TAIL_LINE = "Reading the titles' tags…";

/** The between-leg beat: the old section is gone and the next one is
 *  being set up. Shown while the orb glides down and back with no
 *  cycle running — the orb holds its thinking pose through it. */
export const SETUP_LINE = "One moment. Setting up the next step.";

/** Shown when the leg needs the human. Pure instruction, no numbers.
 *  Empty means the page already says it — no line renders. */
export function legPrompt(leg: OrbLeg): string {
  switch (leg) {
    case "entry":
      return "";
    case "tags":
      return "These are the tags your pitch earned. Untick what isn't you.";
    case "titles":
      return "Name work yours feels close to — Check verifies each in Qloo.";
    case "aggregate":
      return "The full scoring set: your words plus the titles' gifts. Review, then continue.";
    case "run":
      return "Scoring your idea against audiences…";
    case "done":
      return "Measured — your verdict is below.";
  }
}

/** Receipt line from measured counts. Counts in, words out. */
export function receiptLine(
  kind: "tags" | "titles",
  found: number,
  missing = 0,
): string {
  if (kind === "tags") return `${found} tags read.`;
  return `${found} found in Qloo, ${missing} missing.`;
}

/** Run receipt carries the verdict word the run itself returned. */
export function runReceipt(verdict: string): string {
  return `${verdict} — measured, not guessed.`;
}
