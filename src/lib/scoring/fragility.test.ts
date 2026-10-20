import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { VerdictResult } from "../types.ts";
import {
  assessFragility,
  FRAGILITY_MIN_GAP,
  findFragileRound,
  type HoldOutRound,
} from "./fragility.ts";

function round(overrides: Partial<HoldOutRound> = {}): HoldOutRound {
  return {
    titleName: "Moon",
    droppedTags: 12,
    namedFull: 0.82,
    namedReduced: 0,
    fieldFull: 0.82,
    fieldReduced: 1,
    ...overrides,
  };
}

function verdict(overrides: Partial<VerdictResult> = {}): VerdictResult {
  return {
    verdict: "Strong",
    topAudienceId: "hyp",
    marginTopVsSecond: 0.7,
    marginTopVsControl: 0.7,
    clearsControl: true,
    surprise: false,
    ...overrides,
  };
}

describe("findFragileRound", () => {
  it("is never fragile without a hold-out round", () => {
    assert.equal(findFragileRound([]), null);
  });

  it("is not fragile when the field drops at least as far as the named audience", () => {
    // Same drop on both sides: the field leans on the removal just as
    // much, so nothing is fragile.
    assert.equal(
      findFragileRound([round({ fieldReduced: 0, fieldFull: 0.82 })]),
      null,
    );
  });

  it("is fragile when a round drops the named audience further than the field", () => {
    const found = findFragileRound([round()]);
    assert.ok(found !== null);
    assert.equal(found?.titleName, "Moon");
    assert.ok(Math.abs((found?.namedDrop ?? 0) - 0.82) < 1e-9);
    assert.ok(Math.abs((found?.fieldDrop ?? 0) + 0.18) < 1e-9);
    assert.ok(Math.abs((found?.gap ?? 0) - 1) < 1e-9);
  });

  it("ignores a gap below one point at the displayed precision", () => {
    // The named audience drops 0.009 more than the field: display noise.
    assert.equal(
      findFragileRound([
        round({
          namedFull: 0.5,
          namedReduced: 0.491,
          fieldFull: 0.5,
          fieldReduced: 0.5,
        }),
      ]),
      null,
    );
  });

  it("reads a gap of exactly one point as a signal", () => {
    const found = findFragileRound([
      round({
        namedFull: 0.5,
        namedReduced: 0.49,
        fieldFull: 0.5,
        fieldReduced: 0.5,
      }),
    ]);
    assert.ok(found !== null);
    assert.ok((found?.gap ?? 0) >= FRAGILITY_MIN_GAP);
  });

  it("names the worst round when more than one is fragile", () => {
    const found = findFragileRound([
      round({ titleName: "Moon", namedReduced: 0.3 }),
      round({ titleName: "Arrival", namedReduced: 0 }),
    ]);
    assert.equal(found?.titleName, "Arrival");
  });

  it("skips a round it could not read: no data is never a zero", () => {
    assert.equal(findFragileRound([round({ namedReduced: null })]), null);
    assert.equal(findFragileRound([round({ fieldReduced: null })]), null);
  });
});

describe("assessFragility", () => {
  it("reports no fragility without a round", () => {
    const finding = assessFragility({
      rounds: [],
      verdict: verdict(),
      hypothesisId: "hyp",
    });
    assert.equal(finding.fragile, false);
    assert.equal(finding.capped, false);
    assert.equal(finding.note, "");
    assert.equal(finding.round, null);
  });

  it("caps a Strong verdict about the named audience and says why", () => {
    const finding = assessFragility({
      rounds: [round()],
      verdict: verdict(),
      hypothesisId: "hyp",
    });
    assert.equal(finding.fragile, true);
    assert.equal(finding.capped, true);
    // The reason names the title and what it did, to both sides.
    assert.match(finding.note, /Moon/);
    assert.match(finding.note, /0\.82 → 0\.00/);
    assert.match(finding.note, /0\.82 → 1\.00/);
    assert.match(finding.note, /capped at Mixed fit \(was Strong fit\)/);
  });

  it("leaves a verdict that is not Strong alone", () => {
    const finding = assessFragility({
      rounds: [round()],
      verdict: verdict({ verdict: "Mixed" }),
      hypothesisId: "hyp",
    });
    assert.equal(finding.fragile, true);
    assert.equal(finding.capped, false);
    assert.match(finding.note, /Not capped/);
    assert.ok(!finding.note.includes("capped at Mixed fit"));
  });

  it("leaves a rival's verdict alone", () => {
    const finding = assessFragility({
      rounds: [round()],
      verdict: verdict({ topAudienceId: "rival-1" }),
      hypothesisId: "hyp",
    });
    assert.equal(finding.fragile, true);
    assert.equal(finding.capped, false);
    assert.match(finding.note, /Not capped/);
  });

  it("does not cap a run whose named audience was never judged", () => {
    const finding = assessFragility({
      rounds: [round({ namedFull: null, namedReduced: null })],
      verdict: verdict(),
      hypothesisId: "hyp",
    });
    assert.equal(finding.fragile, false);
    assert.equal(finding.capped, false);
  });
});
