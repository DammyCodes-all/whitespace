/**
 * V2 SYNTHETIC fixtures (lean MVP). Owned by Q.
 *
 * Every value below is invented for tests. Nothing here is copied
 * from a Qloo response; shapes only mirror the documented fields
 * (`entity_id`, name, type, tags). The pilot-shaped fixture
 * (zero shared cores) reflects the live aggregate finding that
 * distinct lenses share no top-20 entities — it is still synthetic.
 */

import type {
  V2LensRetrieval,
  V2ReferenceLens,
  V2ReturnedEntity,
} from "../pipeline/v2/types.ts";

function entity(
  id: string,
  name: string,
  type: string,
  position: number,
  tags: string[] = [],
): V2ReturnedEntity {
  return { id, name, type, position, tags };
}

function lens(
  aspectId: string,
  entityId: string | null,
  entityName: string | null,
  bridge: V2ReferenceLens["bridge"] = "returned-metadata",
  identity: V2ReferenceLens["identity"] = "resolved",
): V2ReferenceLens {
  return {
    aspectId,
    candidates: [
      {
        name: entityName ?? "?",
        entityType: "urn:entity:movie",
        analogy: "synthetic analogy",
      },
    ],
    selectedName: entityName ?? "unknown",
    entityId,
    entityName,
    entityType: "urn:entity:movie",
    identity,
    bridge,
    analogy: "synthetic analogy",
    role: "discovery",
  };
}

/** Two eligible lenses whose retrievals share two cores + one tag. */
export const SYNTH_SHARED = {
  lenses: [
    lens("a-premise", "E1", "Synth Film One"),
    lens("a-tone", "E2", "Synth Film Two"),
  ],
  retrievals: [
    {
      aspectId: "a-premise",
      category: "urn:entity:movie",
      status: "ok",
      entities: [
        entity("C1", "Shared Core Alpha", "urn:entity:movie", 1, [
          "urn:tag:genre:media:slow_burn",
          "urn:entity:movie",
        ]),
        entity("C2", "Shared Core Beta", "urn:entity:movie", 2, [
          "urn:tag:genre:media:slow_burn",
        ]),
        entity("P1", "Premise Only", "urn:entity:movie", 3, [
          "urn:tag:genre:media:space",
        ]),
      ],
      queryProvenance: "synthetic:premise→movie",
    },
    {
      aspectId: "a-tone",
      category: "urn:entity:movie",
      status: "ok",
      entities: [
        entity("C1", "Shared Core Alpha", "urn:entity:movie", 4, [
          "urn:tag:genre:media:slow_burn",
        ]),
        entity("C2", "Shared Core Beta", "urn:entity:movie", 1, [
          "urn:tag:genre:media:slow_burn",
        ]),
        entity("T1", "Tone Only", "urn:entity:movie", 2, [
          "urn:tag:genre:media:quiet",
        ]),
      ],
      queryProvenance: "synthetic:tone→movie",
    },
  ] as V2LensRetrieval[],
};

/** Pilot-shaped: two eligible lenses, zero shared cores. */
export const SYNTH_SPARSE = {
  lenses: [
    lens("a-premise", "E1", "Synth Film One"),
    lens("a-tone", "E2", "Synth Film Two"),
  ],
  retrievals: [
    {
      aspectId: "a-premise",
      category: "urn:entity:movie",
      status: "ok",
      entities: [
        entity("P1", "Premise One", "urn:entity:movie", 1, ["tag:x"]),
        entity("P2", "Premise Two", "urn:entity:movie", 2, ["tag:y"]),
        entity("P3", "Premise Three", "urn:entity:movie", 3, ["tag:z"]),
      ],
      queryProvenance: "synthetic:premise→movie",
    },
    {
      aspectId: "a-tone",
      category: "urn:entity:movie",
      status: "ok",
      entities: [
        entity("T1", "Tone One", "urn:entity:movie", 1, ["tag:p"]),
        entity("T2", "Tone Two", "urn:entity:movie", 2, ["tag:q"]),
        entity("T3", "Tone Three", "urn:entity:movie", 3, ["tag:r"]),
      ],
      queryProvenance: "synthetic:tone→movie",
    },
  ] as V2LensRetrieval[],
};

/** Shared cores exist but every bridge is LLM-provisional. */
export const SYNTH_PROVISIONAL = {
  lenses: [
    lens("a-premise", "E1", "Synth Film One", "llm-provisional"),
    lens("a-tone", "E2", "Synth Film Two", "llm-provisional"),
  ],
  retrievals: SYNTH_SHARED.retrievals,
};

/** One lens failed; the other returned useful entities. */
export const SYNTH_PARTIAL = {
  lenses: SYNTH_SPARSE.lenses,
  retrievals: [
    SYNTH_SPARSE.retrievals[0],
    {
      aspectId: "a-tone",
      category: "urn:entity:movie",
      status: "failed",
      entities: [],
      queryProvenance: "synthetic:tone→movie",
    },
  ] as V2LensRetrieval[],
};
