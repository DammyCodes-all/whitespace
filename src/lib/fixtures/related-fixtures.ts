/**
 * Day 7 related-items fixtures. Owned by Q.
 *
 * Hand-written envelopes shaped like Qloo Insights responses (ranked
 * entities with affinity order). No live key exists yet; `related.ts`
 * parses these in tests, Day 6-style live swap changes the fetch, not
 * the parser.
 *
 * Collisions are deliberate: the podcast envelope holds an entity id
 * and a name that match taste-fixture audience titles, so the dedupe
 * tests have real targets. One nameless entity exercises the skip.
 *
 * Plain data only: must stay runnable under `node --test` type
 * stripping (no enums, no namespaces).
 */

export interface FixtureRelatedEntity {
  entity_id: string;
  name: string;
  affinity: number;
}

export interface FixtureRelatedEnvelope {
  success: boolean;
  results: {
    entities: FixtureRelatedEntity[];
  };
}

function entity(
  entity_id: string,
  name: string,
  affinity: number,
): FixtureRelatedEntity {
  return { entity_id, name, affinity };
}

const podcast: FixtureRelatedEnvelope = {
  success: true,
  results: {
    entities: [
      entity("p01", "Deep Dive Podcast", 0.97),
      entity("p02", "Slow Burn Audio", 0.93),
      entity("moon-id", "Moon", 0.91),
      entity("p04", "ARRIVAL", 0.88),
      entity("p05", "Quiet Minds", 0.85),
      entity("p06", "", 0.82),
      entity("p07", "Static Bloom", 0.79),
    ],
  },
};

const person: FixtureRelatedEnvelope = {
  success: true,
  results: {
    entities: [
      entity("pe01", "Mara Voss", 0.96),
      entity("pe02", "Jonas Feld", 0.94),
      entity("pe03", "Ayo Balogun", 0.92),
      entity("pe04", "Suki Tanaka", 0.9),
      entity("pe05", "Tomas Reyes", 0.88),
      entity("pe06", "Ingrid Sol", 0.86),
      entity("pe07", "Rafi Anand", 0.84),
      entity("pe08", "Cleo Marsh", 0.82),
    ],
  },
};

const brand: FixtureRelatedEnvelope = {
  success: true,
  results: {
    entities: [
      entity("b01", "Field Notes", 0.95),
      entity("b02", "Teenage Engineering", 0.93),
      entity("b03", "Aesop", 0.9),
      entity("b04", "Muji", 0.87),
      entity("b05", "Leica", 0.84),
    ],
  },
};

const place: FixtureRelatedEnvelope = {
  success: true,
  results: {
    entities: [
      entity("pl01", "Reykjavik", 0.94),
      entity("pl02", "Marfa", 0.92),
      entity("pl03", "Lisbon", 0.9),
      entity("pl04", "Kyoto", 0.88),
      entity("pl05", "Faroe Islands", 0.86),
    ],
  },
};

export const RELATED_FIXTURES: Record<string, FixtureRelatedEnvelope> = {
  podcast,
  person,
  brand,
  place,
};
