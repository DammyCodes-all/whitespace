/**
 * Day 8 Q: demo fixture pack. Owned by Q.
 *
 * Four full `PipelineInput`s, each tuned for a different run outcome
 * (Strong, Split, Weak, withheld-change). S and U consume these for the
 * change check and the trust-moment demo (§9). The `intended` note on
 * each entry is a claim about behavior: if the pipeline disagrees, the
 * fixture or the code is wrong — never silently retune numbers green.
 *
 * The withheld-change entry assumes S's provisional `minRise` ≈ 0.05
 * (margins deliberately tight). Confirm with the S owner; if the bar
 * moves, this entry moves with it.
 *
 * Plain data only: must stay runnable under `node --test` type
 * stripping (relative `.ts` imports, no enums, no namespaces).
 */

import type { PipelineInput } from "../pipeline/run.ts";
import type { RivalProposal } from "../qloo/rivals.ts";

export interface PitchPackEntry {
  name: string;
  /** Intended verdict path, and why this pitch should take it. */
  intended: string;
  input: PipelineInput;
}

function rivals(...proposals: RivalProposal[]): RivalProposal[] {
  return proposals;
}

const strongFilm: PitchPackEntry = {
  name: "strong-film",
  intended:
    "Strong fit with a surprise headline: slow-burn space tags match " +
    "the hypothesis audience best and clear control by a wide margin.",
  input: {
    pitchText:
      "A slow, practical-effects space epic about the generation ship " +
      "that stopped answering.",
    workType: "film",
    nothingLike: ["Fast franchise action"],
    similarTitles: ["2001: A Space Odyssey", "Interstellar", "Arrival"],
    candidateWords: [
      "slow-burn",
      "space",
      "monumental",
      "practical",
      "cerebral",
      "quiet",
    ],
    pinnedWords: ["slow-burn"],
    rivalProposals: rivals(
      {
        id: "rival-literary",
        name: "Literary fiction about isolation",
        reason: "Reads the silence as solitude, not spectacle.",
        titles: ["Solaris", "The Left Hand of Darkness"],
      },
      {
        id: "rival-ambient",
        name: "Ambient music listeners",
        reason: "Reads the quiet as the point, not the setting.",
        titles: ["Tangerine Dream", "Vangelis"],
      },
    ),
  },
};

const splitBook: PitchPackEntry = {
  name: "split-book",
  intended:
    "Split verdict: cozy low-stakes tags match two rival readings " +
    "neck-and-neck, both clearing control.",
  input: {
    pitchText:
      "A cozy fantasy novel about a bakery at the edge of a dragon reserve.",
    workType: "book",
    nothingLike: ["Grimdark epics"],
    similarTitles: [
      "Legends & Lattes",
      "The House in the Cerulean Sea",
      "Before the Coffee Gets Cold",
    ],
    candidateWords: [
      "cozy",
      "found-family",
      "gentle",
      "low-stakes",
      "warm",
      "healing",
    ],
    rivalProposals: rivals(
      {
        id: "rival-romance",
        name: "Cozy romance readers",
        reason: "Reads the warmth as the love story.",
        titles: ["Beach Read", "The Very Secret Society"],
      },
      {
        id: "rival-slice",
        name: "Slice-of-life anime fans",
        reason: "Reads the low stakes as iyashikei comfort.",
        titles: ["Mushishi", "Natsume's Book of Friends"],
      },
    ),
  },
};

const weakGame: PitchPackEntry = {
  name: "weak-game",
  intended:
    "Weak or Inconclusive: invented words match no Qloo tags and the " +
    "titles barely resolve, exercising every no-data path honestly.",
  input: {
    pitchText:
      "An avant-garde puzzle game about zorp navigation in the blorpt.",
    workType: "game",
    nothingLike: ["Mainstream shooters"],
    similarTitles: ["Obscure Jam Entry 2019", "Unreleased Prototype X"],
    candidateWords: [
      "zorp",
      "blorpt",
      "flarn",
      "glimmerdark",
      "unfungible",
      "liminal",
    ],
    rivalProposals: rivals(
      {
        id: "rival-odd",
        name: "Alternative puzzle fans",
        reason: "Reads the strangeness as the selling point.",
        titles: ["Antichamber", "Stephen's Sausage Roll"],
      },
      {
        id: "rival-art",
        name: "Art-game collectors",
        reason: "Reads the concept as gallery work.",
        titles: ["Mountain", "Everything"],
      },
    ),
  },
};

const withheldFilm: PitchPackEntry = {
  name: "withheld-film",
  intended:
    "Withheld change: mainstream prestige tags score close together " +
    "with a thin margin, so a constrained rewrite cannot clear a " +
    "minRise ≈ 0.05 bar and the change is withheld with its reason.",
  input: {
    pitchText:
      "A stately wartime biopic about the speechwriter behind the address.",
    workType: "film",
    nothingLike: ["Superhero crossovers"],
    similarTitles: ["The King's Speech", "Darkest Hour", "Dunkirk"],
    candidateWords: [
      "stately",
      "wartime",
      "biopic",
      "period",
      "restrained",
      "solemn",
    ],
    rivalProposals: rivals(
      {
        id: "rival-prestige",
        name: "Prestige television watchers",
        reason: "Reads the period craft as streaming drama.",
        titles: ["The Crown", "Chernobyl"],
      },
      {
        id: "rival-history",
        name: "History podcast listeners",
        reason: "Reads the research as the draw.",
        titles: ["Hardcore History", "Revolutions"],
      },
    ),
  },
};

export const PITCH_PACK: PitchPackEntry[] = [
  strongFilm,
  splitBook,
  weakGame,
  withheldFilm,
];
