import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RECORDED_FLOW_RESULT,
  RECORDED_FLOW_STEPS,
  RECORDED_NAMED_TITLES,
  RECORDED_RUN_META,
} from "./recorded-run.ts";

/**
 * The static sample is only credible if it stays a real run. These
 * assertions are the guard: no surprise, no mock traces, real grounding,
 * and the full call ledger the page advertises.
 */
describe("recorded sample run", () => {
  it("is a grounded live run, not a surprise fixture", () => {
    assert.equal(RECORDED_FLOW_RESULT.verdict, "strong");
    assert.equal(RECORDED_FLOW_RESULT.surprise, false);
    assert.equal(RECORDED_FLOW_RESULT.grounding?.ok, true);
    assert.equal(RECORDED_FLOW_RESULT.qlooCalls.mock ?? 0, 0);
    assert.equal(RECORDED_FLOW_RESULT.qlooCalls.total, 96);
  });

  it("keeps the page's advertised counts honest", () => {
    assert.deepEqual(RECORDED_NAMED_TITLES, ["Moon", "Arrival"]);
    assert.equal(RECORDED_RUN_META.audiences, 24);
    assert.equal(RECORDED_RUN_META.controls, 20);
    assert.equal(RECORDED_RUN_META.evidenceLines, 96);
    assert.equal(
      Object.keys(RECORDED_FLOW_RESULT.evidence).length,
      RECORDED_FLOW_RESULT.qlooCalls.total,
    );
  });

  it("carries the run ledger and a complete-looking step set", () => {
    assert.ok(RECORDED_FLOW_STEPS.length > 0);
    assert.ok(RECORDED_FLOW_STEPS.some((step) => step.id === "controls"));
    assert.ok(RECORDED_FLOW_STEPS.some((step) => step.id === "grounding"));
    assert.ok(
      Object.values(RECORDED_FLOW_RESULT.evidence).every(
        (line) => line.response.trim().length > 0,
      ),
    );
  });
});
