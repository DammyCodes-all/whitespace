/**
 * Worked examples for the entry box. One click hands the run a pitch
 * plus the comparable titles it was tested with, so a judge never has
 * to invent either.
 *
 * - extraction-demo: the live-tested demo case. A grounded, Asia-set
 *   action pitch with its A comps (the creative-lineage set).
 * - mystery-noir: one of the three pitches whose tag-seeded rival
 *   discovery answered with nothing, so the run takes the §6.3
 *   re-plan and asks the graph again from the titles.
 *
 * The examples spend the same live calls as any run; nothing here is a
 * fixture and nothing bypasses the tag, Check or verdict steps.
 *
 * Spec ref: §5 (entry), §6.3 (re-plan), §9 (demo plan).
 */

export type WorkedExampleId = "extraction-demo" | "mystery-replan";

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
    id: "extraction-demo",
    outcome: "Live-tested action case",
    label: "Grounded action",
    pitch:
      "A hardened black-market mercenary is hired to rescue the kidnapped son of an imprisoned Indian crime lord. The job goes wrong in Dhaka, Bangladesh, and he finds himself trapped in a city locked down by rival gangs, corrupt police, and a boy who reminds him of the life he lost. To get them both out, he has to fight through a gauntlet of close-quarters ambushes, car chases, and bridge battles — and decide whether this is just another payday or the first thing he has cared about in years. A grounded, R-rated action thriller with brutal hand-to-hand combat, a world-weary hero, and a reluctant father-son bond. The tone is hard, fast, and physical; the setting is South Asia, not a soundstage. Think a one-man rescue mission with the texture of a war film.",
    similarTitles: ["The Raid: Redemption", "Man on Fire", "Sicario"],
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
