import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FitScore } from "../types.ts";
import { COVERAGE_FLOOR, decideVerdict } from "./verdict.ts";

function judged(
  audienceId: string,
  score: number,
  extra: Partial<FitScore> = {},
): FitScore {
  return {
    audienceId,
    score,
    matchedTags: ["x"],
    zeroTags: [],
    noDataTags: [],
    ...extra,
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

function controls(score: number): FitScore[] {
  return [judged("control-1", score)];
}

describe("decideVerdict control ceiling honesty", () => {
  it("never turns an unjudged control batch into a Strong", () => {
    // Every control is a placeholder 0 (unjudgeable). Before the fix
    // this read as a ceiling of 0 and the top audience cleared it.
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.5), judged("b", 0.2)],
      controlScores: [unjudged("control-1"), unjudged("control-2")],
      coverage: 0.9,
    });
    assert.equal(result.clearsControl, false);
    assert.equal(result.verdict, "Inconclusive");
    assert.equal(result.inconclusiveReason, "no-control");
  });

  it("still returns Weak when no control exists at all", () => {
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.9)],
      controlScores: [],
      coverage: 0.9,
    });
    assert.equal(result.verdict, "Weak");
  });

  it("uses the best JUDGEABLE control, ignoring placeholder 0s", () => {
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.5)],
      controlScores: [unjudged("control-1"), judged("control-2", 0.48)],
      coverage: 0.9,
    });
    // Ceiling 0.48, gap 0.02: below MARGIN, so Weak rather than Strong.
    assert.equal(result.clearsControl, false);
    assert.equal(result.verdict, "Weak");
  });

  it("returns Inconclusive/no-signal when the judgeable ceiling is exactly 0", () => {
    // The repeat-probe shape (2026-10-12): a top with real hits wins
    // against a baseline where no control matched anything — a
    // degraded Qloo window reads exactly this way, so it must never
    // be Strong.
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.5), judged("b", 0.2)],
      controlScores: [judged("control-1", 0), judged("control-2", 0)],
      coverage: 0.9,
    });
    assert.equal(result.verdict, "Inconclusive");
    assert.equal(result.inconclusiveReason, "no-signal");
    assert.equal(result.clearsControl, false);
  });

  it("returns no-signal instead of Weak when nothing matched anything", () => {
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0)],
      controlScores: [judged("control-1", 0)],
      coverage: 0.9,
    });
    assert.equal(result.verdict, "Inconclusive");
    assert.equal(result.inconclusiveReason, "no-signal");
  });
});

describe("decideVerdict margins", () => {
  it("ignores a failed runner-up instead of inflating the margin", () => {
    const result = decideVerdict({
      hypothesisId: "c",
      scores: [judged("a", 0.8), unjudged("b"), judged("c", 0.78)],
      controlScores: controls(0.1),
      coverage: 0.9,
    });
    // Real runner-up is c at 0.78: margin 0.02, both clear control.
    assert.equal(result.verdict, "Mixed");
    assert.ok(Math.abs(result.marginTopVsSecond - 0.02) < 1e-9);
  });

  it("returns Weak when there are no control scores", () => {
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.9)],
      controlScores: [],
      coverage: 0.9,
    });
    assert.equal(result.verdict, "Weak");
    assert.equal(result.clearsControl, false);
  });

  it("still returns Strong when the top clearly beats a real second", () => {
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.9), judged("c", 0.5)],
      controlScores: controls(0.1),
      coverage: 0.9,
    });
    assert.equal(result.verdict, "Strong");
    assert.ok(Math.abs(result.marginTopVsSecond - 0.4) < 1e-9);
  });
});

describe("decideVerdict inconclusive reasons", () => {
  it("names empty when there are no scores", () => {
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [],
      controlScores: [],
      coverage: 0.9,
    });
    assert.equal(result.verdict, "Inconclusive");
    assert.equal(result.inconclusiveReason, "empty");
    assert.equal(result.topAudienceId, null);
  });

  it("names coverage just below the floor, passes exactly at it", () => {
    const below = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.9)],
      controlScores: controls(0.1),
      coverage: COVERAGE_FLOOR - 0.001,
    });
    assert.equal(below.verdict, "Inconclusive");
    assert.equal(below.inconclusiveReason, "coverage");

    const atFloor = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.9)],
      controlScores: controls(0.1),
      coverage: COVERAGE_FLOOR,
    });
    assert.equal(atFloor.verdict, "Strong");
    assert.equal(atFloor.inconclusiveReason, undefined);
  });

  it("names nodata above half unjudgeable, passes exactly at half", () => {
    const over = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.9), unjudged("b"), unjudged("c")],
      controlScores: controls(0.1),
      coverage: 0.9,
    });
    assert.equal(over.verdict, "Inconclusive");
    assert.equal(over.inconclusiveReason, "nodata");

    const atHalf = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.9), unjudged("b")],
      controlScores: controls(0.1),
      coverage: 0.9,
    });
    assert.equal(atHalf.verdict, "Strong");
    assert.equal(atHalf.inconclusiveReason, undefined);
  });

  it("names top-unjudgeable when the placeholder 0 sorts first", () => {
    // Tie at 0 keeps input order (stable sort), so the unjudgeable
    // placeholder leads; share is 1/2, exactly at the gate.
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [unjudged("u"), judged("a", 0)],
      controlScores: controls(0.1),
      coverage: 0.9,
    });
    assert.equal(result.verdict, "Inconclusive");
    assert.equal(result.inconclusiveReason, "top-unjudgeable");
    assert.equal(result.topAudienceId, "u");
  });
});
