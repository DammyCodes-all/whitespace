/**
 * Worked examples for the entry box. One click hands the run a pitch
 * plus the comparable titles it was tested with, so a judge never has
 * to invent either. Both cases come from the 6-pitch hunt in
 * `docs/qloo-coverage.md`:
 *
 * - cyberpunk: the Strong case (named audience cleared the strangers
 *   baseline by 11 points in the hand-tagged hunt, and again live).
 * - mystery-noir: one of the three pitches whose tag-seeded rival
 *   discovery answered with nothing, so the run takes the §6.3
 *   re-plan and asks the graph again from the titles.
 *
 * The examples spend the same live calls as any run; nothing here is a
 * fixture and nothing bypasses the tag, Check or verdict steps.
 *
 * Spec ref: §5 (entry), §6.3 (re-plan), §9 (demo plan).
 */

export type WorkedExampleId = "cyberpunk-strong" | "mystery-replan";

export interface WorkedExample {
  id: WorkedExampleId;
  /** What the example is there to show, in two or three words. */
  outcome: string;
  /** Short name shown on the button. */
  label: string;
  /** The pitch handed to the run. */
  pitch: string;
  /** Comparable titles handed to the titles leg. */
  similarTitles: readonly string[];
}

export const EXAMPLE_PITCHES: readonly WorkedExample[] = [
  {
    id: "cyberpunk-strong",
    outcome: "Known Strong result",
    label: "Cyberpunk noir",
    pitch:
      "In a rain-soaked neon megacity, a burned-out android detective takes one last case with a rogue hacker: a missing girl whose memories may hold the key to a corporate conspiracy. A slow, atmospheric cyberpunk noir set in a dystopia where body modification is ordinary and the city owns your memories. It is about class, identity, and what is left of being human.",
    similarTitles: ["Blade Runner 2049", "The Matrix", "Ghost in the Shell"],
  },
  {
    id: "mystery-replan",
    outcome: "Triggers the re-plan",
    label: "Mystery noir",
    pitch:
      "Los Angeles, 1947. A weary private detective is hired to find a missing heiress, and every lead pulls him deeper into a city of blackmail, corrupt cops, and old money. A slow-burn mystery noir about secrets, murder, and the lies people tell to stay respectable. Shadows, rain, and a case that keeps folding back on itself.",
    similarTitles: ["Se7en", "Gone Girl", "Knives Out"],
  },
];

/** Look up a worked example by id; the static list is test-guarded. */
export function exampleById(id: WorkedExampleId): WorkedExample {
  const example = EXAMPLE_PITCHES.find((e) => e.id === id);
  if (example === undefined) {
    throw new Error(`Unknown worked example: ${id}`);
  }
  return example;
}

/** Build the run URL that carries both the pitch and its comps. */
export function exampleRunHref(target: string, example: WorkedExample): string {
  const params = new URLSearchParams({
    pitch: example.pitch.trim(),
    titles: example.similarTitles.join(", "),
  });
  return `${target}?${params.toString()}`;
}
