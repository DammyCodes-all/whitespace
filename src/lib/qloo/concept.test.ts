import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchConceptTastes } from "./concept.ts";

// No key in this env: force the mock path so the suite never dials Qloo.
delete process.env.QLOO_API_KEY;

describe("fetchConceptTastes", () => {
  it("empty tag ids run no fetch and return failed tastes", async () => {
    const { tastes, call } = await fetchConceptTastes([]);
    assert.equal(tastes.audienceId, "concept");
    assert.deepEqual(tastes.tagIds, []);
    assert.equal(tastes.failed, true);
    assert.equal(call, null);
  });

  it("mock path returns a traced call without throwing", async () => {
    const { tastes, call } = await fetchConceptTastes([
      "urn:tag:genre:media:science_fiction",
    ]);
    assert.equal(tastes.audienceId, "concept");
    assert.ok(Array.isArray(tastes.tagIds));
    assert.ok(call !== null);
  });
});
