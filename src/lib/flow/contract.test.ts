import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Audience, PipelineResult, QlooCall } from "../types.ts";
import { barRows, isMockRun, toFlowResult } from "./contract.ts";

function call(id: string, fromCache = false): QlooCall {
  return {
    id,
    endpoint: "/v2/insights",
    method: "GET",
    params: { take: "50" },
    status: 200,
    durationMs: 10,
    at: "2026-10-10T00:00:00.000Z",
    fromCache,
    responseSummary: "{}",
    responseBody: "{}",
  };
}

function measured(audienceId: string, score: number) {
  return {
    audienceId,
    score,
    matchedTags: ["t1"],
    zeroTags: ["t2"],
    noDataTags: [],
  };
}

function unjudgeable(audienceId: string) {
  return {
    audienceId,
    score: 0,
    matchedTags: [],
    zeroTags: [],
    noDataTags: ["t1", "t2"],
  };
}

function audience(
  id: string,
  kind: "hypothesis" | "rival" | "control",
): Audience {
  return { id, kind, name: id, titles: [], notFoundTitles: [] };
}

function base(): PipelineResult {
  return {
    input: { pitchText: "pitch", workType: "film", nothingLike: [] },
    hypothesis: { ...audience("hyp", "hypothesis") },
    rivals: [{ ...audience("rival-1", "rival") }],
    controls: [
      { ...audience("control-1", "control") },
      { ...audience("control-2", "control") },
    ],
    tags: [{ tag: "t1", qlooTagId: "urn:t1", pinned: false }],
    notFoundWords: ["nope"],
    coverage: 0.5,
    scores: [],
    verdict: {
      verdict: "Strong",
      topAudienceId: "hyp",
      marginTopVsSecond: 0.2,
      marginTopVsControl: 0.2,
      clearsControl: true,
      surprise: false,
    },
    grounding: { ok: true, ungroundedTitles: [], ungroundedTags: [] },
    calls: [call("c1"), call("c2", true)],
    steps: [
      { id: "hypothesis", label: "h", status: "done", callId: "c1" },
      { id: "rivals", label: "r", status: "done", callId: "c1" },
      { id: "controls", label: "c", status: "done", callId: "c1" },
      { id: "tastes", label: "t", status: "done", callId: "c1" },
    ],
  };
}

describe("toFlowResult", () => {
  it("maps verdict, roles, tags, ceiling, and call usage", () => {
    const pipeline = {
      ...base(),
      scores: [
        measured("hyp", 0.8),
        measured("rival-1", 0.5),
        measured("control-1", 0.6),
        measured("control-2", 0.4),
      ],
    };
    const out = toFlowResult(pipeline);
    assert.equal(out.verdict, "strong");
    assert.equal(out.surprise, false);
    assert.deepEqual(
      out.audiences.map((a) => a.role),
      ["named", "rival", "control", "control"],
    );
    assert.deepEqual(out.tags, [
      { label: "t1", qlooId: "urn:t1", status: "matched", source: "pitch" },
      { label: "nope", status: "not_found", source: "pitch" },
    ]);
    assert.equal(out.tags[1]?.qlooId, undefined);
    assert.equal(out.ceiling, 0.6);
    assert.deepEqual(out.qlooCalls, {
      network: 1,
      cached: 1,
      total: 2,
      mock: 0,
    });
    assert.equal(out.evidence.c1?.response, "{}");
    assert.equal(out.evidence.c1?.mock, false);
    assert.equal(out.grounding?.ok, true);
  });

  it("reports keyless placeholders as mock, never as live calls", () => {
    const mockCall = (id: string): QlooCall => ({
      ...call(id),
      status: 0,
      fromCache: false,
      mock: true,
      responseBody: '{"mock":true,"results":[]}',
    });
    const out = toFlowResult({
      ...base(),
      calls: [mockCall("m1"), mockCall("m2")],
    });
    assert.deepEqual(out.qlooCalls, {
      network: 0,
      cached: 0,
      total: 2,
      mock: 2,
    });
    assert.equal(isMockRun(out), true);
    assert.equal(out.evidence.m1?.mock, true);
  });

  it("carries the grounding failure through, never a literal ok", () => {
    const grounding = {
      ok: false,
      ungroundedTitles: ["urn:fake"],
      ungroundedTags: [],
    };
    const out = toFlowResult({ ...base(), grounding });
    assert.deepEqual(out.grounding, grounding);
  });

  it("carries title provenance onto matched tags, pitch by default", () => {
    const pipeline = {
      ...base(),
      tags: [
        { tag: "t1", qlooTagId: "urn:t1", pinned: false },
        { tag: "Slow Burn", qlooTagId: "urn:moon1", pinned: false },
      ],
    };
    const out = toFlowResult(
      pipeline,
      {},
      {
        "urn:moon1": { titleId: "moon-id", titleName: "Moon" },
      },
    );
    assert.deepEqual(out.tags[0]?.source, "pitch");
    assert.deepEqual(out.tags[1]?.source, {
      titleId: "moon-id",
      titleName: "Moon",
    });
  });

  it("never lets a placeholder 0 reach a bar: unjudgeable scores become null", () => {
    const pipeline = {
      ...base(),
      scores: [
        measured("hyp", 0.8),
        unjudgeable("rival-1"),
        measured("control-1", 0.6),
        unjudgeable("control-2"),
      ],
    };
    const out = toFlowResult(pipeline);
    const rival = out.audiences.find((a) => a.id === "rival-1");
    assert.equal(rival?.score, null);
    assert.deepEqual(rival?.tagHits, []);
    const rows = barRows(out);
    assert.deepEqual(
      rows.map((r) => [r.id, r.score]),
      [["hyp", 0.8]],
    );
    assert.ok(!rows.some((r) => r.role === "control"));
    assert.equal(out.ceiling, 0.6);
  });

  it("ceiling is null (not 0) when no control was judgeable", () => {
    const pipeline = {
      ...base(),
      scores: [
        measured("hyp", 0.8),
        measured("rival-1", 0.5),
        unjudgeable("control-1"),
        unjudgeable("control-2"),
      ],
    };
    const out = toFlowResult(pipeline);
    assert.equal(out.ceiling, null);
  });

  it("computes gaps for reach targets from already-fetched tastes", () => {
    const pipeline = {
      ...base(),
      scores: [
        measured("hyp", 0.8),
        measured("rival-1", 0.5),
        measured("control-1", 0.6),
        measured("control-2", 0.4),
      ],
    };
    const out = toFlowResult(pipeline, {
      tastesByAudienceId: {
        hyp: {
          audienceId: "hyp",
          tagIds: ["urn:t1", "urn:t2", "urn:t3"],
          tagNames: ["T1", "T2", "T3"],
        },
      },
    });
    assert.ok(out.gaps.length >= 1);
    const first = out.gaps[0];
    assert.equal(first?.audienceId, "hyp");
    assert.equal(first?.hasTastes, true);
    // urn:t1 is pitched, so only the unpitched tastes are gaps.
    assert.deepEqual(
      first?.gaps.map((g) => g.label),
      ["T2", "T3"],
    );
    assert.equal(first?.unlabeledCount, 0);
  });

  it("reports unknown loves when the target has no tastes", () => {
    const pipeline = {
      ...base(),
      scores: [
        measured("hyp", 0.8),
        measured("rival-1", 0.5),
        measured("control-1", 0.6),
        measured("control-2", 0.4),
      ],
    };
    const out = toFlowResult(pipeline);
    assert.ok(out.gaps.length >= 1);
    assert.equal(out.gaps[0]?.hasTastes, false);
    assert.deepEqual(out.gaps[0]?.gaps, []);
  });

  it("reach is null and gaps are empty when nothing beats the ceiling", () => {
    const pipeline = {
      ...base(),
      verdict: {
        ...base().verdict,
        verdict: "Weak" as const,
        clearsControl: false,
      },
      scores: [
        measured("hyp", 0.3),
        measured("rival-1", 0.2),
        measured("control-1", 0.6),
        measured("control-2", 0.4),
      ],
    };
    const out = toFlowResult(pipeline, {
      tastesByAudienceId: {
        hyp: { audienceId: "hyp", tagIds: ["urn:t1"], tagNames: ["T1"] },
      },
    });
    assert.equal(out.verdict, "weak");
    assert.equal(out.reach, null);
    assert.deepEqual(out.gaps, []);
  });

  it("no placeholder 0 reaches a reach list: unjudgeable targets are skipped", () => {
    const pipeline = {
      ...base(),
      scores: [
        unjudgeable("hyp"),
        measured("rival-1", 0.9),
        measured("control-1", 0.6),
        measured("control-2", 0.4),
      ],
      verdict: {
        ...base().verdict,
        verdict: "Strong" as const,
        topAudienceId: "rival-1",
        surprise: true,
      },
    };
    const out = toFlowResult(pipeline, {
      tastesByAudienceId: {
        hyp: { audienceId: "hyp", tagIds: [], failed: true },
        "rival-1": {
          audienceId: "rival-1",
          tagIds: ["urn:t1", "urn:t2"],
          tagNames: ["T1", "T2"],
        },
      },
      relatedByAudienceId: {
        "rival-1": [
          {
            kind: "person",
            items: [
              {
                entityId: "p1",
                name: "Somebody",
                kind: "person",
                description: "A person from Qloo.",
                affinityRank: 1,
                callId: "c9",
              },
            ],
            call: call("c9"),
          },
        ],
      },
      reachCalls: [call("c9")],
    });
    assert.equal(out.surprise, true);
    assert.ok(out.reach !== null && out.reach.length === 1);
    assert.equal(out.reach[0]?.audienceId, "rival-1");
    assert.deepEqual(
      out.reach[0]?.interests.map((i) => i.name),
      ["T1", "T2"],
    );
    assert.equal(out.reach[0]?.people[0]?.evidenceId, "c9");
    assert.equal(out.reach[0]?.people[0]?.description, "A person from Qloo.");
    assert.ok(out.evidence.c9 !== undefined);
  });
});
