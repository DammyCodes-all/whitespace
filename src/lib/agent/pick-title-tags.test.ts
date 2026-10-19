import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LlmError,
  PICK_TEMPERATURE,
  pickTitleTags,
  systemPrompt,
  toPickResult,
} from "./pick-title-tags.ts";

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

  it("drops blank and duplicate ids, keeping order", () => {
    assert.deepEqual(
      toPickResult({ kept: ["id1", "  ", "id1", "id2", 42] }, IDS),
      ["id1", "id2"],
    );
  });

  it("aborts on an id the model was not offered instead of silently cutting", () => {
    // A model typo'd id used to vanish (a silent subtraction). It is
    // an output failure now: the pass aborts so the route fails open
    // with everything the model intended to keep.
    assert.throws(
      () => toPickResult({ kept: ["id1", "nope", "id2"] }, IDS),
      LlmError,
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

describe("pickTitleTags transport", () => {
  it("sends temperature 0 for a deterministic filter", async (t) => {
    // Synthetic key + stubbed transport: no live LLM call, no real
    // credential. Pins the 0-temp contract for the filter pass.
    const savedGroq = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = "synthetic-test-key";
    let seenBody: Record<string, unknown> = {};
    t.mock.method(
      globalThis,
      "fetch",
      async (_url: unknown, init: RequestInit) => {
        seenBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return Response.json({
          choices: [{ message: { content: '{"kept":["id1"]}' } }],
        });
      },
    );
    try {
      const out = await pickTitleTags({
        pitchText: "a quiet pitch",
        candidates: [{ qlooId: "id1", label: "Alpha", sourceTitleName: null }],
      });
      assert.deepEqual(out, ["id1"]);
      assert.equal(seenBody.temperature, 0);
      assert.equal(seenBody.temperature, PICK_TEMPERATURE);
    } finally {
      if (savedGroq === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = savedGroq;
    }
  });
});
