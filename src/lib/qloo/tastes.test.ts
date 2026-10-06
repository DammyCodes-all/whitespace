import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isUnjudgeable, scoreAudience } from "../scoring/fit.ts";
import type { Audience } from "../types.ts";
import { fetchAudienceTastes } from "./tastes.ts";

const TITLED: Audience = {
  id: "hyp",
  kind: "hypothesis",
  name: "Slow science-fiction",
  titles: [
    {
      query: "Moon",
      qlooId: "moon-id",
      name: "Moon",
      type: "urn:entity:movie",
    },
  ],
  notFoundTitles: [],
};

const TITLELESS: Audience = {
  ...TITLED,
  id: "empty",
  titles: [],
};

describe("fetchAudienceTastes", () => {
  it("reports a failed taste list with no call when the audience has no titles", async () => {
    const { tastes, call } = await fetchAudienceTastes(TITLELESS);
    assert.equal(tastes.audienceId, "empty");
    assert.deepEqual(tastes.tagIds, []);
    assert.equal(tastes.failed, true);
    assert.equal(call, null);
  });

  it("returns tastes plus a trace for a titled audience", async () => {
    const { tastes, call } = await fetchAudienceTastes(TITLED);
    assert.equal(tastes.audienceId, "hyp");
    assert.ok(Array.isArray(tastes.tagIds));
    assert.ok(call !== null && typeof call.endpoint === "string");
  });

  it("scores a titleless fetch as unjudgeable end to end", async () => {
    const { tastes } = await fetchAudienceTastes(TITLELESS);
    const fit = scoreAudience(tastes, []);
    assert.equal(isUnjudgeable(fit), false);
    const withTags = scoreAudience(tastes, [
      { tag: "x", qlooTagId: "urn:tag:y", pinned: false },
    ]);
    assert.equal(isUnjudgeable(withTags), true);
  });
});
