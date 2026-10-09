/**
 * Day 6.5 U: default proposals for the pitch form. Owned by U.
 *
 * Mirrors `demoPipelineInput` in S-owned `src/lib/pipeline/run.ts` (update
 * together): the client form cannot import the pipeline module without
 * pulling the server Qloo/scoring graph into the browser bundle, so the
 * fixture-backed defaults live here instead.
 */

import type { ProposeRival } from "@/lib/agent/propose";

/** Demo descriptive words (§6.5) until "Suggest with AI" replaces them.
 * Genre-led so the §6.6 mean can separate; every word resolves live. */
export const DEFAULT_CANDIDATE_WORDS: string[] = [
  "science-fiction",
  "space",
  "drama",
  "future",
];

/** Demo rival readings (§6.3) until "Suggest with AI" replaces them. */
export const DEFAULT_RIVAL_PROPOSALS: ProposeRival[] = [
  {
    id: "rival-lit",
    name: "Literary fiction about isolation",
    reason: "Reads the station as solitude, not spectacle.",
    titles: [
      "Never Let Me Go",
      "Klara and the Sun",
      "Station Eleven",
      "Remains of the Day",
    ],
  },
  {
    id: "rival-amb",
    name: "Ambient music listeners",
    reason: "Reads the quiet as the point, not the setting.",
    titles: ["Brian Eno", "Stars of the Lid", "Tim Hecker"],
  },
];
