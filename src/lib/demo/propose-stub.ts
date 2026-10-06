import type { ProposeFn } from "../pipeline/change.ts";
import type { GapItem } from "../scoring/gaps.ts";

/**
 * Day 8 deterministic proposal stub. Owned by U (demo flow).
 *
 * Appends the used gap labels as a plain sentence under the constraint.
 * Crude but fully grounded: every word it adds resolves by construction,
 * so the bar judges the idea, not the wording. Marked upgradeable: swap
 * for the LLM rewrite with no change to callers (`ProposeFn` seam).
 */
export const proposeDeterministic: ProposeFn = async (
  constraint: string,
  gaps: GapItem[],
) => {
  const labels = gaps.map((g) => g.label).join(", ");
  if (labels === "") return `Within ${constraint}.`;
  return `Within ${constraint}: ${labels}.`;
};
