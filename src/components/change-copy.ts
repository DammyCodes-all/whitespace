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
  coverage: "The rewrite speaks to fewer of your words.",
  grounding: "New words weren't found in Qloo.",
  control: "The rewrite lost its lead over unrelated audiences.",
};

export function changeReason(failed: FailedCondition): string {
  return REASONS[failed];
}

export const REAL_PEOPLE_LINE = "Check with real people before spending more.";
