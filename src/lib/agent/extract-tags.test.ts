import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TAG_WORDS } from "../config.ts";
import { toTagWords } from "./extract-tags.ts";

const FIVE = [
  " Science-Fiction ",
  "GRIEF",
  "coastal town",
  "slow-burn",
  "solitude",
];

describe("toTagWords", () => {
  it("keeps lowercase, pitch-shaped words", () => {
    const out = toTagWords({ tags: FIVE });
    assert.deepEqual(out, [
      "science-fiction",
      "grief",
      "coastal town",
      "slow-burn",
      "solitude",
    ]);
  });

  it("rejects a short list, a missing array and a non-object", () => {
    assert.throws(() => toTagWords({ tags: ["one", "two"] }));
    assert.throws(() => toTagWords({ words: ["a"] }));
    assert.throws(() => toTagWords("nope"));
  });

  it("dedupes case and separator variants", () => {
    const out = toTagWords({
      tags: [
        "slow burn",
        "Slow-Burn",
        "slow  burn",
        "quiet",
        "grief",
        "coastal town",
        "science fiction",
      ],
    });
    assert.deepEqual(out, [
      "slow burn",
      "quiet",
      "grief",
      "coastal town",
      "science fiction",
    ]);
  });

  it("caps at TAG_WORDS.max", () => {
    const many = Array.from({ length: 12 }, (_, i) => `w${i}`);
    const out = toTagWords({ tags: many });
    assert.equal(out.length, TAG_WORDS.max);
  });

  it("keeps extra words above the minimum", () => {
    const out = toTagWords({ tags: [...FIVE, "x", "science fiction"] });
    // "science-fiction" and "science fiction" are the same concept, so
    // the dedupe keeps one: 6 unique words total.
    assert.equal(out.length, 6);
  });
});
