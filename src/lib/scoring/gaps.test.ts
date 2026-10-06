import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TAG_LABELS } from "../fixtures/tag-labels.ts";
import { TASTE_FIXTURES } from "../fixtures/taste-lists.ts";
import type { AudienceTastes } from "./fit.ts";
import { SAMPLE_PITCH_TAGS } from "./fixtures.ts";
import { countUnlabeled, findGaps } from "./gaps.ts";

/** Fixture tag ids in affinity order, mirroring the Q parser contract. */
function tagIdsFor(audienceId: string): string[] {
  const envelope = TASTE_FIXTURES[audienceId];
  assert.ok(envelope, `missing fixture ${audienceId}`);
  const seen = new Set<string>();
  const ids: string[] = [];
  const sorted = [...envelope.results.entities].sort(
    (a, b) => b.affinity - a.affinity,
  );
  for (const e of sorted) {
    if (!seen.has(e.tag_id)) {
      seen.add(e.tag_id);
      ids.push(e.tag_id);
    }
  }
  return ids;
}

function tastesFor(audienceId: string): AudienceTastes {
  return { audienceId, tagIds: tagIdsFor(audienceId) };
}

describe("findGaps", () => {
  it("excludes pitch-covered tags, pinned or not", () => {
    const gaps = findGaps(tastesFor("hyp"), SAMPLE_PITCH_TAGS, TAG_LABELS);
    const covered = new Set(SAMPLE_PITCH_TAGS.map((t) => t.qlooTagId));
    assert.ok(gaps.length > 0);
    assert.ok(gaps.every((g) => !covered.has(g.tagId)));
    // Pinned slow-burn is covered, so it must not appear as a gap.
    assert.ok(gaps.every((g) => g.tagId !== "urn:tag:mood:media:slow_burn"));
  });

  it("orders by rank ascending and caps at topN", () => {
    const gaps = findGaps(tastesFor("hyp"), [], TAG_LABELS, 2);
    assert.equal(gaps.length, 2);
    assert.ok(gaps[0].rank < gaps[1].rank);
    assert.equal(gaps[0].rank, 1);
  });

  it("returns every gap when the audience is fully uncovered", () => {
    const gaps = findGaps(tastesFor("rival-amb"), [], TAG_LABELS);
    assert.equal(gaps.length, 6);
    assert.deepEqual(
      gaps.map((g) => g.rank),
      [1, 2, 3, 4, 5, 6],
    );
  });

  it("returns empty on failed or empty tastes instead of throwing", () => {
    assert.deepEqual(
      findGaps(
        { audienceId: "x", tagIds: [], failed: true },
        SAMPLE_PITCH_TAGS,
        TAG_LABELS,
      ),
      [],
    );
    assert.deepEqual(
      findGaps({ audienceId: "x", tagIds: [] }, SAMPLE_PITCH_TAGS, TAG_LABELS),
      [],
    );
  });

  it("returns empty when the audience is fully spoken-to", () => {
    const all = tagIdsFor("rival-amb").map((tagId, i) => ({
      tag: `t${i}`,
      qlooTagId: tagId,
      pinned: false,
    }));
    assert.deepEqual(findGaps(tastesFor("rival-amb"), all, TAG_LABELS), []);
  });

  it("takes the best rank once for duplicated tag ids", () => {
    const gaps = findGaps(
      { audienceId: "x", tagIds: ["urn:a", "urn:b", "urn:a"] },
      [],
      { "urn:a": "A", "urn:b": "B" },
    );
    assert.deepEqual(
      gaps.map((g) => [g.tagId, g.rank]),
      [
        ["urn:a", 1],
        ["urn:b", 2],
      ],
    );
  });
});

describe("countUnlabeled", () => {
  it("counts skipped tags the gaps omit", () => {
    const tastes = tastesFor("hyp");
    const partial = { ...TAG_LABELS };
    delete partial["urn:tag:mood:media:bleak"];
    delete partial["urn:tag:mood:media:cerebral"];
    assert.equal(countUnlabeled(tastes, SAMPLE_PITCH_TAGS, partial), 2);
    // ...and findGaps omits exactly those two.
    const gaps = findGaps(tastes, SAMPLE_PITCH_TAGS, partial);
    assert.ok(
      gaps.every(
        (g) =>
          g.tagId !== "urn:tag:mood:media:bleak" &&
          g.tagId !== "urn:tag:mood:media:cerebral",
      ),
    );
  });

  it("returns 0 on failed tastes", () => {
    assert.equal(
      countUnlabeled(
        { audienceId: "x", tagIds: [], failed: true },
        SAMPLE_PITCH_TAGS,
        TAG_LABELS,
      ),
      0,
    );
  });
});
