import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { INTEREST_TRIM, interestsFromTastes } from "./interests.ts";

describe("interestsFromTastes", () => {
  it("returns the top tags in rank order with names", () => {
    const out = interestsFromTastes({
      audienceId: "control-1",
      tagIds: ["urn:a", "urn:b", "urn:c"],
      tagNames: ["Alpha", "Beta", "Gamma"],
    });
    assert.deepEqual(out, [
      { tagId: "urn:a", name: "Alpha", rank: 1 },
      { tagId: "urn:b", name: "Beta", rank: 2 },
      { tagId: "urn:c", name: "Gamma", rank: 3 },
    ]);
  });

  it("trims to five with no extra fetch", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `urn:t${i}`);
    const out = interestsFromTastes({ audienceId: "x", tagIds: ids });
    assert.equal(out.length, INTEREST_TRIM);
    assert.equal(out[4]?.rank, 5);
  });

  it("returns [] for failed or empty taste lists (not-measured, never zero-fill)", () => {
    assert.deepEqual(
      interestsFromTastes({ audienceId: "x", tagIds: [], failed: true }),
      [],
    );
    assert.deepEqual(interestsFromTastes({ audienceId: "x", tagIds: [] }), []);
  });
});
