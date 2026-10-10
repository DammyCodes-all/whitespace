/**
 * V2 discovery assessment tests on synthetic fixtures. Owned by S.
 *
 * Pure inputs and outputs only: seed exclusion, supporting evidence
 * (flags frozen cores, never creates members), distinct-lens rule,
 * evidence counts, ties, failure states (§7 acceptance).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SYNTH_PARTIAL,
  SYNTH_PROVISIONAL,
  SYNTH_SHARED,
  SYNTH_SPARSE,
} from "../../fixtures/v2-synthetic.ts";
import { composeStates } from "./assess.ts";
import {
  applySupportingEvidence,
  buildExplorations,
  collapseFamilies,
  dedupeNeighborhoods,
  excludeFrozenSeeds,
  findCoreEntities,
  formNeighborhoods,
  jaccard,
  orderNeighborhoods,
} from "./discovery.ts";
import {
  isBridgeEligible,
  type V2LensRetrieval,
  type V2ReferenceLens,
  type V2ReturnedEntity,
} from "./types.ts";

function returnedEntity(
  id: string,
  name = id,
  tags = ["shared-tag"],
): V2ReturnedEntity {
  return { id, name, tags, type: "urn:entity:movie", position: 1 };
}

function discoveryLens(aspectId: string, entityId: string): V2ReferenceLens {
  return {
    ...SYNTH_SHARED.lenses[0],
    aspectId,
    entityId,
    entityName: entityId,
    selectedName: entityId,
  };
}

function perAspect(
  retrievals: {
    aspectId: string;
    entities: {
      id: string;
      name: string;
      type: string;
      position: number;
      tags: string[];
    }[];
  }[],
) {
  const byAspect = new Map<
    string,
    {
      id: string;
      name: string;
      type: string;
      position: number;
      tags: string[];
    }[]
  >();
  for (const r of retrievals) {
    const list = byAspect.get(r.aspectId) ?? [];
    list.push(...r.entities);
    byAspect.set(r.aspectId, list);
  }
  return [...byAspect].map(([aspectId, entities]) => ({ aspectId, entities }));
}

describe("excludeFrozenSeeds", () => {
  it("drops every frozen seed id, including supporting seeds", () => {
    const entities = SYNTH_SHARED.retrievals[0].entities;
    const kept = excludeFrozenSeeds(entities, ["C1", "E2"]);
    assert.deepEqual(
      kept.map((e) => e.id),
      ["C2", "P1"],
    );
  });
});

describe("findCoreEntities", () => {
  it("keeps only entities returned under two distinct aspects", () => {
    const cores = findCoreEntities(perAspect(SYNTH_SHARED.retrievals));
    assert.deepEqual([...cores.keys()].sort(), ["C1", "C2"]);
  });

  it("counts retries within one aspect as one lens", () => {
    const once = SYNTH_SHARED.retrievals[0].entities;
    const cores = findCoreEntities([
      { aspectId: "a-premise", entities: once },
      { aspectId: "a-premise", entities: once },
    ]);
    assert.equal(cores.size, 0);
  });

  it("dedupes repeats inside a single lens without inflating", () => {
    const dup = [
      ...SYNTH_SHARED.retrievals[0].entities,
      SYNTH_SHARED.retrievals[0].entities[0],
    ];
    const cores = findCoreEntities([
      { aspectId: "a-premise", entities: dup },
      { aspectId: "a-tone", entities: SYNTH_SHARED.retrievals[1].entities },
    ]);
    assert.deepEqual([...cores.keys()].sort(), ["C1", "C2"]);
  });

  it("finds no cores in pilot-shaped sparse retrieval", () => {
    assert.equal(findCoreEntities(perAspect(SYNTH_SPARSE.retrievals)).size, 0);
  });
});

describe("collapseFamilies", () => {
  it("flags same-name ids as one family", () => {
    const byId = new Map([
      ["A", { id: "A", name: "Same Work", type: "t", position: 1, tags: [] }],
      ["B", { id: "B", name: "same-work", type: "t", position: 2, tags: [] }],
      ["C", { id: "C", name: "Other", type: "t", position: 3, tags: [] }],
    ]);
    assert.deepEqual(collapseFamilies(["A", "B", "C"], byId), [["A", "B"]]);
  });
});

describe("formNeighborhoods", () => {
  it("forms a coherent pitch-supported group with C=2, X=1", () => {
    const cores = findCoreEntities(perAspect(SYNTH_SHARED.retrievals));
    const [group] = formNeighborhoods(cores, SYNTH_SHARED.lenses, "run-1");
    assert.ok(group);
    assert.deepEqual(group.coreMemberIds, ["C1", "C2"]);
    assert.equal(group.coherent, true);
    assert.equal(group.sharedDescriptor, "urn:tag:genre:media:slow_burn");
    assert.equal(group.coverage, 2);
    assert.equal(group.corroboration, 1);
    assert.equal(group.pitchSupported, true);
    // Id and display name travel together, never parallel arrays.
    assert.deepEqual(
      group.members.map((m) => m.name),
      ["Shared Core Alpha", "Shared Core Beta"],
    );
  });

  it("keeps only actual descriptor holders in a film-score neighborhood", () => {
    const entities = [
      {
        id: "C1",
        name: "Composer One",
        type: "artist",
        position: 1,
        tags: ["film-score"],
      },
      {
        id: "C2",
        name: "Composer Two",
        type: "artist",
        position: 2,
        tags: ["film-score"],
      },
      {
        id: "P1",
        name: "Unrelated Punk",
        type: "artist",
        position: 3,
        tags: ["punk"],
      },
    ];
    const cores = findCoreEntities([
      { aspectId: "a-premise", entities },
      { aspectId: "a-tone", entities },
    ]);
    const [group] = formNeighborhoods(cores, SYNTH_SHARED.lenses, "run-1");
    assert.equal(group.sharedDescriptor, "film-score");
    assert.deepEqual(group.coreMemberIds, ["C1", "C2"]);
    assert.deepEqual(
      group.members.map((m) => m.name),
      ["Composer One", "Composer Two"],
    );
    assert.ok(group.members.every((m) => m.tags.includes("film-score")));
    assert.deepEqual([...cores.keys()], ["C1", "C2", "P1"]);
  });

  it("does not count an aspect returning only one member family as coverage", () => {
    const alpha = returnedEntity("A");
    const beta = returnedEntity("B");
    const cores = findCoreEntities([
      { aspectId: "a-premise", entities: [alpha, beta] },
      { aspectId: "a-tone", entities: [alpha, beta] },
      { aspectId: "a-form", entities: [alpha] },
    ]);
    const [group] = formNeighborhoods(
      cores,
      [...SYNTH_SHARED.lenses, discoveryLens("a-form", "E3")],
      "run-1",
    );
    assert.equal(group.coverage, 2);
    assert.equal(group.corroboration, 1);
  });

  it("counts name-collapsed families rather than IDs for coverage and pairs", () => {
    const alpha = returnedEntity("A", "Same Work");
    const alias = returnedEntity("A2", "same-work");
    const beta = returnedEntity("B", "Other Work");
    const cores = findCoreEntities([
      { aspectId: "a-premise", entities: [alpha, alias, beta] },
      { aspectId: "a-tone", entities: [alpha, alias] },
      { aspectId: "a-form", entities: [beta] },
    ]);
    const [group] = formNeighborhoods(
      cores,
      [...SYNTH_SHARED.lenses, discoveryLens("a-form", "E3")],
      "run-1",
    );
    assert.equal(group.coherent, true);
    assert.equal(group.coverage, 1);
    assert.equal(group.corroboration, 0);
    assert.equal(group.pitchSupported, false);
  });

  it("requires a pair sharing two families even when every aspect covers two", () => {
    const alpha = returnedEntity("A", "Same Work");
    const alias = returnedEntity("A2", "same_work");
    const beta = returnedEntity("B");
    const gamma = returnedEntity("C");
    const cores = findCoreEntities([
      { aspectId: "a-premise", entities: [alpha, alias, beta] },
      { aspectId: "a-tone", entities: [alpha, alias, gamma] },
      { aspectId: "a-form", entities: [beta, gamma] },
    ]);
    const [group] = formNeighborhoods(
      cores,
      [...SYNTH_SHARED.lenses, discoveryLens("a-form", "E3")],
      "run-1",
    );
    assert.equal(group.coverage, 3);
    assert.equal(group.corroboration, 0);
    assert.equal(group.pitchSupported, false);
    assert.deepEqual(orderNeighborhoods([group]), []);
  });

  for (const [label, duplicate] of [
    ["same reference ID", { entityId: "E1", entityName: "Renamed Film" }],
    [
      "name-collapsed reference family",
      { entityId: "E9", entityName: "synth-film_one" },
    ],
    ["same aspect ID", { aspectId: "a-premise" }],
  ] as const) {
    it(`does not form a core from duplicated lenses: ${label}`, () => {
      const cores = findCoreEntities(perAspect(SYNTH_SHARED.retrievals));
      const lenses = [
        SYNTH_SHARED.lenses[0],
        { ...SYNTH_SHARED.lenses[1], ...duplicate },
      ];
      assert.deepEqual(formNeighborhoods(cores, lenses, "run-1"), []);
    });
  }

  it("rejects conflicting references for one aspect instead of merging their returns", () => {
    const cores = findCoreEntities(perAspect(SYNTH_SHARED.retrievals));
    const lenses = [...SYNTH_SHARED.lenses, discoveryLens("a-premise", "E3")];
    assert.deepEqual(formNeighborhoods(cores, lenses, "run-1"), []);
  });

  it("does not inflate coverage when a repeated reference joins genuine lenses", () => {
    const entities = [returnedEntity("A"), returnedEntity("B")];
    const cores = findCoreEntities([
      { aspectId: "a-premise", entities },
      { aspectId: "a-tone", entities },
      { aspectId: "a-form", entities },
    ]);
    const lenses = [
      ...SYNTH_SHARED.lenses,
      discoveryLens("a-form", "E1"),
      SYNTH_SHARED.lenses[0],
    ];
    const [group] = formNeighborhoods(cores, lenses, "run-1");
    assert.equal(group.coverage, 2);
    assert.equal(group.corroboration, 1);
    assert.equal(group.pitchSupported, true);
  });

  it("preserves an overlap-only candidate for parent tag enrichment", () => {
    const entities = [
      returnedEntity("A", "Alpha", []),
      returnedEntity("B", "Beta", ["urn:entity:movie"]),
    ];
    const cores = findCoreEntities([
      { aspectId: "a-premise", entities },
      { aspectId: "a-tone", entities },
    ]);
    const [group] = formNeighborhoods(cores, SYNTH_SHARED.lenses, "run-1");
    assert.ok(group);
    assert.equal(group.sharedDescriptor, null);
    assert.deepEqual(group.coreMemberIds, ["A", "B"]);
    assert.equal(group.coherent, false);
    assert.equal(group.coverage, 2);
    assert.equal(group.corroboration, 1);
    assert.deepEqual(orderNeighborhoods([group]), []);
  });

  it("cites only successful discovery calls contributing frozen members", () => {
    const retrievals: V2LensRetrieval[] = [
      { ...SYNTH_SHARED.retrievals[0], callId: "call-premise" },
      { ...SYNTH_SHARED.retrievals[1], callId: "call-tone" },
      { ...SYNTH_SHARED.retrievals[1], callId: "call-tone" },
      {
        ...SYNTH_SHARED.retrievals[0],
        entities: [returnedEntity("Z9")],
        callId: "unrelated",
      },
      { ...SYNTH_SHARED.retrievals[1], status: "failed", callId: "failed" },
    ];
    const cores = findCoreEntities(perAspect(SYNTH_SHARED.retrievals));
    const [group] = formNeighborhoods(
      cores,
      SYNTH_SHARED.lenses,
      "run-1",
      retrievals,
    );
    assert.deepEqual(group.evidenceIds, ["call-premise", "call-tone"]);
  });

  it("chooses a deterministic descriptor on equal family counts", () => {
    const entities = [
      returnedEntity("A", "Alpha", ["z-tag", "a-tag"]),
      returnedEntity("B", "Beta", ["z-tag", "a-tag"]),
    ];
    const cores = findCoreEntities([
      { aspectId: "a-premise", entities },
      { aspectId: "a-tone", entities },
    ]);
    const [group] = formNeighborhoods(cores, SYNTH_SHARED.lenses, "run-1");
    assert.equal(group.sharedDescriptor, "a-tag");
  });

  it("marks provisional-bridge overlap as not pitch-supported", () => {
    const cores = findCoreEntities(perAspect(SYNTH_PROVISIONAL.retrievals));
    const [group] = formNeighborhoods(cores, SYNTH_PROVISIONAL.lenses, "run-1");
    assert.ok(group);
    assert.equal(group.coverage, 0);
    assert.equal(group.pitchSupported, false);
  });
});

describe("applySupportingEvidence", () => {
  function supportingLens(
    aspectId = "a-form",
    bridge: "returned-metadata" | "llm-provisional" = "returned-metadata",
  ) {
    return {
      aspectId,
      candidates: [],
      selectedName: "Synth Support",
      entityId: "E3",
      entityName: "Synth Support",
      entityType: "urn:entity:movie",
      identity: "resolved" as const,
      bridge,
      analogy: "synthetic analogy",
      role: "supporting" as const,
    };
  }

  function supportingRetrieval(aspectId: string, ids: string[]) {
    return {
      aspectId,
      category: "urn:entity:movie",
      status: "ok" as const,
      entities: ids.map((id, i) => ({
        id,
        name: `Name ${id}`,
        type: "urn:entity:movie",
        position: i + 1,
        tags: [] as string[],
      })),
      queryProvenance: "synthetic:support",
    };
  }

  it("flags groups whose frozen cores the supporting lens also returns", () => {
    const cores = findCoreEntities(perAspect(SYNTH_SHARED.retrievals));
    const [group] = formNeighborhoods(cores, SYNTH_SHARED.lenses, "run-1");
    const [flagged] = applySupportingEvidence(
      [group],
      [supportingRetrieval("a-form", ["C1", "C2", "Z9"])],
      [supportingLens()],
    );
    assert.deepEqual(flagged.supportingEvidence, ["a-form"]);
    // Membership frozen: no new members from supporting-only Z9.
    assert.deepEqual(flagged.coreMemberIds, ["C1", "C2"]);
    assert.equal(flagged.coverage, 2);
    assert.equal(flagged.corroboration, 1);
  });

  it("ignores supporting lenses with provisional bridges", () => {
    const cores = findCoreEntities(perAspect(SYNTH_SHARED.retrievals));
    const [group] = formNeighborhoods(cores, SYNTH_SHARED.lenses, "run-1");
    const [kept] = applySupportingEvidence(
      [group],
      [supportingRetrieval("a-form", ["C1", "C2"])],
      [supportingLens("a-form", "llm-provisional")],
    );
    assert.deepEqual(kept.supportingEvidence, []);
  });

  it("requires two shared core members, not one", () => {
    const cores = findCoreEntities(perAspect(SYNTH_SHARED.retrievals));
    const [group] = formNeighborhoods(cores, SYNTH_SHARED.lenses, "run-1");
    const [kept] = applySupportingEvidence(
      [group],
      [supportingRetrieval("a-form", ["C1", "Z9"])],
      [supportingLens()],
    );
    assert.deepEqual(kept.supportingEvidence, []);
  });

  it("requires two name-collapsed frozen families for support", () => {
    const alpha = returnedEntity("A", "Same Work");
    const alias = returnedEntity("A2", "same-work");
    const beta = returnedEntity("B");
    const entities = [alpha, alias, beta];
    const cores = findCoreEntities([
      { aspectId: "a-premise", entities },
      { aspectId: "a-tone", entities },
    ]);
    const [group] = formNeighborhoods(cores, SYNTH_SHARED.lenses, "run-1");
    const [kept] = applySupportingEvidence(
      [group],
      [supportingRetrieval("a-form", ["A", "A2"])],
      [supportingLens()],
    );
    assert.deepEqual(kept.supportingEvidence, []);
    const [supported] = applySupportingEvidence(
      [group],
      [supportingRetrieval("a-form", ["A", "A2", "B", "Z9"])],
      [supportingLens()],
    );
    assert.deepEqual(supported.supportingEvidence, ["a-form"]);
    assert.deepEqual(supported.members, group.members);
    assert.deepEqual(supported.coreMemberIds, group.coreMemberIds);
    assert.deepEqual(group.supportingEvidence, []);
    assert.equal(supported.coverage, group.coverage);
    assert.equal(supported.corroboration, group.corroboration);
  });

  it("never uses failed retrieval payloads as supporting evidence", () => {
    const cores = findCoreEntities(perAspect(SYNTH_SHARED.retrievals));
    const [group] = formNeighborhoods(cores, SYNTH_SHARED.lenses, "run-1");
    const [kept] = applySupportingEvidence(
      [group],
      [{ ...supportingRetrieval("a-form", ["C1", "C2"]), status: "failed" }],
      [supportingLens()],
    );
    assert.deepEqual(kept.supportingEvidence, []);
  });

  it("counts repeated supporting references once and excludes discovery reuse", () => {
    const cores = findCoreEntities(perAspect(SYNTH_SHARED.retrievals));
    const [group] = formNeighborhoods(cores, SYNTH_SHARED.lenses, "run-1");
    const [supported] = applySupportingEvidence(
      [group],
      [
        supportingRetrieval("a-form", ["C1", "C2"]),
        supportingRetrieval("a-other", ["C1", "C2"]),
      ],
      [supportingLens(), supportingLens("a-other")],
    );
    assert.deepEqual(supported.supportingEvidence, ["a-form"]);
    const [kept] = applySupportingEvidence(
      [group],
      [supportingRetrieval("a-form", ["C1", "C2"])],
      [{ ...supportingLens(), entityId: "E1" }],
      SYNTH_SHARED.lenses,
    );
    assert.deepEqual(kept.supportingEvidence, []);
  });

  it("merges contributing support call IDs without mutating frozen evidence", () => {
    const cores = findCoreEntities(perAspect(SYNTH_SHARED.retrievals));
    const [formed] = formNeighborhoods(cores, SYNTH_SHARED.lenses, "run-1");
    const group = { ...formed, evidenceIds: ["discovery"] };
    const retrievals: V2LensRetrieval[] = [
      {
        ...supportingRetrieval("a-form", ["C1", "Z9"]),
        callId: "support-movies",
      },
      {
        ...supportingRetrieval("a-form", ["C2"]),
        category: "urn:entity:artist",
        callId: "support-artists",
      },
      { ...supportingRetrieval("a-form", ["C1"]), callId: "support-movies" },
      { ...supportingRetrieval("a-form", ["Z9"]), callId: "unrelated" },
      {
        ...supportingRetrieval("a-form", ["C1", "C2"]),
        status: "failed",
        callId: "failed",
      },
    ];
    const [supported] = applySupportingEvidence([group], retrievals, [
      supportingLens(),
    ]);
    assert.deepEqual(supported.supportingEvidence, ["a-form"]);
    assert.deepEqual(supported.evidenceIds, [
      "discovery",
      "support-artists",
      "support-movies",
    ]);
    assert.deepEqual(group.evidenceIds, ["discovery"]);
    assert.deepEqual(group.supportingEvidence, []);
    const [unsupported] = applySupportingEvidence(
      [group],
      [{ ...supportingRetrieval("a-form", ["C1"]), callId: "one-member" }],
      [supportingLens()],
    );
    assert.deepEqual(unsupported.evidenceIds, ["discovery"]);
  });

  it("cannot create neighborhoods from supporting-only overlap", () => {
    const [kept] = applySupportingEvidence(
      [],
      [supportingRetrieval("a-form", ["C1", "C2"])],
      [supportingLens()],
    );
    assert.equal(kept, undefined);
  });
});

describe("orderNeighborhoods + dedupeNeighborhoods", () => {
  it("orders by C then X with a stable id tie-break", () => {
    const groups = [
      {
        id: "b",
        coverage: 2,
        corroboration: 0,
        pitchSupported: true,
        coherent: true,
        coreMemberIds: ["X"],
        members: [],
        sharedDescriptor: "t",
      },
      {
        id: "a",
        coverage: 2,
        corroboration: 0,
        pitchSupported: true,
        coherent: true,
        coreMemberIds: ["Y"],
        members: [],
        sharedDescriptor: "t",
      },
      {
        id: "c",
        coverage: 3,
        corroboration: 0,
        pitchSupported: true,
        coherent: true,
        coreMemberIds: ["Z"],
        members: [],
        sharedDescriptor: "t",
      },
    ];
    assert.deepEqual(
      orderNeighborhoods(groups as never).map((g) => g.id),
      ["c", "a", "b"],
    );
  });

  it("breaks C/X ties with supporting evidence before stable id", () => {
    const base = {
      coverage: 2,
      corroboration: 1,
      pitchSupported: true,
      coherent: true,
      members: [],
      sharedDescriptor: "t",
    };
    const groups = [
      { ...base, id: "a", coreMemberIds: ["X"], supportingEvidence: [] },
      {
        ...base,
        id: "b",
        coreMemberIds: ["Y"],
        supportingEvidence: ["a-form"],
      },
    ];
    assert.deepEqual(
      orderNeighborhoods(groups as never).map((g) => g.id),
      ["b", "a"],
    );
  });

  it("drops provisional and incoherent groups from ordering", () => {
    const cores = findCoreEntities(perAspect(SYNTH_PROVISIONAL.retrievals));
    const groups = formNeighborhoods(cores, SYNTH_PROVISIONAL.lenses, "run-1");
    assert.deepEqual(orderNeighborhoods(groups), []);
  });

  it("suppresses near-duplicates after evidence ordering and before the cap", () => {
    const base = {
      coverage: 2,
      corroboration: 1,
      pitchSupported: true,
      coherent: true,
      members: [],
      sharedDescriptor: "t",
      supportingEvidence: [],
    };
    const groups = [
      { ...base, id: "a", coreMemberIds: ["A", "B", "C"] },
      {
        ...base,
        id: "b",
        coreMemberIds: ["A", "B"],
        supportingEvidence: ["support"],
      },
      { ...base, id: "c", coreMemberIds: ["D", "E"] },
      { ...base, id: "d", coreMemberIds: ["F", "G"] },
    ];
    assert.deepEqual(
      orderNeighborhoods(groups).map((g) => g.id),
      ["b", "c", "d"],
    );
  });

  it("suppresses near-duplicate groups at the Jaccard threshold", () => {
    assert.equal(jaccard(new Set(["A", "B", "C"]), new Set(["A", "B"])), 2 / 3);
    const base = {
      coverage: 2,
      corroboration: 1,
      pitchSupported: true,
      coherent: true,
      members: [],
      sharedDescriptor: "t",
    };
    const groups = [
      { ...base, id: "g1", coreMemberIds: ["A", "B", "C"] },
      { ...base, id: "g2", coreMemberIds: ["A", "B"] },
    ];
    assert.deepEqual(
      dedupeNeighborhoods(groups as never).map((g) => g.id),
      ["g1"],
    );
  });
});

describe("buildExplorations", () => {
  it("skips repeated entities without losing later unique results and cites displayed evidence", () => {
    const retrievals: V2LensRetrieval[] = [
      {
        ...SYNTH_SHARED.retrievals[0],
        entities: [
          returnedEntity("A"),
          returnedEntity("A"),
          returnedEntity("B"),
        ],
        callId: "movies",
      },
      {
        ...SYNTH_SHARED.retrievals[0],
        entities: [returnedEntity("B"), returnedEntity("C")],
        callId: "artists",
      },
      {
        ...SYNTH_SHARED.retrievals[0],
        entities: [returnedEntity("C")],
        callId: "artists",
      },
      {
        ...SYNTH_SHARED.retrievals[0],
        entities: [returnedEntity("Z9")],
        callId: "beyond-bound",
      },
      {
        ...SYNTH_SHARED.retrievals[0],
        status: "failed",
        entities: [returnedEntity("A")],
        callId: "failed",
      },
    ];
    const [exploration] = buildExplorations(retrievals, SYNTH_SHARED.lenses);
    assert.deepEqual(
      exploration.entities.map((e) => e.id),
      ["A", "B", "C"],
    );
    assert.deepEqual(exploration.evidenceIds, ["artists", "movies"]);
  });

  it("does not expose failed retrieval payloads as exploration", () => {
    assert.deepEqual(
      buildExplorations(
        [{ ...SYNTH_SHARED.retrievals[0], status: "failed", callId: "failed" }],
        SYNTH_SHARED.lenses,
      ),
      [],
    );
  });

  it("returns bounded per-lens entries with no group label", () => {
    const explorations = buildExplorations(
      SYNTH_SPARSE.retrievals,
      SYNTH_SPARSE.lenses,
    );
    assert.equal(explorations.length, 2);
    for (const e of explorations) {
      assert.ok(e.entities.length <= 3);
      assert.ok(!("coreMemberIds" in e));
    }
  });
});

describe("isBridgeEligible", () => {
  it("rejects provisional bridges and unresolved identities", () => {
    assert.equal(isBridgeEligible(SYNTH_SHARED.lenses[0]), true);
    assert.equal(isBridgeEligible(SYNTH_PROVISIONAL.lenses[0]), false);
    assert.equal(
      isBridgeEligible({ ...SYNTH_SHARED.lenses[0], identity: "ambiguous" }),
      false,
    );
  });
});

describe("composeStates", () => {
  it("reports hypotheses/complete for supported groups", () => {
    const cores = findCoreEntities(perAspect(SYNTH_SHARED.retrievals));
    const neighborhoods = orderNeighborhoods(
      formNeighborhoods(cores, SYNTH_SHARED.lenses, "run-1"),
    );
    assert.deepEqual(
      composeStates({
        neighborhoods,
        retrievals: SYNTH_SHARED.retrievals,
        hasBrief: true,
        usableLensCount: 2,
        explorationsUseful: true,
      }),
      { reportState: "hypotheses", dataState: "complete" },
    );
  });

  it("reports exploration-only/complete for pilot-shaped sparsity", () => {
    assert.deepEqual(
      composeStates({
        neighborhoods: [],
        retrievals: SYNTH_SPARSE.retrievals,
        hasBrief: true,
        usableLensCount: 2,
        explorationsUseful: true,
      }),
      { reportState: "exploration-only", dataState: "complete" },
    );
  });

  it("reports exploration-only/partial when a lens failed but evidence survived", () => {
    assert.deepEqual(
      composeStates({
        neighborhoods: [],
        retrievals: SYNTH_PARTIAL.retrievals,
        hasBrief: true,
        usableLensCount: 2,
        explorationsUseful: true,
      }),
      { reportState: "exploration-only", dataState: "partial" },
    );
  });

  it("reports unable-to-assess/unavailable when nothing usable survived", () => {
    assert.deepEqual(
      composeStates({
        neighborhoods: [],
        retrievals: [
          {
            aspectId: "a",
            category: "c",
            status: "failed",
            entities: [],
            queryProvenance: "s",
          },
        ],
        hasBrief: true,
        usableLensCount: 0,
        explorationsUseful: false,
      }),
      { reportState: "unable-to-assess", dataState: "unavailable" },
    );
  });

  it("reports no-supported-hypothesis/complete for empty retrieval", () => {
    assert.deepEqual(
      composeStates({
        neighborhoods: [],
        retrievals: [
          {
            aspectId: "a",
            category: "c",
            status: "empty",
            entities: [],
            queryProvenance: "s",
          },
        ],
        hasBrief: true,
        usableLensCount: 1,
        explorationsUseful: false,
      }),
      { reportState: "no-supported-hypothesis", dataState: "complete" },
    );
  });
});
