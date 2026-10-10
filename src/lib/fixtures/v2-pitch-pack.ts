/**
 * V2 human pitch pack (§7 evaluation). Owned by all, within owned files.
 *
 * Every pitch below is invented for review. Nothing here is Qloo
 * output; shapes mirror `V2Input` so the /tmp runner can POST each
 * entry to a local `/api/analyze` and record aggregates for the
 * human reviewer. The review itself (bridge fidelity, hypothesis
 * usefulness) is a human judgment — see `docs/v2-eval.md`.
 */

export interface V2PitchPackEntry {
  id: string;
  pitchText: string;
  workType: "film" | "music" | "book" | "game";
  comparisons?: string[];
  contrasts?: string[];
  /** What the reviewer should check for this entry. */
  reviewFocus: string;
}

export const V2_PITCH_PACK: V2PitchPackEntry[] = [
  {
    id: "familiar-genre",
    pitchText:
      "A quiet science-fiction film about a lonely worker on a space station.",
    workType: "film",
    reviewFocus:
      "Baseline: interpretation exactness, reference identity (Moon- or 2001-style analogies), exploration usefulness.",
  },
  {
    id: "mixed-genre",
    pitchText:
      "A heist movie set on a generation ship, tense and funny in equal measure, about the crew who maintain the engines.",
    workType: "film",
    reviewFocus:
      "Distinct aspects (premise vs tone vs form) stay separate; no collapse into one genre lens.",
  },
  {
    id: "tone-led",
    pitchText:
      "A slow, hushed drama about two estranged sisters cleaning out their childhood home. Nothing happens quickly.",
    workType: "film",
    reviewFocus:
      "Tone-led pitch with no franchise anchors: does interpretation survive without famous-plot hooks?",
  },
  {
    id: "explicit-negation",
    pitchText:
      "A cozy farming game about restoring a lighthouse garden. Nothing like a shooter, no combat at all, no timers pressuring the player.",
    workType: "game",
    contrasts: ["Call of Duty"],
    reviewFocus:
      "Negation preserved as contrast, never subtracted from taste evidence; no combat-flavored references.",
  },
  {
    id: "unusual-format",
    pitchText:
      "A horror story told entirely through fictional restaurant health-inspection reports, published one page a week.",
    workType: "book",
    reviewFocus:
      "Form aspect present; unrepresentable notes for what has no Qloo equivalent rather than invented analogies.",
  },
  {
    id: "vague-idea",
    pitchText: "A story about people and feelings, kind of sad but hopeful.",
    workType: "book",
    reviewFocus:
      "Vague input: needs-clarification or honest exploration, never a padded brief with unstated genre.",
  },
  {
    id: "nonsense",
    pitchText: "Blorpt fnord zzzxq nine purple sideways the and.",
    workType: "film",
    reviewFocus:
      "Nonsense: zero aspects + unrepresentable note, or unable-to-assess. Must not become a plausible brief.",
  },
  {
    id: "misleading-comparison",
    pitchText: "A quiet chamber drama about a violinist losing her hearing.",
    workType: "film",
    comparisons: ["Fast & Furious"],
    reviewFocus:
      "Misleading comparison stays overlay-only: shown under creator context, never corroboration, never the winner.",
  },
  {
    id: "reference-ambiguity",
    pitchText: "A desert epic about a young leader uniting scattered tribes.",
    workType: "film",
    comparisons: ["Dune"],
    reviewFocus:
      "Known ambiguity probe (two famous Dunes): identity must read ambiguous and hold discovery, pending a creator pick.",
  },
];
