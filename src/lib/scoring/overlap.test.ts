import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideVerdict } from "../policy/verdict.ts";
import type { Audience, FitScore, ResolvedTitle } from "../types.ts";
import { eligibleControls, overlapRatio } from "./overlap.ts";

function title(qlooId: string): ResolvedTitle {
  return {
    query: qlooId,
    qlooId,
    name: qlooId,
    type: "urn:entity:movie",
  };
}

function audience(id: string, ids: string[]): Audience {
  return {
    id,
    kind: id === "hyp" ? "hypothesis" : "control",
    name: id,
    titles: ids.map(title),
    notFoundTitles: [],
  };
}

function judged(audienceId: string, score: number): FitScore {
  return {
    audienceId,
    score,
    matchedTags: ["x"],
    zeroTags: [],
    noDataTags: [],
  };
}

describe("eligibleControls pitch-aware ceiling", () => {
  it("excludes a neighbor control and keeps distant controls", () => {
    const hyp = audience("hyp", ["a", "b", "c", "d", "e", "f"]);
    const neighbor = audience("control-near", ["a", "b", "c"]);
    const farA = audience("control-far-a", ["g", "h", "i"]);
    const farB = audience("control-far-b", ["j", "k", "l"]);
    assert.ok(overlapRatio(neighbor, hyp) > 1 / 3);

    const result = eligibleControls(hyp, [neighbor, farA, farB]);
    assert.deepEqual(
      result.eligible.map((c) => c.id),
      ["control-far-a", "control-far-b"],
    );
    assert.deepEqual(
      result.excluded.map((c) => c.id),
      ["control-near"],
    );
    assert.equal(result.filtered, true);
    assert.equal(result.fellBack, false);
  });

  it("keeps a control at exactly one third overlap", () => {
    const hyp = audience("hyp", ["a", "b", "c", "d", "e", "f"]);
    const boundary = audience("control-edge", ["a", "b", "x", "y", "z", "w"]);
    assert.equal(overlapRatio(boundary, hyp), 1 / 3);

    const result = eligibleControls(hyp, [boundary]);
    assert.equal(result.eligible.length, 1);
    assert.equal(result.filtered, false);
  });

  it("falls back to the full set when every control is too close", () => {
    const hyp = audience("hyp", ["a", "b", "c", "d", "e", "f"]);
    const nearA = audience("control-a", ["a", "b", "c"]);
    const nearB = audience("control-b", ["d", "e", "f"]);

    const result = eligibleControls(hyp, [nearA, nearB]);
    assert.deepEqual(
      result.eligible.map((c) => c.id),
      ["control-a", "control-b"],
    );
    assert.equal(result.filtered, false);
    assert.equal(result.fellBack, true);
    assert.equal(result.excluded.length, 2);
  });

  it("verdict margin uses the filtered best, not the excluded neighbor", () => {
    // Top contender 0.60. Neighbor control 0.58 would hold the ceiling
    // (gap 0.02 -> Weak); the distant control 0.40 gives gap 0.20.
    const hyp = audience("hyp", ["a", "b", "c", "d", "e", "f"]);
    const neighbor = audience("control-near", ["a", "b", "c"]);
    const far = audience("control-far", ["g", "h", "i"]);
    const eligibility = eligibleControls(hyp, [neighbor, far]);
    assert.equal(eligibility.filtered, true);

    const allScores: FitScore[] = [
      judged("control-near", 0.58),
      judged("control-far", 0.4),
    ];
    const eligibleIds = new Set(eligibility.eligible.map((c) => c.id));
    const filteredScores = allScores.filter((s) =>
      eligibleIds.has(s.audienceId),
    );

    const before = decideVerdict({
      hypothesisId: "hyp",
      scores: [judged("hyp", 0.6)],
      controlScores: allScores,
      coverage: 0.9,
    });
    assert.equal(before.verdict, "Weak");

    const after = decideVerdict({
      hypothesisId: "hyp",
      scores: [judged("hyp", 0.6)],
      controlScores: filteredScores,
      coverage: 0.9,
    });
    assert.equal(after.verdict, "Strong");
    assert.ok(Math.abs(after.marginTopVsControl - 0.2) < 1e-9);
  });
});
