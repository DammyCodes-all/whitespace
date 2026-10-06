import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PITCH_PACK } from "./pitch-pack.ts";

const WORK_TYPES = new Set(["film", "music", "book", "game"]);

describe("pitch pack", () => {
  it("holds four entries with distinct names", () => {
    assert.equal(PITCH_PACK.length, 4);
    assert.equal(new Set(PITCH_PACK.map((p) => p.name)).size, 4);
  });

  it("keeps every entry structurally valid for the pipeline", () => {
    for (const entry of PITCH_PACK) {
      assert.ok(entry.intended.length > 0, `${entry.name} needs intent`);
      const input = entry.input;
      assert.ok(input.pitchText.trim() !== "", `${entry.name} needs text`);
      assert.ok(WORK_TYPES.has(input.workType), `${entry.name} work type`);
      assert.ok(input.similarTitles.length >= 1, `${entry.name} titles`);
      assert.ok(input.candidateWords.length >= 1, `${entry.name} words`);
      assert.ok(
        input.rivalProposals.length >= 2,
        `${entry.name} rival proposals`,
      );
      const candidates = new Set(input.candidateWords);
      for (const pinned of input.pinnedWords ?? []) {
        assert.ok(
          candidates.has(pinned),
          `${entry.name}: pinned "${pinned}" not in candidates`,
        );
      }
      for (const rival of input.rivalProposals) {
        assert.ok(
          rival.titles.length >= 1,
          `${entry.name}: rival ${rival.id} needs titles`,
        );
      }
    }
  });
});
