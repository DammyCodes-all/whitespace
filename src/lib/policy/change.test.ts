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
    );
    assert.equal(check.accepted, false);
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
    );
    assert.equal(strict.accepted, false);
    assert.equal(strict.failedCondition, "rise");
  });
});
