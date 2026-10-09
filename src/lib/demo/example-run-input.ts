/**
 * Client-safe demo input for "try an example". Owned by U.
 *
 * Mirrors `demoPipelineInput` in S-owned `src/lib/pipeline/run.ts`, but
 * keeps the browser bundle free of Qloo/scoring imports. The example is a
 * full run input: pitch plus similar-to and nothing-like already filled.
 */

import type { PipelineInput } from "@/lib/pipeline/run";

export const EXAMPLE_RUN_INPUT: PipelineInput = {
  pitchText:
    "A quiet science-fiction film about a lonely worker on a space station.",
  workType: "film",
  nothingLike: ["Fast franchise action"],
  similarTitles: ["Moon", "Arrival", "Dune"],
  candidateWords: ["science-fiction", "space", "drama", "future"],
  rivalProposals: [
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
  ],
};
