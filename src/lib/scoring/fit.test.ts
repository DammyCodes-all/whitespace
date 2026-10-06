import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TASTE_FIXTURES } from "../fixtures/taste-lists.ts";
import type { AudienceTastes } from "./fit.ts";
import {
  coverage,
  isUnjudgeable,
  rankStrength,
  scoreAll,
  scoreAudience,
} from "./fit.ts";
import { SAMPLE_PITCH_TAGS, SAMPLE_SUGGESTED_COUNT } from "./fixtures.ts";

/** Fixture tag ids in affinity order: position is the rank. */
function tagIdsFor(audienceId: string): string[] {
  const envelope = TASTE_FIXTURES[audienceId];
  assert.ok(envelope, `missing fixture ${audienceId}`);
  return [...envelope.results.entities]
    .sort((a, b) => b.affinity - a.affinity)
    .map((e) => e.tag_id);
}

function tastesFor(audienceId: string): AudienceTastes {
  return { audienceId, tagIds: tagIdsFor(audienceId) };
}

function approx(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `expected ~${expected}, got ${actual}`,
  );
}

describe("rankStrength", () => {
  it("scores rank 1 of N as 1 and rank N as 1/N", () => {
    assert.equal(rankStrength(1, 20), 1);
    assert.equal(rankStrength(20, 20), 1 / 20);
  });

  it("scores out-of-range ranks as 0", () => {
    assert.equal(rankStrength(0, 20), 0);
    assert.equal(rankStrength(21, 20), 0);
    assert.equal(rankStrength(1, 0), 0);
  });
});

describe("scoreAudience on fixtures", () => {
  it("scores the full-list hypothesis with zero (not no-data) for missing tags", () => {
    const result = scoreAudience(tastesFor("hyp"), SAMPLE_PITCH_TAGS);
    assert.deepEqual(result.matchedTags, ["slow-burn", "space"]);
    assert.deepEqual(result.zeroTags, ["solitude", "quiet"]);
    assert.deepEqual(result.noDataTags, []);
    // Pinned slow-burn at rank 2 of 20: 2*19/20. Space at rank 5: 16/20.
    approx(result.score, (2 * (19 / 20) + 16 / 20) / 5);
  });

  it("counts pinned must-haves double", () => {
    const unpinned = SAMPLE_PITCH_TAGS.map((t) => ({ ...t, pinned: false }));
    const pinned = scoreAudience(tastesFor("hyp"), SAMPLE_PITCH_TAGS).score;
    const plain = scoreAudience(tastesFor("hyp"), unpinned).score;
    assert.ok(pinned > plain);
  });

  it("reports every tag no-data on a short list", () => {
    const result = scoreAudience(tastesFor("rival-lit"), SAMPLE_PITCH_TAGS);
    assert.equal(result.score, 0);
    assert.deepEqual(result.matchedTags, []);
    assert.deepEqual(result.zeroTags, []);
    assert.deepEqual(result.noDataTags.map((t) => t).sort(), [
      "quiet",
      "slow-burn",
      "solitude",
      "space",
    ]);
    assert.equal(isUnjudgeable(result), true);
  });

  it("reports every tag no-data on a failed fetch", () => {
    const result = scoreAudience(
      { audienceId: "hyp", tagIds: [], failed: true },
      SAMPLE_PITCH_TAGS,
    );
    assert.equal(result.score, 0);
    assert.deepEqual(result.zeroTags, []);
    assert.equal(result.noDataTags.length, SAMPLE_PITCH_TAGS.length);
    assert.equal(isUnjudgeable(result), true);
  });

  it("honors a lowered judgement threshold", () => {
    const result = scoreAudience(tastesFor("rival-lit"), SAMPLE_PITCH_TAGS, {
      minTastesForJudgement: 5,
    });
    assert.deepEqual(result.matchedTags, ["slow-burn", "solitude", "quiet"]);
    assert.deepEqual(result.zeroTags, ["space"]);
    // Solitude rank 1 of 8, slow-burn rank 4 (pinned), quiet rank 5.
    approx(result.score, (1 + 2 * (5 / 8) + 4 / 8) / 5);
  });

  it("returns 0 with empty evidence on empty pitch tags instead of throwing", () => {
    const result = scoreAudience(tastesFor("hyp"), []);
    assert.equal(result.score, 0);
    assert.deepEqual(result.matchedTags, []);
    assert.deepEqual(result.zeroTags, []);
    assert.deepEqual(result.noDataTags, []);
  });

  it("keeps every score inside 0..1", () => {
    for (const id of ["hyp", "rival-lit", "rival-amb"]) {
      const s = scoreAudience(tastesFor(id), SAMPLE_PITCH_TAGS).score;
      assert.ok(s >= 0 && s <= 1, `${id} out of bounds: ${s}`);
    }
  });
});

describe("scoreAll", () => {
  it("scores every audience against one shared tag list", () => {
    const results = scoreAll(
      ["hyp", "rival-lit", "rival-amb"].map(tastesFor),
      SAMPLE_PITCH_TAGS,
    );
    assert.deepEqual(
      results.map((r) => r.audienceId),
      ["hyp", "rival-lit", "rival-amb"],
    );
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
