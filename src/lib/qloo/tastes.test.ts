import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchAudienceTastes, parseTastesEnvelope } from "./tastes.ts";

describe("parseTastesEnvelope", () => {
  it("ranks by affinity descending even when unsorted", () => {
    const result = parseTastesEnvelope(
      "x",
      {
        success: true,
        truncated: false,
        results: {
          entities: [
            { entity_id: "b", affinity: 0.5, tag_name: "second" },
            { entity_id: "a", affinity: 0.9, tag_name: "first" },
          ],
        },
      },
      "call-1",
    );
    assert.deepEqual(
      result.tastes.map((t) => t.tag),
      ["first", "second"],
    );
    assert.deepEqual(
      result.tastes.map((t) => t.rank),
      [1, 2],
    );
    assert.equal(result.totalReturned, 2);
    assert.equal(result.truncated, false);
    assert.equal(result.callId, "call-1");
  });
});

describe("fetchAudienceTastes", () => {
  it("serves every fixture audience with a trace ref", async () => {
    for (const id of ["hyp", "rival-lit", "rival-amb"]) {
      const tastes = await fetchAudienceTastes(id);
      assert.equal(tastes.audienceId, id);
      assert.ok(tastes.tastes.length > 0);
      assert.ok(tastes.callId.length > 0);
    }
  });

  it("fails loudly on unknown audience ids", async () => {
    await assert.rejects(() => fetchAudienceTastes("nope"), /No taste fixture/);
  });
});
