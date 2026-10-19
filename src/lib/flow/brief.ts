/**
 * The targeting brief: one-page markdown you can paste anywhere.
 *
 * Lives in `src/lib/flow` as plain TS (precedent: `../change-copy.ts`)
 * so both halves can import it without cycles: the Server Component
 * `flow-result-view.tsx` shares the verdict words and reach labels
 * with the UI, and the client clipboard island shares the builder.
 * Keeping the builder out of `.tsx` also means it runs under
 * `node --test` type stripping.
 */

import type { FlowBarRow, FlowResult } from "./contract.ts";
import { barRows, isCloseCall } from "./contract.ts";

export const VERDICT_WORDS: Record<FlowResult["verdict"], string> = {
  strong: "Strong fit",
  mixed: "Mixed fit",
  weak: "Weak fit",
  inconclusive: "Inconclusive",
};

export const REACH_SLOTS: Array<{
  slot: "interests" | "people" | "podcasts" | "brands" | "places";
  label: string;
}> = [
  { slot: "interests", label: "Interests" },
  { slot: "people", label: "People" },
  { slot: "podcasts", label: "Podcasts" },
  { slot: "brands", label: "Brands" },
  { slot: "places", label: "Places" },
];

/** Footer every exported brief carries, so a paste never loses it. */
export const BRIEF_FOOTER =
  "Built from group-level taste data. Does not predict outcomes.";

/**
 * Renders the run as markdown. A not-measured slot is written as
 * "not measured" and a missing ceiling as the same words — the brief
 * must never turn an unknown into a 0, in the file or in a paste.
 */
export function buildTargetingBrief(result: FlowResult): string {
  const rows: FlowBarRow[] = barRows(result);
  return [
    `# Targeting brief — ${VERDICT_WORDS[result.verdict]}`,
    "",
    `Pitch: ${result.pitch}`,
    `Type: ${result.type}`,
    "",
    "## Scores",
    ...rows.map(
      (r) =>
        `- ${r.name} (${r.role}): ${r.score.toFixed(2)}${
          r.evidenceId ? ` [evidence: ${r.evidenceId}]` : ""
        }`,
    ),
    "",
    `Strongest other-genre comparison: ${
      result.ceiling === null ? "not measured" : result.ceiling.toFixed(2)
    }`,
    ...(result.controlTest === null || result.controlTest.total === 0
      ? []
      : [
          `Beat ${result.controlTest.beaten} of ${result.controlTest.total} measured comparison audiences`,
        ]),
    ...(result.selfFit === "leans"
      ? [
          "Self-fit: unconfirmed — the lead needs the tags from the titles named",
        ]
      : result.selfFit === "confirmed"
        ? ["Self-fit: confirmed — the lead holds without the titles' own tags"]
        : []),
    ...(isCloseCall(result)
      ? [
          "Close call: near the other-genre line — a re-run may read differently.",
        ]
      : []),
    `Qloo data calls: ${result.qlooCalls.network} live, ${result.qlooCalls.cached} from cache`,
    "",
    "## Where to find them",
    ...(result.reach === null
      ? ["None: nothing beat the comparison line."]
      : result.reach.flatMap((g) => [
          `### ${g.audienceName}`,
          ...REACH_SLOTS.flatMap(({ slot, label }) => [
            `${label}: ${
              g[slot].length === 0
                ? "not measured"
                : g[slot].map((i) => `${i.name} (#${i.rank})`).join(", ")
            }`,
          ]),
        ])),
    "",
    BRIEF_FOOTER,
  ].join("\n");
}
