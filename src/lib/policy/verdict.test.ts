import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MIN_JUDGEABLE_CONTROLS,
  MIN_MATCHED_TAGS,
  SPLIT_SHARE,
} from "../config.ts";
import type { FitScore } from "../types.ts";
import { decideVerdict, testAgainstControls } from "./verdict.ts";

function judged(
  audienceId: string,
  score: number,
  extra: Partial<FitScore> = {},
): FitScore {
  return {
    audienceId,
    score,
    matchedTags: ["x", "y"],
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

/**
 * A measured field of the size the run actually compares against:
 * MIN_JUDGEABLE_CONTROLS judgeable controls, all below `top`.
 */
function field(score: number, count = MIN_JUDGEABLE_CONTROLS): FitScore[] {
  return Array.from({ length: count }, (_, index) =>
    judged(`control-${index + 1}`, score),
  );
}

const POOLED = { pooledTags: MIN_MATCHED_TAGS };

describe("decideVerdict comparison-field honesty", () => {
  it("never turns an unjudgeable control batch into a Strong", () => {
    // Every control is a placeholder 0 (unjudgeable). Before the fix
    // this read as a ceiling of 0 and the top audience cleared it.
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.5), judged("b", 0.2)],
      controlScores: [
        unjudged("control-1"),
        unjudged("control-2"),
        unjudged("control-3"),
      ],
      ...POOLED,
    });
    assert.equal(result.clearsControl, false);
    assert.equal(result.verdict, "Inconclusive");
    assert.equal(result.inconclusiveReason, "no-control");
  });

  it("abstains when the field was never measured at all", () => {
    // Was Weak: "no controls exist" read as "measured and low".
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.9)],
      controlScores: [],
      ...POOLED,
    });
    assert.equal(result.verdict, "Inconclusive");
    assert.equal(result.inconclusiveReason, "no-control");
  });

  it("abstains when fewer judgeable controls than the floor", () => {
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.9)],
      controlScores: field(0.1, MIN_JUDGEABLE_CONTROLS - 1),
      ...POOLED,
    });
    assert.equal(result.verdict, "Inconclusive");
    assert.equal(result.inconclusiveReason, "no-control");
  });

  it("returns Weak when a measured comparison audience wins", () => {
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.5)],
      controlScores: [judged("control-1", 0.6), ...field(0.1, 7)],
      ...POOLED,
    });
    assert.equal(result.verdict, "Weak");
    assert.equal(result.clearsControl, false);
    assert.equal(result.controlsBeaten?.beaten, 7);
    assert.equal(result.controlsBeaten?.total, 8);
  });

  it("returns Inconclusive/no-signal when the strongest comparison hit nothing", () => {
    // The repeat-probe shape (2026-10-12): a top with real hits wins
    // against a baseline where no control matched anything — a
    // degraded Qloo window reads exactly this way, so it must never
    // be Strong.
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.5), judged("b", 0.2)],
      controlScores: [
        judged("control-1", 0, { matchedTags: [] }),
        ...field(0, 7),
      ],
      ...POOLED,
    });
    assert.equal(result.verdict, "Inconclusive");
    assert.equal(result.inconclusiveReason, "no-signal");
    assert.equal(result.clearsControl, false);
  });

  it("returns no-signal when the strongest comparison holds one lucky tag", () => {
    // One hit in a 60-tag pool is 1.7% of the pool: a lucky draw, not a
    // baseline, so the run abstains rather than claiming a win (fix 2).
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.5)],
      controlScores: [
        judged("control-1", 0.4, { matchedTags: ["x"] }),
        ...field(0.2, MIN_JUDGEABLE_CONTROLS - 1),
      ],
      pooledTags: 60,
    });
    assert.equal(result.verdict, "Inconclusive");
    assert.equal(result.inconclusiveReason, "no-signal");
  });

  it("accepts one hit as a real bar on a tiny pitch-only pool", () => {
    // On a 3-tag reduced set, one hit is a third of the pool — the
    // floor scales, so a small set is not punished for being small.
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.5)],
      controlScores: field(0.1).map((fit, index) => ({
        ...fit,
        matchedTags: index === 0 ? ["x"] : [],
      })),
      pooledTags: 3,
    });
    assert.equal(result.verdict, "Strong");
    assert.deepEqual(result.controlsBeaten, {
      beaten: MIN_JUDGEABLE_CONTROLS,
      total: MIN_JUDGEABLE_CONTROLS,
    });
  });
});

describe("decideVerdict is rank-based, not gap-based", () => {
  it("clears control by any clear margin, whatever the pool size", () => {
    // The old rule needed a fixed 0.05 gap, which a 60-tag mean can
    // never produce. Same field, same ranking, smaller scale: the
    // verdict must not move.
    const wide = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.0137), judged("b", 0.001)],
      controlScores: field(0.0113),
      ...POOLED,
    });
    assert.equal(wide.verdict, "Strong");
    assert.equal(wide.controlsBeaten?.beaten, MIN_JUDGEABLE_CONTROLS);
    assert.equal(wide.controlsBeaten?.total, MIN_JUDGEABLE_CONTROLS);
  });

  it("does not clear when a single comparison audience scores higher", () => {
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.21)],
      controlScores: [judged("control-1", 0.22), ...field(0.1, 7)],
      ...POOLED,
    });
    assert.equal(result.verdict, "Weak");
    assert.equal(result.clearsControl, false);
    assert.equal(result.controlsBeaten?.beaten, 7);
  });

  it("counts a tie with the strongest comparison as no win", () => {
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.3)],
      controlScores: [judged("control-1", 0.3), ...field(0.1, 7)],
      ...POOLED,
    });
    assert.equal(result.verdict, "Weak");
    assert.equal(result.controlsBeaten?.beaten, 7);
  });

  it("makes the strangers baseline one more comparison, not the only one", () => {
    // Far above every control: an audience that beats the controls but
    // not strangers has not cleared the field.
    const controls = field(0.1);
    const stranger = judged("far", 0.5);
    const beatsControlsOnly = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.3)],
      controlScores: controls,
      strangerScore: stranger,
      ...POOLED,
    });
    assert.equal(beatsControlsOnly.verdict, "Weak");
    assert.equal(beatsControlsOnly.controlsBeaten?.total, 9);

    const beatsAll = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.6)],
      controlScores: controls,
      strangerScore: stranger,
      ...POOLED,
    });
    assert.equal(beatsAll.verdict, "Strong");
    assert.equal(beatsAll.controlsBeaten?.total, 9);
  });

  it("ignores an unjudgeable strangers baseline rather than counting it", () => {
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.3)],
      controlScores: field(0.1),
      strangerScore: unjudged("far"),
      ...POOLED,
    });
    assert.equal(result.verdict, "Strong");
    assert.equal(result.controlsBeaten?.total, MIN_JUDGEABLE_CONTROLS);
  });
});

describe("decideVerdict margins", () => {
  it("ignores a failed runner-up instead of inflating the margin", () => {
    const result = decideVerdict({
      hypothesisId: "c",
      scores: [judged("a", 0.8), unjudged("b"), judged("c", 0.2)],
      controlScores: field(0.1),
      ...POOLED,
    });
    // Real runner-up is c at 0.2: margin 0.6, clearly ahead.
    assert.equal(result.verdict, "Strong");
    assert.ok(Math.abs((result.marginTopVsSecond ?? 0) - 0.6) < 1e-9);
  });

  it("never calls a photo-finish Strong", () => {
    // Top 0.21, runner-up 0.20, field 0.16: the old rule let a 0.01
    // lead through whenever it cleared the control line (fix 4). The
    // lead is 5% of the winner's own score — inside SPLIT_SHARE.
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.21), judged("b", 0.2)],
      controlScores: field(0.16),
      ...POOLED,
    });
    assert.equal(result.verdict, "Mixed");
    assert.ok((result.marginTopVsSecond ?? 1) < SPLIT_SHARE * 0.21);
  });

  it("calls the same relationship Strong at a small pool scale", () => {
    // 0.0137 over 0.001 is a 93% lead — the K=60 version of the same
    // result that reads 0.89 over 0.05 at K=12. Scale must not decide.
    const small = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.89), judged("b", 0.05)],
      controlScores: field(0.16),
      ...POOLED,
    });
    const big = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.0137), judged("b", 0.001)],
      controlScores: field(0.0026),
      ...POOLED,
    });
    assert.equal(small.verdict, "Strong");
    assert.equal(big.verdict, "Strong");
  });

  it("returns Strong when the top clearly beats a real second", () => {
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.9), judged("c", 0.5)],
      controlScores: field(0.1),
      ...POOLED,
    });
    assert.equal(result.verdict, "Strong");
    assert.ok(Math.abs((result.marginTopVsSecond ?? 0) - 0.4) < 1e-9);
  });

  it("reports no runner-up margin when nothing else was measured", () => {
    // Was the top's own score printed as a margin, which reads as a
    // lead over nobody (fix 4).
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.9)],
      controlScores: field(0.1),
      ...POOLED,
    });
    assert.equal(result.verdict, "Strong");
    assert.equal(result.marginTopVsSecond, null);
  });
});

describe("decideVerdict self-fit gate", () => {
  it("confirms a lead that survives without the titles' own tags", () => {
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.9), judged("b", 0.2)],
      controlScores: field(0.1),
      selfFit: "confirmed",
      ...POOLED,
    });
    assert.equal(result.verdict, "Strong");
    assert.equal(result.selfFit, "confirmed");
  });

  it("downgrades a confirmed-on-own-gifts lead to Mixed", () => {
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.9), judged("b", 0.2)],
      controlScores: field(0.1),
      selfFit: "leans",
      ...POOLED,
    });
    assert.equal(result.verdict, "Mixed");
    assert.equal(result.selfFit, "leans");
  });

  it("abstains when the lead cannot be checked at all", () => {
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.9), judged("b", 0.2)],
      controlScores: field(0.1),
      selfFit: "unverified",
      ...POOLED,
    });
    assert.equal(result.verdict, "Inconclusive");
    assert.equal(result.inconclusiveReason, "self-fit");
    assert.equal(result.clearsControl, false);
    assert.equal(result.selfFit, "unverified");
  });
});

describe("decideVerdict pool sufficiency (fix 7)", () => {
  it("abstains on a pool too thin to score", () => {
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.9)],
      controlScores: field(0.1),
      pooledTags: MIN_MATCHED_TAGS - 1,
    });
    assert.equal(result.verdict, "Inconclusive");
    assert.equal(result.inconclusiveReason, "pool-thin");
  });

  it("does not gate on the pitch-word match rate any more", () => {
    // One of six words matched (17%, under the old 0.34 floor) but the
    // titles carried the pool: the run is judged, not refused.
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.9)],
      controlScores: field(0.1),
      pooledTags: 12,
    });
    assert.equal(result.verdict, "Strong");
    assert.equal(result.inconclusiveReason, undefined);
  });
});

describe("decideVerdict inconclusive reasons", () => {
  it("names empty when there are no scores", () => {
    const result = decideVerdict({
      hypothesisId: "a",
      scores: [],
      controlScores: [],
      ...POOLED,
    });
    assert.equal(result.verdict, "Inconclusive");
    assert.equal(result.inconclusiveReason, "empty");
    assert.equal(result.topAudienceId, null);
  });

  it("names nodata above half unjudgeable, passes exactly at half", () => {
    const over = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.9), unjudged("b"), unjudged("c")],
      controlScores: field(0.1),
      ...POOLED,
    });
    assert.equal(over.verdict, "Inconclusive");
    assert.equal(over.inconclusiveReason, "nodata");

    const atHalf = decideVerdict({
      hypothesisId: "a",
      scores: [judged("a", 0.9), unjudged("b")],
      controlScores: field(0.1),
      ...POOLED,
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
      controlScores: field(0.1),
      ...POOLED,
    });
    assert.equal(result.verdict, "Inconclusive");
    assert.equal(result.inconclusiveReason, "top-unjudgeable");
    assert.equal(result.topAudienceId, "u");
  });
});

describe("testAgainstControls", () => {
  it("is the same rule the verdict uses, reusable on its own", () => {
    const controls = field(0.1);
    const test = testAgainstControls(0.2, controls, judged("far", 0.15));
    assert.equal(test.clears, true);
    assert.equal(test.beaten, 9);
    assert.equal(test.total, 9);
    assert.equal(test.ceiling, 0.15);
    assert.equal(test.reason, undefined);
  });

  it("names the unusable field instead of returning a false win", () => {
    const noControl = testAgainstControls(0.9, [unjudged("c1")], null);
    assert.equal(noControl.clears, false);
    assert.equal(noControl.reason, "no-control");

    const noSignal = testAgainstControls(
      0.9,
      field(0).map((fit) => ({ ...fit, matchedTags: [] })),
      null,
    );
    assert.equal(noSignal.clears, false);
    assert.equal(noSignal.reason, "no-signal");
  });

  it("honours overrides, so tests can pin the floors", () => {
    const test = testAgainstControls(0.9, [judged("c1", 0.1)], null, {
      minJudgeableControls: 1,
      minCeilingHits: 1,
    });
    assert.equal(test.clears, true);
  });
});
