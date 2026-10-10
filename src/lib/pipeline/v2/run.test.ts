/**
 * V2 orchestrator tests with stubbed seams (synthetic only). Owned by S.
 *
 * Covers the §5 state table through `analyzePitch`: scope, empty
 * input, brief failure, ambiguity, seed exclusion, supporting
 * evidence (retrieved, never creates members), single-lens caps,
 * confirmation upgrades, failure states, budget, and deadline.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { V2BriefProposal } from "../../agent/v2-brief.ts";
import type { V2Budget, V2IdentityOutcome } from "../../qloo/v2-identity.ts";
import type { V2ReachOutcome } from "../../qloo/v2-reach.ts";
import { analyzePitch, type V2OrchestratorDeps } from "./run.ts";
import type { V2Input, V2LensRetrieval } from "./types.ts";

const PITCH =
  "A quiet science-fiction film about a lonely worker on a space station.";

function input(
  overrides: Partial<Omit<V2Input, "confirmedAnalogies">> & {
    confirmedAnalogies?: string[];
  } = {},
): V2Input {
  const { confirmedAnalogies, ...context } = overrides;
  const reviewed = proposal();
  reviewed.brief.aspects.push({
    id: "a-3",
    facet: "form",
    excerpt: "film",
    interpretation: "Form.",
  });
  reviewed.references.push({
    aspectId: "a-3",
    candidates: [
      { name: "Dune", entityType: "urn:entity:movie", analogy: "Epic." },
    ],
  });
  return {
    pitchText: PITCH,
    workType: "film",
    ...context,
    confirmedAnalogies: (confirmedAnalogies ?? []).map((aspectId) => {
      const aspect = reviewed.brief.aspects.find(
        (entry) => entry.id === aspectId,
      );
      const candidate = reviewed.references.find(
        (entry) => entry.aspectId === aspectId,
      )?.candidates[0];
      assert.ok(aspect !== undefined && candidate !== undefined);
      return {
        aspectId,
        facet: aspect.facet,
        excerpt: aspect.excerpt,
        interpretation: aspect.interpretation,
        entityId: aspectId === "a-1" ? "E1" : aspectId === "a-2" ? "E2" : "E3",
        entityName: candidate.name,
        entityType: candidate.entityType,
        selectedName: candidate.name,
        analogy: candidate.analogy,
      };
    }),
  };
}

function proposal(): V2BriefProposal {
  return {
    brief: {
      interpretation: "Reading: slow lonely sci-fi.",
      aspects: [
        {
          id: "a-1",
          facet: "premise",
          excerpt: "lonely worker",
          interpretation: "Isolation.",
        },
        {
          id: "a-2",
          facet: "tone",
          excerpt: "quiet",
          interpretation: "Quiet.",
        },
      ],
      constraints: [],
      contrasts: [],
      unrepresentable: [],
    },
    references: [
      {
        aspectId: "a-1",
        candidates: [
          {
            name: "Moon",
            entityType: "urn:entity:movie",
            analogy: "One worker.",
          },
        ],
      },
      {
        aspectId: "a-2",
        candidates: [
          { name: "Her", entityType: "urn:entity:movie", analogy: "Intimate." },
        ],
      },
    ],
  };
}

function resolved(query: string, id: string): V2IdentityOutcome {
  return {
    state: "resolved",
    query,
    entityType: "urn:entity:movie",
    entityId: id,
    entityName: query,
    year: null,
    exactMatches: [],
    closestNames: [],
    tagIds: ["t"],
    provenance: "stub",
  };
}

function retrieval(
  aspectId: string,
  ids: string[],
  status: V2LensRetrieval["status"] = "ok",
  tags: string[] = ["urn:tag:shared"],
): V2LensRetrieval {
  return {
    aspectId,
    category: "urn:entity:movie",
    status,
    entities: ids.map((id, i) => ({
      id,
      name: `Name ${id}`,
      type: "urn:entity:movie",
      position: i + 1,
      tags: [...tags],
    })),
    queryProvenance: "stub",
  };
}

function deps(overrides: Partial<V2OrchestratorDeps> = {}): V2OrchestratorDeps {
  return {
    proposeBrief: async (_pitch, _type, execution) => {
      execution?.onAttempt?.();
      return proposal();
    },
    resolveReference: async (query, _type, budget: V2Budget) => {
      budget.used += 1;
      return resolved(query, query === "Moon" ? "E1" : "E2");
    },
    fetchLens: async (entityId, aspectId, _excludeIds, budget: V2Budget) => {
      budget.used += 1;
      return [
        retrieval(
          aspectId,
          entityId === "E1" ? ["C1", "C2", "P1"] : ["C1", "C2", "T1"],
        ),
      ];
    },
    fetchReach: async () => [],
    explainEvidence: async (_packet, execution) => {
      execution?.onAttempt?.();
      return { explanations: [], llmCalls: 1 };
    },
    fetchOverlay: async (_entityId, comparisonId) =>
      retrieval(comparisonId, []),
    ...overrides,
  };
}

describe("analyzePitch states", () => {
  it("refuses tool pitches as unsupported without spending budget", async () => {
    const seen: number[] = [];
    const out = await analyzePitch(
      input({
        pitchText:
          "I want to build a bot that downloads videos without watermark",
      }),
      deps({
        resolveReference: async (q, _t, b) => {
          seen.push(b.used);
          return resolved(q, "E");
        },
      }),
    );
    assert.equal(out.reportState, "unsupported");
    assert.equal(out.dataState, "complete");
    assert.deepEqual(seen, []);
  });

  it("asks for clarification on empty pitches", async () => {
    const out = await analyzePitch(input({ pitchText: "   " }), deps());
    assert.equal(out.reportState, "needs-clarification");
  });

  it("reports unable-to-assess/unavailable when the brief fails", async () => {
    const out = await analyzePitch(
      input(),
      deps({
        proposeBrief: async () => {
          throw new Error("llm down");
        },
      }),
    );
    assert.deepEqual(
      [out.reportState, out.dataState],
      ["unable-to-assess", "unavailable"],
    );
  });

  it("asks for clarification when aspects are unrepresentable", async () => {
    const out = await analyzePitch(
      input(),
      deps({
        proposeBrief: async () => ({
          brief: { ...proposal().brief, aspects: [] },
          references: [],
        }),
      }),
    );
    assert.equal(out.reportState, "needs-clarification");
  });

  it("asks for clarification on ambiguity, unable-to-assess otherwise", async () => {
    const ambiguous = await analyzePitch(
      input(),
      deps({
        resolveReference: async (query) => ({
          ...resolved(query, "E"),
          state: "ambiguous",
          entityId: null,
          entityName: null,
        }),
      }),
    );
    assert.equal(ambiguous.reportState, "needs-clarification");
    const missing = await analyzePitch(
      input(),
      deps({
        resolveReference: async (query) => ({
          ...resolved(query, "E"),
          state: "not_found",
          entityId: null,
          entityName: null,
        }),
      }),
    );
    assert.deepEqual(
      [missing.reportState, missing.dataState],
      ["unable-to-assess", "complete"],
    );
  });

  it("returns exploration-only for pilot-shaped sparsity", async () => {
    const out = await analyzePitch(
      input(),
      deps({
        fetchLens: async (_id, aspectId) => [
          retrieval(aspectId, aspectId === "a-1" ? ["P1", "P2"] : ["T1", "T2"]),
        ],
      }),
    );
    assert.deepEqual(
      [out.reportState, out.dataState],
      ["exploration-only", "complete"],
    );
    assert.deepEqual(out.neighborhoods, []);
    assert.equal(out.explorations.length, 2);
    assert.ok(out.manifest !== null && out.manifest.frozenSeedIds.length === 2);
  });

  it("upgrades confirmed analogies into hypotheses", async () => {
    const out = await analyzePitch(
      input({ confirmedAnalogies: ["a-1", "a-2"] }),
      deps(),
    );
    assert.equal(out.reportState, "hypotheses");
    assert.equal(out.neighborhoods.length, 1);
    assert.equal(out.neighborhoods[0].coverage, 2);
  });

  it("keeps provisional bridges out of hypotheses", async () => {
    const out = await analyzePitch(input(), deps());
    assert.equal(out.reportState, "exploration-only");
  });

  it("caps a single usable lens at exploration-only", async () => {
    const single = proposal();
    single.brief.aspects = single.brief.aspects.slice(0, 1);
    single.references = single.references.slice(0, 1);
    const out = await analyzePitch(
      input(),
      deps({ proposeBrief: async () => single }),
    );
    assert.equal(out.reportState, "exploration-only");
    assert.equal(out.explorations.length, 1);
  });

  it("excludes frozen seeds and narrows duplicate entities", async () => {
    const out = await analyzePitch(
      input(),
      deps({
        resolveReference: async (query, _t, b) => {
          b.used += 1;
          return resolved(query, "SAME");
        },
        fetchLens: async (_id, aspectId) => [
          retrieval(aspectId, ["SAME", "C1"]),
        ],
      }),
    );
    assert.ok(out.limitations.some((l) => l.includes("narrow")));
    for (const r of [out.explorations.flatMap((e) => e.entities)]) {
      assert.ok(!r.some((e) => e.id === "SAME"));
    }
  });

  it("retrieves the frozen third lens as supporting evidence without creating members", async () => {
    const three = proposal();
    three.brief.aspects.push({
      id: "a-3",
      facet: "form",
      excerpt: "film",
      interpretation: "Form.",
    });
    three.references.push({
      aspectId: "a-3",
      candidates: [
        { name: "Dune", entityType: "urn:entity:movie", analogy: "Epic." },
      ],
    });
    const out = await analyzePitch(
      input({ confirmedAnalogies: ["a-1", "a-2", "a-3"] }),
      deps({
        proposeBrief: async () => three,
        resolveReference: async (query, _t, b) => {
          b.used += 1;
          return resolved(
            query,
            query === "Moon" ? "E1" : query === "Her" ? "E2" : "E3",
          );
        },
      }),
    );
    assert.deepEqual(out.manifest?.supportingLensIds, ["a-3"]);
    assert.deepEqual(out.manifest?.discoveryLensIds, ["a-1", "a-2"]);
    // Stub supporting lens (E3) returns the shared cores: evidence flag
    // set, membership still the two frozen discovery cores.
    assert.equal(out.neighborhoods.length, 1);
    assert.deepEqual(out.neighborhoods[0].coreMemberIds, ["C1", "C2"]);
    assert.deepEqual(out.neighborhoods[0].supportingEvidence, ["a-3"]);
  });

  it("keeps provisional supporting overlap out of evidence", async () => {
    const three = proposal();
    three.brief.aspects.push({
      id: "a-3",
      facet: "form",
      excerpt: "film",
      interpretation: "Form.",
    });
    three.references.push({
      aspectId: "a-3",
      candidates: [
        { name: "Dune", entityType: "urn:entity:movie", analogy: "Epic." },
      ],
    });
    const out = await analyzePitch(
      // a-3 confirmed for discovery lenses only; supporting stays provisional.
      input({ confirmedAnalogies: ["a-1", "a-2"] }),
      deps({
        proposeBrief: async () => three,
        resolveReference: async (query, _t, b) => {
          b.used += 1;
          return resolved(
            query,
            query === "Moon" ? "E1" : query === "Her" ? "E2" : "E3",
          );
        },
      }),
    );
    assert.equal(out.neighborhoods.length, 1);
    assert.deepEqual(out.neighborhoods[0].supportingEvidence, []);
    assert.ok(out.limitations.some((l) => l.includes("Supporting reference")));
  });

  it("lets supporting shortfall keep discovery-only groups, never rescue sparsity", async () => {
    const three = proposal();
    three.brief.aspects.push({
      id: "a-3",
      facet: "form",
      excerpt: "film",
      interpretation: "Form.",
    });
    three.references.push({
      aspectId: "a-3",
      candidates: [
        { name: "Dune", entityType: "urn:entity:movie", analogy: "Epic." },
      ],
    });
    const out = await analyzePitch(
      input({ confirmedAnalogies: ["a-1", "a-2", "a-3"] }),
      deps({
        proposeBrief: async () => three,
        resolveReference: async (query, _t, b) => {
          b.used += 1;
          return resolved(
            query,
            query === "Moon" ? "E1" : query === "Her" ? "E2" : "E3",
          );
        },
        // Discovery lenses share nothing; supporting returns the same
        // sparse ids. No frozen cores exist, so no neighborhood forms.
        fetchLens: async (entityId, aspectId) => [
          retrieval(
            aspectId,
            entityId === "E3"
              ? ["P1", "T1"]
              : aspectId === "a-1"
                ? ["P1"]
                : ["T1"],
          ),
        ],
      }),
    );
    assert.deepEqual(out.neighborhoods, []);
    assert.equal(out.reportState, "exploration-only");
  });

  it("reports partial when supporting retrieval failed but discovery survived", async () => {
    const three = proposal();
    three.brief.aspects.push({
      id: "a-3",
      facet: "form",
      excerpt: "film",
      interpretation: "Form.",
    });
    three.references.push({
      aspectId: "a-3",
      candidates: [
        { name: "Dune", entityType: "urn:entity:movie", analogy: "Epic." },
      ],
    });
    const out = await analyzePitch(
      input({ confirmedAnalogies: ["a-1", "a-2", "a-3"] }),
      deps({
        proposeBrief: async () => three,
        resolveReference: async (query, _t, b) => {
          b.used += 1;
          return resolved(
            query,
            query === "Moon" ? "E1" : query === "Her" ? "E2" : "E3",
          );
        },
        fetchLens: async (_id, aspectId) =>
          aspectId === "a-3"
            ? [retrieval(aspectId, [], "failed")]
            : [
                retrieval(
                  aspectId,
                  aspectId === "a-1" ? ["C1", "C2", "P1"] : ["C1", "C2", "T1"],
                ),
              ],
      }),
    );
    assert.deepEqual(
      [out.reportState, out.dataState],
      ["hypotheses", "partial"],
    );
    assert.deepEqual(out.neighborhoods[0].supportingEvidence, []);
  });

  it("reports partial when a retrieval failed but evidence survived", async () => {
    const out = await analyzePitch(
      input(),
      deps({
        fetchLens: async (_id, aspectId) =>
          aspectId === "a-1"
            ? [retrieval(aspectId, ["P1"])]
            : [retrieval(aspectId, [], "failed")],
      }),
    );
    assert.deepEqual(
      [out.reportState, out.dataState],
      ["exploration-only", "partial"],
    );
  });

  it("accounts attempts within the ceiling", async () => {
    const out = await analyzePitch(input(), deps());
    assert.equal(out.usage.httpAttempts, 4);
    assert.equal(out.usage.ceiling, 40);
    assert.equal(out.usage.llmCalls, 1);
  });

  it("stops at the deadline with gathered evidence", async () => {
    let t = 0;
    const out = await analyzePitch(
      input(),
      {
        ...deps(),
        now: () => {
          t += 100;
          return t;
        },
      },
      50,
    );
    assert.ok(out.limitations.some((l) => l.includes("Deadline")));
  });

  it("emits real stage progress", async () => {
    const stages: string[] = [];
    await analyzePitch(input(), {
      ...deps(),
      onProgress: (s) => stages.push(s),
    });
    assert.deepEqual(stages, [
      "scope",
      "interpret",
      "resolve",
      "freeze",
      "retrieve",
      "assess",
      "reach",
      "explain",
    ]);
  });

  it("attaches group-seeded leads to surviving hypotheses", async () => {
    const seen: { neighborhoodId: string; seedIds: string[] }[] = [];
    const out = await analyzePitch(
      input({ confirmedAnalogies: ["a-1", "a-2"] }),
      deps({
        fetchReach: async (
          neighborhoodId,
          seedIds,
        ): Promise<V2ReachOutcome[]> => {
          seen.push({ neighborhoodId, seedIds });
          return [
            {
              neighborhoodId,
              category: "urn:entity:podcast",
              seedIds,
              status: "ok",
              leads: [
                {
                  id: "L1",
                  name: "Lead One",
                  type: "urn:entity:podcast",
                  neighborhoodId,
                  seedIds,
                  category: "urn:entity:podcast",
                  link: null,
                  investigationAction: "act",
                  queryProvenance: "stub",
                },
              ],
              queryProvenance: "stub",
            },
          ];
        },
      }),
    );
    assert.equal(out.reportState, "hypotheses");
    assert.equal(out.neighborhoods.length, 1);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].neighborhoodId, out.neighborhoods[0].id);
    assert.deepEqual(seen[0].seedIds, ["C1", "C2"]);
    assert.equal(out.leads.length, 1);
    assert.equal(out.leads[0].neighborhoodId, out.neighborhoods[0].id);
    assert.ok(
      out.limitations.some((l) =>
        l.includes("starting point for conversations"),
      ),
    );
  });

  it("seeds reach with at most three frozen core ids", async () => {
    const seen: string[][] = [];
    const out = await analyzePitch(
      input({ confirmedAnalogies: ["a-1", "a-2"] }),
      deps({
        fetchLens: async (_id, aspectId) => [
          retrieval(aspectId, ["C1", "C2", "C3", "C4", "Solo"]),
        ],
        fetchReach: async (_nid, seedIds) => {
          seen.push(seedIds);
          return [];
        },
      }),
    );
    assert.equal(out.reportState, "hypotheses");
    assert.equal(seen.length, 1);
    assert.ok(seen[0].length <= 3);
  });

  it("skips reach without hypotheses and spends nothing on it", async () => {
    let calls = 0;
    const out = await analyzePitch(
      input(),
      deps({
        fetchLens: async (_id, aspectId) => [
          retrieval(aspectId, aspectId === "a-1" ? ["P1", "P2"] : ["T1", "T2"]),
        ],
        fetchReach: async () => {
          calls += 1;
          return [];
        },
      }),
    );
    assert.equal(out.reportState, "exploration-only");
    assert.equal(calls, 0);
    assert.deepEqual(out.leads, []);
    assert.ok(
      out.limitations.some((l) => l.includes("No audience hypotheses")),
    );
  });

  it("keeps hypotheses standing when reach queries fail", async () => {
    const out = await analyzePitch(
      input({ confirmedAnalogies: ["a-1", "a-2"] }),
      deps({
        fetchReach: async (neighborhoodId, seedIds) => [
          {
            neighborhoodId,
            category: "urn:entity:podcast",
            seedIds,
            status: "failed",
            leads: [],
            queryProvenance: "stub:failed",
          },
        ],
      }),
    );
    assert.deepEqual(
      [out.reportState, out.dataState],
      ["hypotheses", "complete"],
    );
    assert.deepEqual(out.leads, []);
    assert.ok(out.limitations.some((l) => l.includes("lead queries failed")));
  });

  it("attaches grounded words to surviving hypotheses", async () => {
    const out = await analyzePitch(
      input({ confirmedAnalogies: ["a-1", "a-2"] }),
      deps({
        explainEvidence: async (packet, execution) => {
          execution?.onAttempt?.();
          return {
            explanations: packet.neighborhoods.map((n) => ({
              neighborhoodId: n.id,
              name: "Slow-burn space stories",
              whyInvestigate: "Worth asking fans of both works to react.",
              source: "llm-grounded" as const,
            })),
            llmCalls: 1,
          };
        },
      }),
    );
    assert.equal(out.reportState, "hypotheses");
    assert.equal(out.explanations.length, 1);
    assert.equal(out.explanations[0].neighborhoodId, out.neighborhoods[0].id);
    assert.equal(out.explanations[0].source, "llm-grounded");
    assert.equal(out.usage.llmCalls, 2);
    assert.ok(
      out.limitations.some((l) => l.includes("interpret frozen evidence")),
    );
  });

  it("falls back to deterministic labels when explanation fails twice", async () => {
    const out = await analyzePitch(
      input({ confirmedAnalogies: ["a-1", "a-2"] }),
      deps({
        explainEvidence: async () => {
          throw new Error("validation failed twice");
        },
      }),
    );
    assert.equal(out.reportState, "hypotheses");
    assert.equal(out.explanations.length, 1);
    assert.equal(out.explanations[0].source, "deterministic");
    assert.ok(out.limitations.some((l) => l.includes("deterministic labels")));
  });

  it("spends no explanation call without hypotheses", async () => {
    let calls = 0;
    const out = await analyzePitch(
      input(),
      deps({
        fetchLens: async (_id, aspectId) => [
          retrieval(aspectId, aspectId === "a-1" ? ["P1", "P2"] : ["T1", "T2"]),
        ],
        explainEvidence: async (_packet) => {
          calls += 1;
          return { explanations: [], llmCalls: 1 };
        },
      }),
    );
    assert.equal(out.reportState, "exploration-only");
    assert.equal(calls, 0);
    assert.deepEqual(out.explanations, []);
    assert.equal(out.usage.llmCalls, 1);
  });

  it("records wall-clock latency on every result", async () => {
    const out = await analyzePitch(
      input({ confirmedAnalogies: ["a-1", "a-2"] }),
      deps(),
    );
    assert.equal(typeof out.usage.latencyMs, "number");
    assert.ok(out.usage.latencyMs >= 0);
  });

  it("keeps concurrent runs on independent ledgers", async () => {
    const slow = deps({
      fetchLens: async (entityId, aspectId, _e, budget: V2Budget) => {
        budget.used += 1;
        await new Promise((r) => setTimeout(r, 20));
        return [
          retrieval(
            aspectId,
            entityId === "E1" ? ["C1", "C2", "P1"] : ["C1", "C2", "T1"],
          ),
        ];
      },
    });
    const [first, second] = await Promise.all([
      analyzePitch(input({ confirmedAnalogies: ["a-1", "a-2"] }), slow),
      analyzePitch(input({ confirmedAnalogies: ["a-1", "a-2"] }), slow),
    ]);
    assert.equal(first.reportState, "hypotheses");
    assert.equal(second.reportState, "hypotheses");
    assert.notEqual(first.manifest?.runId, second.manifest?.runId);
    assert.equal(first.usage.httpAttempts, second.usage.httpAttempts);
  });

  it("resolves comparisons into a display-only overlay, never evidence", async () => {
    const out = await analyzePitch(
      input({ confirmedAnalogies: ["a-1", "a-2"], comparisons: ["Dune"] }),
      deps({
        resolveReference: async (query, _t, b) => {
          b.used += 1;
          return resolved(
            query,
            query === "Dune" ? "E9" : query === "Moon" ? "E1" : "E2",
          );
        },
        fetchOverlay: async (_id, comparisonId) =>
          retrieval(comparisonId, ["Z1", "Z2", "Z3", "Z4"]),
      }),
    );
    assert.equal(out.reportState, "hypotheses");
    assert.equal(out.comparisons.length, 1);
    assert.equal(out.comparisons[0].entityId, "E9");
    // Trimmed to three, and overlay-only Z-ids never join frozen cores.
    assert.deepEqual(
      out.comparisons[0].entities.map((e) => e.id),
      ["Z1", "Z2", "Z3"],
    );
    assert.deepEqual(out.neighborhoods[0].coreMemberIds, ["C1", "C2"]);
    assert.ok(out.manifest?.frozenSeedIds.includes("E9"));
  });

  it("excludes resolved comparison seeds from discovery counts", async () => {
    const out = await analyzePitch(
      input({ confirmedAnalogies: ["a-1", "a-2"], comparisons: ["Dune"] }),
      deps({
        resolveReference: async (query, _t, b) => {
          b.used += 1;
          return resolved(
            query,
            query === "Dune" ? "E9" : query === "Moon" ? "E1" : "E2",
          );
        },
        fetchLens: async (_id, aspectId) => [
          retrieval(aspectId, ["E9", "C1", "C2"]),
        ],
      }),
    );
    assert.ok(!out.neighborhoods[0].coreMemberIds.includes("E9"));
    for (const exp of out.explorations) {
      assert.ok(!exp.entities.some((e) => e.id === "E9"));
    }
  });

  it("caps comparisons at two with an honest note", async () => {
    const out = await analyzePitch(
      input({ comparisons: ["Dune", "Her", "Moon"] }),
      deps(),
    );
    assert.equal(out.comparisons.length, 2);
    assert.deepEqual(
      out.comparisons.map((c) => c.query),
      ["Dune", "Her"],
    );
    assert.ok(out.limitations.some((l) => l.includes("first 2")));
  });

  it("yields comp-led exploration when the pitch has no usable references", async () => {
    const out = await analyzePitch(
      input({ comparisons: ["Dune"] }),
      deps({
        resolveReference: async (query, _t, b) => {
          b.used += 1;
          return query === "Dune"
            ? resolved(query, "E9")
            : {
                ...resolved(query, "E"),
                state: "not_found",
                entityId: null,
                entityName: null,
              };
        },
        fetchOverlay: async (_id, comparisonId) =>
          retrieval(comparisonId, ["Z1", "Z2"]),
      }),
    );
    assert.equal(out.reportState, "exploration-only");
    assert.deepEqual(out.neighborhoods, []);
    assert.equal(out.explorations.length, 1);
    assert.equal(out.explorations[0].aspectId, "comparison:0");
    assert.equal(out.explorations[0].referenceName, "Dune");
    assert.ok(
      out.limitations.some((l) => l.includes("follows your comparisons")),
    );
  });

  it("enriches tag-less cores via exact-name lookup and reassesses", async () => {
    const out = await analyzePitch(
      input({ confirmedAnalogies: ["a-1", "a-2"] }),
      deps({
        resolveReference: async (query, _t, b) => {
          b.used += 1;
          if (query === "Moon") return resolved(query, "E1");
          if (query === "Her") return resolved(query, "E2");
          const m = /^Name (C\d)$/.exec(query);
          if (m !== null) {
            return {
              ...resolved(query, m[1]),
              tagIds: ["urn:tag:genre:media:slow_burn"],
            };
          }
          return resolved(query, "E9");
        },
        fetchLens: async (_id, aspectId) => [
          retrieval(aspectId, ["C1", "C2"], "ok", []),
        ],
      }),
    );
    assert.equal(out.reportState, "hypotheses");
    assert.equal(out.neighborhoods.length, 1);
    assert.equal(
      out.neighborhoods[0].sharedDescriptor,
      "urn:tag:genre:media:slow_burn",
    );
    assert.ok(out.limitations.some((l) => l.includes("Enriched tags for 2")));
  });

  it("caps enrichment lookups and skips id-mismatched hits", async () => {
    let enrichmentCalls = 0;
    const out = await analyzePitch(
      input({ confirmedAnalogies: ["a-1", "a-2"] }),
      deps({
        resolveReference: async (query, _t, b) => {
          b.used += 1;
          if (query === "Moon") return resolved(query, "E1");
          if (query === "Her") return resolved(query, "E2");
          enrichmentCalls += 1;
          return { ...resolved(query, "OTHER-ID"), tagIds: [] };
        },
        fetchLens: async (_id, aspectId) => [
          retrieval(aspectId, ["C1", "C2", "C3", "C4", "C5", "C6"], "ok", []),
        ],
      }),
    );
    assert.ok(enrichmentCalls <= 4);
    // No descriptor without tags: honest exploration-only, no invented group.
    assert.deepEqual(out.neighborhoods, []);
    assert.equal(out.reportState, "exploration-only");
  });
});
