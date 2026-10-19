import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchConceptTastes } from "./concept.ts";

// No key in this env: keyless placeholder traces, so the suite never
// dials Qloo.
delete process.env.QLOO_API_KEY;

describe("fetchConceptTastes", () => {
  it("empty tag ids run no fetch and return failed tastes", async () => {
    const { tastes, call } = await fetchConceptTastes([]);
    assert.equal(tastes.audienceId, "concept");
    assert.deepEqual(tastes.tagIds, []);
    assert.equal(tastes.failed, true);
    assert.equal(call, null);
  });

  it("keyless path returns a traced placeholder, never data", async () => {
    const { tastes, call } = await fetchConceptTastes([
      "urn:tag:genre:media:science_fiction",
    ]);
    assert.equal(tastes.audienceId, "concept");
    assert.deepEqual(tastes.tagIds, []);
    assert.ok(call !== null);
    assert.equal(call.mock, true);
  });
});
