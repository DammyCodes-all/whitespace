import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TASTE_FIXTURES } from "../fixtures/taste-lists.ts";
import type { AudienceTastes } from "../qloo/tastes.ts";
import { parseTastesEnvelope } from "../qloo/tastes.ts";
import { coverage, scoreFit, tagWeight } from "./fit.ts";
import { SAMPLE_PITCH_TAGS, SAMPLE_SUGGESTED_COUNT } from "./fixtures.ts";

function tastesFor(audienceId: string): AudienceTastes {
  const envelope = TASTE_FIXTURES[audienceId];
  assert.ok(envelope, `missing fixture ${audienceId}`);
  return parseTastesEnvelope(audienceId, envelope, `test-${audienceId}`);
}

describe("tagWeight", () => {
  it("doubles pinned tags at the same rank", () => {
    assert.equal(tagWeight(true, 2), 2 * tagWeight(false, 2));
    assert.equal(tagWeight(true, 1), 2);
    assert.equal(tagWeight(false, 1), 1);
  });
});

describe("scoreFit on fixtures", () => {
  it("scores the full-list hypothesis with zero (not no-data) for missing tags", () => {
    const result = scoreFit(SAMPLE_PITCH_TAGS, tastesFor("hyp"));
    assert.deepEqual(result.matchedTags, ["slow-burn", "space"]);
    assert.deepEqual(result.zeroTags, ["solitude", "quiet"]);
    assert.deepEqual(result.noDataTags, []);
    assert.ok(result.score > 0 && result.score < 1);
  });

  it("scores the short-list rival with no-data (not zero) for missing tags", () => {
    const result = scoreFit(SAMPLE_PITCH_TAGS, tastesFor("rival-lit"));
    assert.ok(result.matchedTags.includes("solitude"));
    assert.ok(result.noDataTags.includes("space"));
    assert.deepEqual(result.zeroTags, []);
  });

  it("treats a truncated long list as no-data", () => {
    const full = tastesFor("hyp");
    const truncated: AudienceTastes = { ...full, truncated: true };
    const result = scoreFit(SAMPLE_PITCH_TAGS, truncated);
    assert.deepEqual(result.zeroTags, []);
    assert.deepEqual(result.noDataTags.sort(), ["solitude", "quiet"].sort());
  });

  it("returns a perfect 1 when every tag matches at rank 1", () => {
    const tastes: AudienceTastes = {
      audienceId: "perfect",
      tastes: SAMPLE_PITCH_TAGS.map((t, i) => ({
        tag: t.tag,
        rank: 1,
        entityId: `x${i}`,
      })),
      totalReturned: 20,
      truncated: false,
      callId: "test",
    };
    // All four at rank 1 exceeds the possible weight, so it clamps to 1.
    assert.equal(scoreFit(SAMPLE_PITCH_TAGS, tastes).score, 1);
  });

  it("returns 0 with empty evidence on empty pitch tags instead of throwing", () => {
    const result = scoreFit([], tastesFor("hyp"));
    assert.equal(result.score, 0);
    assert.deepEqual(result.matchedTags, []);
    assert.deepEqual(result.zeroTags, []);
    assert.deepEqual(result.noDataTags, []);
  });

  it("keeps every score inside 0..1", () => {
    for (const id of ["hyp", "rival-lit", "rival-amb"]) {
      const s = scoreFit(SAMPLE_PITCH_TAGS, tastesFor(id)).score;
      assert.ok(s >= 0 && s <= 1, `${id} out of bounds: ${s}`);
    }
  });
});

describe("coverage", () => {
  it("reports matched over suggested", () => {
    assert.equal(
      coverage(SAMPLE_PITCH_TAGS.length, SAMPLE_SUGGESTED_COUNT),
      4 / 6,
    );
  });

  it("returns 0 when nothing was suggested", () => {
    assert.equal(coverage(0, 0), 0);
  });

  it("clamps above-1 input", () => {
    assert.equal(coverage(9, 6), 1);
  });
});
