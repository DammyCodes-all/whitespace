/**
 * Day 3 audience tastes. Owned by Q.
 *
 * Parses Qloo-shaped taste envelopes into the normalized AudienceTastes
 * handoff that scoring consumes. Fixtures stand in for the live
 * Insights call (no key yet); Day 6 swaps fetchAudienceTastes internals
 * to the live endpoint without changing this return shape.
 *
 * Day 6 note: the live version will accept resolved Qloo tag URNs to
 * query with. The `tagQueries` parameter name marks that coming change;
 * do not treat this signature as final.
 */

import { TASTE_FIXTURES } from "../fixtures/taste-lists.ts";

export interface RankedTaste {
  tag: string;
  /** 1-based position, 1 = strongest. */
  rank: number;
  entityId: string;
}

export interface AudienceTastes {
  audienceId: string;
  tastes: RankedTaste[];
  /** Length of the underlying Qloo list, before any truncation. */
  totalReturned: number;
  /** True when Qloo cut a longer list short: missing tags are no-data. */
  truncated: boolean;
  /** §6.12 trace ref for the call this list came from. */
  callId: string;
}

/**
 * Envelope in, normalized handoff out. Sorts by affinity descending so
 * rank reflects strength even if a source arrives unsorted.
 */
export function parseTastesEnvelope(
  audienceId: string,
  envelope: {
    success: boolean;
    results: {
      entities: {
        entity_id: string;
        affinity: number;
        tag_name: string;
      }[];
    };
    truncated: boolean;
  },
  callId: string,
): AudienceTastes {
  const sorted = [...envelope.results.entities].sort(
    (a, b) => b.affinity - a.affinity,
  );
  return {
    audienceId,
    tastes: sorted.map((e, i) => ({
      tag: e.tag_name,
      rank: i + 1,
      entityId: e.entity_id,
    })),
    totalReturned: envelope.results.entities.length,
    truncated: envelope.truncated,
    callId,
  };
}

/**
 * Fixture-backed fetch. Throws on unknown audience ids so a fixture
 * miss fails loudly instead of scoring an empty list as a low score.
 */
export async function fetchAudienceTastes(
  audienceId: string,
  tagQueries: string[] = [],
): Promise<AudienceTastes> {
  void tagQueries;
  const envelope = TASTE_FIXTURES[audienceId];
  if (!envelope) {
    throw new Error(`No taste fixture for audience "${audienceId}".`);
  }
  return parseTastesEnvelope(
    audienceId,
    envelope,
    `fixture-tastes-${audienceId}`,
  );
}
