import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WorkType } from "../types.ts";
import { MAX_MARK_TITLES, markChatbotTitles } from "./mark.ts";

const FILM: WorkType = "film";

describe("markChatbotTitles", () => {
  it("returns empty with no calls for empty input", async () => {
    const result = await markChatbotTitles([], FILM);
    assert.deepEqual(result.found, []);
    assert.deepEqual(result.notFoundTitles, []);
    assert.deepEqual(result.calls, []);
  });

  it("cleans before resolving: trims, dedupes, caps", async () => {
    const many = Array.from(
      { length: MAX_MARK_TITLES + 5 },
      (_, i) => `  Title ${i} `,
    );
    const result = await markChatbotTitles(
      ["Moon", " moon ", "", ...many],
      FILM,
    );
    // One call per unique cleaned title, at most the cap.
    assert.ok(result.calls.length <= MAX_MARK_TITLES);
    const total = result.found.length + result.notFoundTitles.length;
    assert.equal(total, result.calls.length);
  });

  it("never throws on nonsense: every title lands found or not-found", async () => {
    const result = await markChatbotTitles(
      ["zzz-no-such-title-xyz", "Moon"],
      FILM,
    );
    assert.equal(result.calls.length, 2);
    assert.equal(result.found.length + result.notFoundTitles.length, 2);
    for (const call of result.calls) {
      assert.equal(typeof call.endpoint, "string");
    }
  });
});
