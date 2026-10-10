import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildConfirmationInput, isConfirmedBridge } from "./confirmation.ts";
import type { V2ConfirmedAnalogy, V2Result } from "./types.ts";

const PITCH =
  "A quiet\n\tfilm about a lonely worker, told in a single room; not a thriller.";

function reviewed(): V2Result {
  return {
    runId: "reviewed-run",
    input: {
      pitchText: PITCH,
      workType: "film",
      comparisons: ["Comparison one", "Comparison two"],
      contrasts: ["Not a thriller"],
    },
    brief: {
      interpretation: "Reading: an intimate, constrained story of isolation.",
      aspects: [
        {
          id: "premise-reviewed",
          facet: "premise",
          excerpt: "lonely worker",
          interpretation: "Isolation as the premise.",
        },
        {
          id: "tone-reviewed",
          facet: "tone",
          excerpt: "quiet\n\tfilm",
          interpretation: "An intimate tone.",
        },
        {
          id: "form-reviewed",
          facet: "form",
          excerpt: "single room",
          interpretation: "A constrained setting.",
        },
      ],
      constraints: ["Single room"],
      contrasts: ["Not a thriller"],
      unrepresentable: [],
    },
    lenses: [
      {
        aspectId: "premise-reviewed",
        candidates: [
          {
            name: "Other candidate",
            entityType: "urn:entity:movie",
            analogy: "A different isolation analogy.",
          },
          {
            name: "Selected premise",
            entityType: "urn:entity:movie",
            analogy: "One worker's isolation.",
          },
        ],
        selectedName: "Selected premise",
        entityId: "entity-premise",
        entityName: "Canonical premise",
        entityType: "urn:entity:movie",
        identity: "resolved",
        bridge: "creator-confirmation",
        analogy: "One worker's isolation.",
        role: "discovery",
      },
      {
        aspectId: "tone-reviewed",
        candidates: [
          {
            name: "Selected tone",
            entityType: "urn:entity:movie",
            analogy: "An intimate, quiet tone.",
          },
        ],
        selectedName: "Selected tone",
        entityId: "entity-tone",
        entityName: "Canonical tone",
        entityType: "urn:entity:movie",
        identity: "resolved",
        bridge: "llm-provisional",
        analogy: "An intimate, quiet tone.",
        role: "discovery",
      },
      {
        aspectId: "form-reviewed",
        candidates: [
          {
            name: "Selected form",
            entityType: "urn:entity:movie",
            analogy: "Action in one room.",
          },
        ],
        selectedName: "Selected form",
        entityId: "entity-form",
        entityName: "Canonical form",
        entityType: "urn:entity:movie",
        identity: "resolved",
        bridge: "llm-provisional",
        analogy: "Action in one room.",
        role: "supporting",
      },
    ],
    manifest: null,
    reportState: "exploration-only",
    dataState: "complete",
    neighborhoods: [],
    explorations: [],
    limitations: [],
    leads: [],
    explanations: [],
    comparisons: [],
    usage: { httpAttempts: 0, ceiling: 40, llmCalls: 0, latencyMs: 0 },
  };
}

const PREMISE_APPROVAL: V2ConfirmedAnalogy = {
  aspectId: "premise-reviewed",
  facet: "premise",
  excerpt: "lonely worker",
  interpretation: "Isolation as the premise.",
  entityId: "entity-premise",
  entityName: "Canonical premise",
  entityType: "urn:entity:movie",
  selectedName: "Selected premise",
  analogy: "One worker's isolation.",
};

const TONE_APPROVAL: V2ConfirmedAnalogy = {
  aspectId: "tone-reviewed",
  facet: "tone",
  excerpt: "quiet\n\tfilm",
  interpretation: "An intimate tone.",
  entityId: "entity-tone",
  entityName: "Canonical tone",
  entityType: "urn:entity:movie",
  selectedName: "Selected tone",
  analogy: "An intimate, quiet tone.",
};

describe("buildConfirmationInput", () => {
  it("cumulatively preserves reviewed creator bridges and pins the exact selected candidates", () => {
    const result = reviewed();
    const before = structuredClone(result);
    const input = buildConfirmationInput(result, ["tone-reviewed"]);
    assert.deepEqual(input.confirmedAnalogies, [
      PREMISE_APPROVAL,
      TONE_APPROVAL,
    ]);
    assert.equal(input.pitchText, PITCH);
    assert.equal(input.workType, "film");
    assert.equal(input.correctionOf, "reviewed-run");
    assert.deepEqual(input.comparisons, before.input.comparisons);
    assert.deepEqual(input.contrasts, before.input.contrasts);
    assert.deepEqual(input.preparedBrief?.brief, before.brief);
    assert.equal(input.preparedBrief?.pitchText, PITCH);
    assert.equal(input.preparedBrief?.workType, "film");
    assert.deepEqual(input.preparedBrief?.references[0], {
      aspectId: "premise-reviewed",
      candidates: [
        {
          name: "Selected premise",
          entityType: "urn:entity:movie",
          analogy: "One worker's isolation.",
        },
      ],
    });
    assert.deepEqual(result, before, "building a correction must be pure");

    const next = reviewed();
    next.input = input;
    next.lenses[1].bridge = "creator-confirmation";
    next.runId = "second-run";
    assert.deepEqual(
      buildConfirmationInput(next, ["form-reviewed"]).confirmedAnalogies?.map(
        (confirmation) => confirmation.aspectId,
      ),
      ["premise-reviewed", "tone-reviewed", "form-reviewed"],
    );
  });

  it("uses current reviewed bridges, never stale input approvals or an old prepared snapshot", () => {
    const result = reviewed();
    result.input = buildConfirmationInput(result, ["tone-reviewed"]);
    result.lenses[0].bridge = "llm-provisional";
    result.lenses[0].selectedName = "Other candidate";
    result.lenses[0].entityId = "other-entity";
    result.lenses[0].entityName = "Other canonical name";
    result.lenses[0].analogy = "A different isolation analogy.";
    const input = buildConfirmationInput(result, []);
    assert.deepEqual(input.confirmedAnalogies, []);
    assert.equal(input.preparedBrief?.references[0].candidates.length, 2);
  });

  it("deduplicates requested approvals and returns detached snapshots", () => {
    const result = reviewed();
    const before = structuredClone(result);
    const input = buildConfirmationInput(result, [
      "tone-reviewed",
      "tone-reviewed",
    ]);
    assert.equal(input.confirmedAnalogies?.length, 2);
    assert.ok(input.preparedBrief);
    input.preparedBrief.brief.aspects[0].excerpt = "changed";
    input.preparedBrief.references[0].candidates[0].analogy = "changed";
    input.comparisons?.push("changed");
    input.contrasts?.push("changed");
    assert.deepEqual(result, before);
  });

  it("rejects missing aspects, unresolved identities, and bridges with no exact selected candidate", () => {
    assert.throws(() => buildConfirmationInput(reviewed(), ["a-1"]));
    const result = reviewed();
    result.lenses[1].identity = "ambiguous";
    assert.throws(() => buildConfirmationInput(result, ["tone-reviewed"]));
    result.lenses[1].identity = "resolved";
    result.lenses[1].analogy = "A different, unreviewed analogy.";
    assert.throws(() => buildConfirmationInput(result, ["tone-reviewed"]));
    result.brief = null;
    assert.throws(() => buildConfirmationInput(result, []));
  });

  it("falls back to the manifest run id only when the result has no run id", () => {
    const result = reviewed();
    result.manifest = {
      runId: "manifest-run",
      pipelineVersion: "fixture",
      policyVersion: "fixture",
      frozenSeedIds: [],
      discoveryLensIds: [],
      supportingLensIds: [],
      targetCategories: [],
      retrievalTake: 20,
      attemptCeiling: 40,
      knownFamilyLinks: [],
    };
    assert.equal(
      buildConfirmationInput(result, []).correctionOf,
      "reviewed-run",
    );
    delete result.runId;
    assert.equal(
      buildConfirmationInput(result, []).correctionOf,
      "manifest-run",
    );
  });
});

describe("isConfirmedBridge", () => {
  it("matches every exact bridge field only after a freshly resolved identity", () => {
    const result = reviewed();
    assert.ok(result.brief);
    const aspect = result.brief.aspects[1];
    const lens = result.lenses[1];
    assert.equal(isConfirmedBridge(aspect, lens, [TONE_APPROVAL]), true);
    for (const field of [
      "aspectId",
      "facet",
      "excerpt",
      "interpretation",
      "entityId",
      "entityName",
      "entityType",
      "selectedName",
      "analogy",
    ] as const) {
      const changed = { ...TONE_APPROVAL, [field]: `${TONE_APPROVAL[field]} ` };
      assert.equal(isConfirmedBridge(aspect, lens, [changed]), false, field);
    }
    for (const identity of [
      "ambiguous",
      "not_found",
      "request_failed",
    ] as const) {
      assert.equal(
        isConfirmedBridge(aspect, { ...lens, identity }, [TONE_APPROVAL]),
        false,
      );
    }
    assert.equal(
      isConfirmedBridge(aspect, { ...lens, entityId: "new-identity" }, [
        TONE_APPROVAL,
      ]),
      false,
    );
    assert.equal(
      isConfirmedBridge(aspect, { ...lens, entityId: null }, [TONE_APPROVAL]),
      false,
    );
    assert.equal(
      isConfirmedBridge(aspect, { ...lens, candidates: [] }, [TONE_APPROVAL]),
      false,
    );
    assert.equal(isConfirmedBridge(aspect, lens, undefined), false);
  });

  it("does not transfer approvals through positional ids, reordered aspects, or changed references", () => {
    const result = reviewed();
    assert.ok(result.brief);
    result.brief.aspects.reverse();
    const original = result.brief.aspects.find(
      (aspect) => aspect.id === "tone-reviewed",
    );
    assert.ok(original);
    assert.equal(
      isConfirmedBridge(original, result.lenses[1], [TONE_APPROVAL]),
      true,
    );
    const reordered = { ...result.brief.aspects[0], id: "tone-reviewed" };
    assert.equal(
      isConfirmedBridge(reordered, result.lenses[1], [TONE_APPROVAL]),
      false,
    );
    const replacement = {
      ...result.lenses[1],
      selectedName: "Different reference",
      entityId: "different-entity",
      entityName: "Different canonical name",
      candidates: [
        {
          name: "Different reference",
          entityType: "urn:entity:movie",
          analogy: "An intimate, quiet tone.",
        },
      ],
    };
    assert.equal(
      isConfirmedBridge(original, replacement, [TONE_APPROVAL]),
      false,
    );
    assert.equal(
      isConfirmedBridge(
        { ...original, excerpt: "quiet film" },
        result.lenses[1],
        [TONE_APPROVAL],
      ),
      false,
    );
  });
});
