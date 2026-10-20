import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Audience, FitScore, VerdictResult } from "../types.ts";
import { reachTargets } from "./reach-plan.ts";

function audience(id: string): Audience {
  return { id, kind: "rival", name: id, titles: [], notFoundTitles: [] };
}

function measured(id: string, score: number): FitScore {
  return {
    audienceId: id,
    score,
    matchedTags: ["t1"],
    zeroTags: [],
    noDataTags: [],
  };
}

function verdict(overrides: Partial<VerdictResult> = {}): VerdictResult {
  return {
    verdict: "Mixed",
    topAudienceId: "top",
    marginTopVsSecond: 0.01,
    marginTopVsControl: 0.4,
    clearsControl: true,
    surprise: false,
    ...overrides,
  };
}

const AUDIENCES = [audience("top"), audience("runner-up")];

describe("reachTargets", () => {
  it("gives the winner the plan and nobody else on a Strong verdict", () => {
    const targets = reachTargets(
      verdict({ verdict: "Strong" }),
      [measured("top", 0.8), measured("runner-up", 0.2)],
      AUDIENCES,
      0.4,
    );
    assert.deepEqual(
      targets.map((a) => a.id),
      ["top"],
    );
  });

  it("gives the runner-up a plan when it cleared the line too", () => {
    const targets = reachTargets(
      verdict(),
      [measured("top", 0.8), measured("runner-up", 0.6)],
      AUDIENCES,
      0.4,
    );
    assert.deepEqual(
      targets.map((a) => a.id),
      ["top", "runner-up"],
    );
  });

  it("keeps the plan with the winner when the runner-up never cleared the line", () => {
    // The capped-verdict case (§6.7): the verdict reads Mixed by fiat,
    // so the runner-up — which never cleared the comparison line — gets
    // no plan and the run spends no extra call on it.
    const targets = reachTargets(
      verdict(),
      [measured("top", 0.8), measured("runner-up", 0.2)],
      AUDIENCES,
      0.5,
    );
    assert.deepEqual(
      targets.map((a) => a.id),
      ["top"],
    );
  });

  it("keeps a measured audience when no line was measured", () => {
    const targets = reachTargets(
      verdict(),
      [measured("top", 0.8), measured("runner-up", 0.2)],
      AUDIENCES,
      null,
    );
    assert.deepEqual(
      targets.map((a) => a.id),
      ["top", "runner-up"],
    );
  });
});
