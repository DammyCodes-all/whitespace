import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HypTaste } from "./expansion.ts";
import { covers, EXPANSION_WEIGHT, selectExpansions } from "./expansion.ts";

const OUTER: HypTaste = {
  id: "urn:tag:keyword:media:outer_space",
  name: "Outer Space",
};
const GENRE_SPACE: HypTaste = {
  id: "urn:tag:genre:media:space",
  name: "Space",
};

describe("covers", () => {
  it("matches full token containment", () => {
    assert.equal(covers("space", "Outer Space"), true);
    assert.equal(covers("space", "Space"), true);
    assert.equal(covers("folk-horror", "Folk Horror"), true);
  });

  it("rejects partial and empty matches", () => {
    assert.equal(covers("space", "Outer Reaches"), false);
    assert.equal(covers("future", "Post Apocalypse"), false);
    assert.equal(covers("", "Space"), false);
    assert.equal(covers("space", ""), false);
  });
});

describe("selectExpansions", () => {
  it("borrows the highest-ranked covering taste", () => {
    const out = selectExpansions(
      ["space"],
      [GENRE_SPACE, OUTER],
      new Set(["urn:tag:genre:media:space"]),
    );
    assert.deepEqual(out, [
      { word: "space", qlooTagId: OUTER.id, name: "Outer Space" },
    ]);
    assert.equal(EXPANSION_WEIGHT, 0.5);
  });

  it("returns nothing when no top taste covers the word", () => {
    const out = selectExpansions(
      ["future"],
      [{ id: "urn:tag:x", name: "Post Apocalypse" }],
      new Set(),
    );
    assert.deepEqual(out, []);
  });

  it("never borrows the same id twice", () => {
    const out = selectExpansions(
      ["space", "outer space"],
      [OUTER],
      new Set(),
      5,
    );
    assert.deepEqual(
      out.map((e) => e.word),
      ["space"],
    );
  });

  it("caps at MAX_EXPANSIONS across words", () => {
    const top: HypTaste[] = ["a", "b", "c"].map((w) => ({
      id: `urn:tag:${w}`,
      name: `Word ${w}`,
    }));
    const out = selectExpansions(["a", "b", "c"], top, new Set(), 2);
    assert.equal(out.length, 2);
  });

  it("handles empty inputs without throwing", () => {
    assert.deepEqual(selectExpansions([], [OUTER], new Set()), []);
    assert.deepEqual(selectExpansions(["space"], [], new Set()), []);
  });

  it("borrows nothing without ever matching an already-scored id", () => {
    const out = selectExpansions(["space"], [OUTER], new Set([OUTER.id]));
    assert.deepEqual(out, []);
  });
});
