import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LlmError, systemPrompt, toPickResult } from "./pick-title-tags.ts";

const IDS = ["id1", "id2", "id3"];

describe("toPickResult", () => {
  it("keeps a valid subset in order", () => {
    assert.deepEqual(toPickResult({ kept: ["id3", "id1"] }, IDS), [
      "id3",
      "id1",
    ]);
  });

  it("respects a valid empty list", () => {
    assert.deepEqual(toPickResult({ kept: [] }, IDS), []);
  });

  it("drops invented, blank and duplicate ids", () => {
    assert.deepEqual(
      toPickResult({ kept: ["id1", "nope", "  ", "id1", "id2", 42] }, IDS),
      ["id1", "id2"],
    );
  });

  it("throws on a missing array, a non-object and extra-field tolerance", () => {
    assert.throws(() => toPickResult({ kept: "id1" }, IDS));
    assert.throws(() => toPickResult("nope", IDS));
    // Extra fields are ignored, not rejected.
    assert.deepEqual(toPickResult({ kept: ["id2"], dropped: ["id1"] }, IDS), [
      "id2",
    ]);
  });

  it("throws LlmError (fail-open signal for the route)", () => {
    assert.throws(() => toPickResult({}, IDS), LlmError);
  });
});

describe("systemPrompt", () => {
  it("pins the bar with a worked keep and two worked cuts", () => {
    const prompt = systemPrompt();
    assert.ok(
      prompt.includes("Keep `psychological drama`"),
      "keep example went missing",
    );
    assert.ok(
      prompt.includes("Cut `crime documentary`"),
      "fiction-vs-documentary cut went missing",
    );
    assert.ok(
      prompt.includes("Cut `dark comedy`"),
      "contradiction cut went missing",
    );
  });
});
