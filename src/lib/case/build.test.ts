import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PipelineResult } from "../types.ts";
import { buildCase, CASE_FOOTER } from "./build.ts";

function scored(id: string, score: number) {
  return {
    audienceId: id,
    score,
    matchedTags: ["urn:tag:genre:media:fiction"],
    zeroTags: [] as string[],
    noDataTags: [] as string[],
  };
}

function base(): PipelineResult {
  return {
    input: {
      pitchText: "A quiet film about a lonely worker. It is slow.",
      workType: "film",
      nothingLike: [],
    },
    hypothesis: {
      id: "hyp",
      kind: "hypothesis",
      name: "Hypothesis (film)",
      titles: [
        { query: "Moon", qlooId: "m1", name: "Moon", type: "urn:entity" },
      ],
      notFoundTitles: ["No Such Film Xyz"],
    },
    rivals: [],
    controls: [],
    tags: [
      { tag: "quiet", qlooTagId: "urn:tag:keyword:media:quiet", pinned: false },
    ],
    coverage: 0.5,
    scores: [scored("hyp", 0.4)],
    verdict: {
      verdict: "Weak",
      topAudienceId: "hyp",
      marginTopVsSecond: 0.4,
      marginTopVsControl: -0.1,
      clearsControl: false,
      surprise: false,
    },
    grounding: { ok: true, ungroundedTitles: [], ungroundedTags: [] },
    calls: [],
    steps: [
      {
        id: "hypothesis",
        label: "Hypothesis audience",
        status: "done",
        callId: "c1",
      },
      { id: "tags", label: "Pitch tags", status: "done" },
    ],
  };
}

describe("buildCase", () => {
  it("packs the one-pager: headline, audience, evidence, limits, footer", () => {
    const model = buildCase(base());
    assert.equal(model.pitchOneLiner, "A quiet film about a lonely worker");
    assert.equal(model.verdictHeadline, "Weak fit: no audience clears control");
    assert.deepEqual(model.topAudienceTitles, ["Moon"]);
    assert.ok(model.evidence.length >= 3 && model.evidence.length <= 5);
    assert.equal(model.evidence[0]?.callId, "c1");
    assert.ok(
      model.limits.some((l) => l.includes("No Such Film Xyz")),
      "names the not-found title",
    );
    assert.ok(
      model.limits.some((l) => l.includes("Only 50%")),
      "states the coverage shortfall",
    );
    assert.equal(model.footer, CASE_FOOTER);
  });

  it("announces the surprise headline on Strong", () => {
    const result = base();
    result.verdict = {
      verdict: "Strong",
      topAudienceId: "hyp",
      marginTopVsSecond: 0.3,
      marginTopVsControl: 0.2,
      clearsControl: true,
      surprise: true,
    };
    const model = buildCase(result);
    assert.ok(model.verdictHeadline.startsWith("Strong fit"));
    assert.equal(
      model.verdictSub,
      "Your best fit is not the audience you named.",
    );
  });

  it("explains Inconclusive from the reason, not a number", () => {
    const result = base();
    result.verdict = {
      verdict: "Inconclusive",
      topAudienceId: "hyp",
      marginTopVsSecond: 0,
      marginTopVsControl: 0,
      clearsControl: false,
      surprise: false,
      inconclusiveReason: "coverage",
    };
    const model = buildCase(result);
    assert.equal(model.verdictHeadline, "Inconclusive");
    assert.ok(model.verdictSub?.includes("too few pitch words"));
  });
});
