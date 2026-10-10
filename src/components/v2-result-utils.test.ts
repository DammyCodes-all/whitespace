import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { V2Result } from "../lib/pipeline/v2/types.ts";
import {
  isLegacyV2Replay,
  isSafeHttpLink,
  parseV2Result,
} from "./v2-replay.ts";
import {
  buildRevisionInput,
  evidenceJson,
  LOST_RESPONSE_MESSAGE,
  memberEvidenceIds,
  recordedEvidenceIds,
} from "./v2-result-utils.ts";

function result(): V2Result {
  return {
    runId: "synthetic-correction",
    reportState: "exploration-only",
    dataState: "partial",
    input: {
      pitchText: "A quiet film, not a thriller.",
      workType: "film",
      comparisons: ["Synthetic comparison one", "Synthetic comparison two"],
      contrasts: ["Synthetic contrast one", "Synthetic contrast two"],
      confirmedAnalogies: [
        {
          aspectId: "a-1",
          facet: "tone",
          excerpt: "quiet",
          interpretation: "Quiet tone",
          entityId: "E1",
          entityName: "Synthetic reference",
          entityType: "urn:entity:movie",
          selectedName: "Synthetic reference",
          analogy: "Quiet tone",
        },
      ],
      preparedBrief: {
        pitchText: "A quiet film, not a thriller.",
        workType: "film",
        brief: {
          interpretation: "Quiet film",
          aspects: [
            {
              id: "a-1",
              facet: "tone",
              excerpt: "quiet",
              interpretation: "Quiet tone",
            },
          ],
          constraints: ["not a thriller"],
          contrasts: [],
          unrepresentable: [],
        },
        references: [
          {
            aspectId: "a-1",
            candidates: [
              {
                name: "Synthetic reference",
                entityType: "urn:entity:movie",
                analogy: "Quiet tone",
              },
            ],
          },
        ],
      },
    },
    brief: null,
    manifest: null,
    lenses: [],
    neighborhoods: [],
    candidateHypotheses: [],
    explorations: [],
    limitations: [],
    leads: [],
    explanations: [],
    comparisons: [],
    usage: { httpAttempts: 0, ceiling: 40, llmCalls: 0, latencyMs: 0 },
  };
}

describe("full-context revision", () => {
  it("restores all input context and new runId for a manifest-null result", () => {
    const previous = result();
    const snapshot = structuredClone(previous);
    const input = buildRevisionInput(previous);
    assert.deepEqual(input, {
      pitchText: previous.input.pitchText,
      workType: "film",
      comparisons: previous.input.comparisons,
      contrasts: previous.input.contrasts,
      correctionOf: "synthetic-correction",
    });
    assert.equal(
      input.confirmedAnalogies,
      undefined,
      "editing must not carry approvals to another pitch",
    );
    assert.equal(input.preparedBrief, undefined);
    input.comparisons?.push("A changed comparison");
    assert.deepEqual(
      previous,
      snapshot,
      "correction cannot mutate frozen input",
    );
  });

  it("validates full prepared interpretations and exact approval objects", () => {
    assert.notEqual(parseV2Result(result()), null);
    const malformed = structuredClone(result());
    if (malformed.input.preparedBrief) {
      Reflect.deleteProperty(
        malformed.input.preparedBrief.references[0].candidates[0],
        "analogy",
      );
    }
    assert.equal(parseV2Result(malformed), null);
  });

  it("identifies older versions as read-only instead of positional-approval candidates", () => {
    const previous = result();
    previous.manifest = {
      runId: "synthetic-legacy",
      pipelineVersion: "v2-lean.5",
      policyVersion: "v2-policy.2",
      frozenSeedIds: [],
      discoveryLensIds: [],
      supportingLensIds: [],
      targetCategories: [],
      retrievalTake: 20,
      attemptCeiling: 40,
      knownFamilyLinks: [],
    };
    delete previous.runId;
    assert.equal(isLegacyV2Replay(previous), true);
    assert.equal(buildRevisionInput(previous).correctionOf, "synthetic-legacy");
    assert.equal(isLegacyV2Replay(result()), false);
  });
});

describe("honest evidence citations", () => {
  it("does not invent citations for missing traces or provenance strings", () => {
    const previous = result();
    assert.deepEqual(
      recordedEvidenceIds(previous, ["synthetic:provenance", "a-1"]),
      [],
    );
  });

  it("links explicit IDs only and binds member relations to recorded retrievals", () => {
    const previous = result();
    previous.calls = ["call-1", "call-2"].map((id) => ({
      id,
      endpoint: "/v2/insights",
      method: "GET",
      params: {},
      status: 200,
      durationMs: 1,
      at: "2026-10-10T00:00:00Z",
      fromCache: false,
      response: [],
      attempts: 1,
    }));
    const entity = {
      id: "M1",
      name: "Synthetic member",
      type: "urn:entity:artist",
      position: 1,
      tags: [],
    };
    const group = {
      id: "n-1",
      coreMemberIds: ["M1"],
      members: [entity],
      sharedDescriptor: null,
      coherent: false,
      coverage: 2,
      corroboration: 1,
      pitchSupported: true,
      supportingEvidence: [],
      evidenceIds: ["call-1", "call-2"],
    };
    previous.retrievals = [
      {
        aspectId: "a-1",
        category: "urn:entity:artist",
        status: "ok",
        entities: [entity],
        queryProvenance: "call-2",
        callId: "call-1",
      },
      {
        aspectId: "a-2",
        category: "urn:entity:artist",
        status: "empty",
        entities: [],
        queryProvenance: "call-1",
        callId: "call-2",
      },
    ];
    assert.deepEqual(
      recordedEvidenceIds(previous, ["call-1", "missing", "call-1"]),
      ["call-1"],
    );
    assert.deepEqual(memberEvidenceIds(previous, group, "M1"), ["call-1"]);
    assert.deepEqual(memberEvidenceIds(previous, group, "missing"), []);
    assert.deepEqual(
      memberEvidenceIds(previous, { ...group, evidenceIds: undefined }, "M1"),
      [],
    );
  });

  it("redacts authentication recursively while retaining inspectable response data", () => {
    const formatted = evidenceJson({
      params: { query: "Synthetic reference", "X-Api-Key": "secret-1" },
      response: {
        results: [{ name: "Synthetic member", token: "secret-2" }],
        headers: { Authorization: "secret-3", "Set-Cookie": "secret-4" },
        link: "https://example.com?api_key=secret-5&query=synthetic",
      },
      error: "Bearer secret-6",
    });
    assert.doesNotMatch(formatted, /secret-[1-6]/);
    assert.match(formatted, /Synthetic member/);
    assert.match(formatted, /query=synthetic/);
    assert.match(formatted, /redacted/);
  });
});

describe("safe returned links and uncertain spend", () => {
  it("permits HTTP(S), never script/data/relative/credentialed links", () => {
    for (const link of [
      "javascript:alert(1)",
      "data:text/html,test",
      "//example.com",
      "/local",
      "https://user:password@example.com",
      "https://example.com/\nunsafe",
      "https:\\example.com",
    ]) {
      assert.equal(isSafeHttpLink(link), false, link);
    }
    assert.equal(
      isSafeHttpLink("https://example.com/synthetic?q=one#two"),
      true,
    );
    assert.equal(isSafeHttpLink("http://example.com"), true);
  });

  it("never promises zero spend when a response is lost", () => {
    assert.match(LOST_RESPONSE_MESSAGE, /usage is unknown/);
    assert.match(LOST_RESPONSE_MESSAGE, /retrying may spend/);
    assert.doesNotMatch(LOST_RESPONSE_MESSAGE, /nothing was spent|no.*spent/i);
  });
});
