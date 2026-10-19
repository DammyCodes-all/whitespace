import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Audience, FitScore, VerdictResult } from "../types.ts";
import { selectReachTargets } from "./reach-targets.ts";

function audience(id: string): Audience {
  return { id, kind: "rival", name: id, titles: [], notFoundTitles: [] };
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

function unjudged(audienceId: string): FitScore {
  return {
    audienceId,
    score: 0,
    matchedTags: [],
    zeroTags: [],
    noDataTags: ["y"],
  };
}

function verdict(
  kind: VerdictResult["verdict"],
  topAudienceId: string | null,
): VerdictResult {
  return {
    verdict: kind,
    topAudienceId,
    marginTopVsSecond: 0,
    marginTopVsControl: 0,
    clearsControl: kind !== "Weak" && kind !== "Inconclusive",
    surprise: false,
  };
}

const AUDIENCES = [audience("hyp"), audience("a"), audience("b")];

describe("selectReachTargets", () => {
  it("returns only the top audience on Strong", () => {
    const targets = selectReachTargets(
      verdict("Strong", "a"),
      [judged("a", 0.8), judged("b", 0.5)],
      AUDIENCES,
    );
    assert.deepEqual(
      targets.map((t) => t.id),
      ["a"],
    );
  });

  it("returns only the top audience on Weak", () => {
    const targets = selectReachTargets(
      verdict("Weak", "hyp"),
      [judged("hyp", 0.2)],
      AUDIENCES,
    );
    assert.deepEqual(
      targets.map((t) => t.id),
      ["hyp"],
    );
  });

  it("returns top plus runner-up on Mixed", () => {
    const targets = selectReachTargets(
      verdict("Mixed", "a"),
      [judged("a", 0.8), judged("b", 0.78)],
      AUDIENCES,
    );
    assert.deepEqual(
      targets.map((t) => t.id),
      ["a", "b"],
    );
  });

  it("returns only the top when a Mixed verdict leans on its own titles", () => {
    // Mixed because the lead stops holding without the named titles'
    // tags: there is no close pair, so no second reach plan (2026-10-19).
    const leaned: VerdictResult = {
      ...verdict("Mixed", "a"),
      selfFit: "leans",
    };
    const targets = selectReachTargets(
      leaned,
      [judged("a", 0.8), judged("b", 0.4)],
      AUDIENCES,
    );
    assert.deepEqual(
      targets.map((t) => t.id),
      ["a"],
    );
  });

  it("skips an unjudgeable second for a real third on Mixed", () => {
    const targets = selectReachTargets(
      verdict("Mixed", "a"),
      [judged("a", 0.8), unjudged("b"), judged("hyp", 0.7)],
      AUDIENCES,
    );
    assert.deepEqual(
      targets.map((t) => t.id),
      ["a", "hyp"],
    );
  });

  it("returns only the top when no runner-up qualifies on Mixed", () => {
    const targets = selectReachTargets(
      verdict("Mixed", "a"),
      [judged("a", 0.8), unjudged("b")],
      [audience("a"), audience("b")],
    );
    assert.deepEqual(
      targets.map((t) => t.id),
      ["a"],
    );
  });

  it("returns nothing on Inconclusive", () => {
    assert.deepEqual(
      selectReachTargets(verdict("Inconclusive", "a"), [], AUDIENCES),
      [],
    );
  });

  it("returns nothing when the top audience is unknown", () => {
    assert.deepEqual(
      selectReachTargets(verdict("Strong", "ghost"), [], AUDIENCES),
      [],
    );
  });
});
