import type { FailedCondition } from "../lib/policy/change.ts";

/**
 * Day 8 U: change-outcome copy. Owned by U.
 *
 * Plain strings in a `.ts` module (precedent: `pitch-form-utils.ts`)
 * so the reason map stays unit-testable — `.tsx` cannot run under
 * `node --test` type stripping. Product voice: confirm replacements
 * with the team before shipping edits.
 */

const REASONS: Record<FailedCondition, string> = {
  rise: "The rewrite didn't clear the improvement bar.",
  separation:
    "The rewrite lifted the field more than the winner, so the fit didn't stand out more.",
  coverage: "The rewrite speaks to fewer of your words.",
  grounding: "New words weren't found in Qloo.",
  control: "The rewrite lost its lead over other-genre groups.",
};

export function changeReason(failed: FailedCondition): string {
  return REASONS[failed];
}

/** Single rounding point for change copy: 0–1 score in, whole percent out. */
export function changePct(score: number): number {
  return Math.round(score * 100);
}

export const ACCEPTED_TITLE = "The rewrite fits better.";

export const WITHHELD_FALLBACK = "The rewrite didn't hold its lead.";

/** "Was 61%, now 72%." States both scores outright, never the gap. */
export function changeScoreLine(before: number, after: number): string {
  return `Was ${changePct(before)}%, now ${changePct(after)}%.`;
}

/** "Addresses: solitude." Null when no gap labels survive trimming. */
export function gapLine(labels: string[]): string | null {
  const clean = labels.map((l) => l.trim()).filter((l) => l !== "");
  if (clean.length === 0) return null;
  return `Addresses: ${clean.join(", ")}`;
}

export const REAL_PEOPLE_LINE = "Check with real people before spending more.";
