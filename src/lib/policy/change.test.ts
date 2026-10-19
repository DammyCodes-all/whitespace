import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FitScore } from "../types.ts";
import { checkChange } from "./change.ts";

function fit(audienceId: string, score: number): FitScore {
  return {
    audienceId,
    score,
    matchedTags: ["x"],
    zeroTags: [],
    noDataTags: [],
  };
}

const BAR = { minRise: 0.05, requireControl: true };
/** The winner's lead over the strongest comparison did not shrink. */
const HELD = { before: 0.2, after: 0.3 };

describe("checkChange", () => {
  it("accepts when every condition holds", () => {
    const check = checkChange(
      BAR,
      fit("a", 0.6),
      fit("a", 0.7),
      0.8,
      0.8,
      true,
      true,
      HELD,
    );
    assert.equal(check.accepted, true);
    assert.equal(check.failedCondition, undefined);
    assert.equal(check.before, 0.6);
    assert.equal(check.after, 0.7);
  });

  it("withholds on insufficient rise and names it", () => {
    const check = checkChange(
      BAR,
      fit("a", 0.6),
      fit("a", 0.62),
      0.8,
      0.8,
      true,
      true,
      HELD,
    );
    assert.equal(check.accepted, false);
    assert.equal(check.failedCondition, "rise");
  });

  it("withholds when the rewrite lifts the field more than the winner", () => {
    // The winner rose a full 0.1, but its lead over the strongest
    // comparison shrank: the rewrite widened the crowd, not the fit
    // (fix 5). The rise bar alone would have accepted this.
    const check = checkChange(
      BAR,
      fit("a", 0.6),
      fit("a", 0.7),
      0.8,
      0.8,
      true,
      true,
      { before: 0.3, after: 0.1 },
    );
    assert.equal(check.accepted, false);
    assert.equal(check.failedCondition, "separation");
  });

  it("accepts a hold-the-lead rewrite", () => {
    const check = checkChange(
      BAR,
      fit("a", 0.6),
      fit("a", 0.7),
      0.8,
      0.8,
      true,
      true,
      { before: 0.3, after: 0.3 },
    );
    assert.equal(check.accepted, true);
  });

  it("accepts a rise that clears the recorded share on a large pool", () => {
    // 0.03 is under the 0.05 floor but 15% of where the fit stood:
    // the scale-aware side of the bar (2026-10-19).
    const check = checkChange(
      { minRise: 0.05, minShare: 0.1, requireControl: true },
      fit("a", 0.2),
      fit("a", 0.23),
      0.8,
      0.8,
      true,
      true,
      HELD,
    );
    assert.equal(check.accepted, true);
  });

  it("refuses a rise below both sides of the bar", () => {
    const check = checkChange(
      { minRise: 0.05, minShare: 0.1, requireControl: true },
      fit("a", 0.2),
      fit("a", 0.21),
      0.8,
      0.8,
      true,
      true,
      HELD,
    );
    assert.equal(check.failedCondition, "rise");
  });

  it("withholds on falling coverage and names it", () => {
    const check = checkChange(
      BAR,
      fit("a", 0.6),
      fit("a", 0.8),
      0.8,
      0.7,
      true,
      true,
      HELD,
    );
    assert.equal(check.accepted, false);
    assert.equal(check.failedCondition, "coverage");
  });

  it("withholds on ungrounded tags and names it", () => {
    const check = checkChange(
      BAR,
      fit("a", 0.6),
      fit("a", 0.8),
      0.8,
      0.8,
      false,
      true,
      HELD,
    );
    assert.equal(check.accepted, false);
    assert.equal(check.failedCondition, "grounding");
  });

  it("withholds on lost control and names it", () => {
    const check = checkChange(
      BAR,
      fit("a", 0.6),
      fit("a", 0.8),
      0.8,
      0.8,
      true,
      false,
      HELD,
    );
    assert.equal(check.accepted, false);
    assert.equal(check.failedCondition, "control");
  });

  it("reports the first failure when several hold", () => {
    const check = checkChange(
      BAR,
      fit("a", 0.6),
      fit("a", 0.61),
      0.8,
      0.5,
      false,
      false,
      HELD,
    );
    assert.equal(check.failedCondition, "rise");
  });

  it("evaluates the passed bar, never a recomputed one", () => {
    const strict = checkChange(
      { minRise: 0.5, requireControl: false },
      fit("a", 0.6),
      fit("a", 0.8),
      0.8,
      0.8,
      true,
      true,
      HELD,
    );
    assert.equal(strict.accepted, false);
    assert.equal(strict.failedCondition, "rise");
  });
});
