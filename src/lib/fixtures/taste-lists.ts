/**
 * Day 3 taste fixtures. Owned by Q.
 *
 * Hand-written envelopes shaped like Qloo Insights responses (ranked
 * entities with affinity order, Qloo-style tag URNs). No live key exists
 * yet, so tastes.ts parses these; Day 6 swaps the fetch, not the parser.
 *
 * The set deliberately covers both §6.6 paths: one full list (missing =
 * zero) and two short lists (missing = no-data), plus one truncated
 * list flag exercised in tests.
 *
 * Keys of TASTE_FIXTURES must match audience ids in
 * src/lib/demo/mock-run.ts; fetchAudienceTastes throws loudly on a miss.
 *
 * Plain objects and interfaces only: this file must stay runnable under
 * `node --test` type stripping (no enums, no namespaces).
 */

export interface FixtureTasteEntity {
  entity_id: string;
  name: string;
  affinity: number;
  tag_id: string;
  tag_name: string;
}

export interface FixtureTastesEnvelope {
  success: boolean;
  results: {
    entities: FixtureTasteEntity[];
  };
  truncated: boolean;
}

function entity(
  entity_id: string,
  name: string,
  affinity: number,
  tag_id: string,
  tag_name: string,
): FixtureTasteEntity {
  return { entity_id, name, affinity, tag_id, tag_name };
}

/** Slow science-fiction: full list of 20, missing solitude and quiet. */
const hyp: FixtureTastesEnvelope = {
  success: true,
  truncated: false,
  results: {
    entities: [
      entity("e01", "Moon", 0.99, "urn:tag:mood:media:bleak", "bleak"),
      entity(
        "e02",
        "Slow Burn",
        0.97,
        "urn:tag:mood:media:slow_burn",
        "slow-burn",
      ),
      entity("e03", "Arrival", 0.95, "urn:tag:mood:media:cerebral", "cerebral"),
      entity(
        "e04",
        "Stalker",
        0.93,
        "urn:tag:mood:media:meditative",
        "meditative",
      ),
      entity("e05", "Gravity", 0.91, "urn:tag:setting:media:space", "space"),
      entity(
        "e06",
        "Ad Astra",
        0.89,
        "urn:tag:mood:media:melancholy",
        "melancholy",
      ),
      entity(
        "e07",
        "Solaris",
        0.87,
        "urn:tag:mood:media:dreamlike",
        "dreamlike",
      ),
      entity(
        "e08",
        "Interstellar",
        0.85,
        "urn:tag:theme:media:sacrifice",
        "sacrifice",
      ),
      entity("e09", "Blade Runner", 0.83, "urn:tag:mood:media:noir", "noir"),
      entity(
        "e10",
        "2001",
        0.81,
        "urn:tag:mood:media:monumental",
        "monumental",
      ),
      entity("e11", "Dune", 0.79, "urn:tag:setting:media:desert", "desert"),
      entity("e12", "Contact", 0.77, "urn:tag:theme:media:faith", "faith"),
      entity(
        "e13",
        "Ex Machina",
        0.75,
        "urn:tag:theme:media:consciousness",
        "consciousness",
      ),
      entity("e14", "Her", 0.73, "urn:tag:mood:media:tender", "tender"),
      entity(
        "e15",
        "Annihilation",
        0.71,
        "urn:tag:mood:media:uncanny",
        "uncanny",
      ),
      entity(
        "e16",
        "Under the Skin",
        0.69,
        "urn:tag:mood:media:alien",
        "alien",
      ),
      entity(
        "e17",
        "Prospect",
        0.67,
        "urn:tag:setting:media:frontier",
        "frontier",
      ),
      entity("e18", "High Life", 0.65, "urn:tag:mood:media:ascetic", "ascetic"),
      entity(
        "e19",
        "Coherence",
        0.63,
        "urn:tag:mood:media:paranoid",
        "paranoid",
      ),
      entity("e20", "Primer", 0.61, "urn:tag:mood:media:puzzling", "puzzling"),
    ],
  },
};

/** Literary fiction about isolation: short list of 8. */
const rivalLit: FixtureTastesEnvelope = {
  success: true,
  truncated: false,
  results: {
    entities: [
      entity(
        "l01",
        "Never Let Me Go",
        0.98,
        "urn:tag:theme:media:solitude",
        "solitude",
      ),
      entity("l02", "Klara", 0.94, "urn:tag:mood:media:gentle", "gentle"),
      entity(
        "l03",
        "Remains",
        0.9,
        "urn:tag:mood:media:restrained",
        "restrained",
      ),
      entity(
        "l04",
        "Station Eleven",
        0.88,
        "urn:tag:mood:media:slow_burn",
        "slow-burn",
      ),
      entity("l05", "Gilead", 0.84, "urn:tag:mood:media:quiet", "quiet"),
      entity("l06", "Beloved", 0.8, "urn:tag:theme:media:grief", "grief"),
      entity("l07", "Lincoln", 0.76, "urn:tag:mood:media:mournful", "mournful"),
      entity(
        "l08",
        "Austerlitz",
        0.72,
        "urn:tag:mood:media:archival",
        "archival",
      ),
    ],
  },
};

/** Ambient music listeners: short list of 6. */
const rivalAmb: FixtureTastesEnvelope = {
  success: true,
  truncated: false,
  results: {
    entities: [
      entity("a01", "Brian Eno", 0.97, "urn:tag:mood:media:ambient", "ambient"),
      entity(
        "a02",
        "Stars of the Lid",
        0.95,
        "urn:tag:mood:media:quiet",
        "quiet",
      ),
      entity(
        "a03",
        "Tim Hecker",
        0.91,
        "urn:tag:mood:media:textural",
        "textural",
      ),
      entity(
        "a04",
        "Aphex Twin",
        0.87,
        "urn:tag:mood:media:glacial",
        "glacial",
      ),
      entity(
        "a05",
        "Nils Frahm",
        0.83,
        "urn:tag:mood:media:pensive",
        "pensive",
      ),
      entity(
        "a06",
        "Hammock",
        0.79,
        "urn:tag:mood:media:expansive",
        "expansive",
      ),
    ],
  },
};

export const TASTE_FIXTURES: Record<string, FixtureTastesEnvelope> = {
  hyp,
  "rival-lit": rivalLit,
  "rival-amb": rivalAmb,
};
