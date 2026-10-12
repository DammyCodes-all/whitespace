import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TAG_WORDS } from "../config.ts";
import { toTagProposal } from "./extract-tags.ts";

const FIVE = [
  " Science-Fiction ",
  "GRIEF",
  "coastal town",
  "slow-burn",
  "solitude",
];

describe("toTagProposal", () => {
  it("keeps lowercase, pitch-shaped words plus the detected type", () => {
    const out = toTagProposal({ tags: FIVE, workType: "film" });
    assert.deepEqual(out.words, [
      "science-fiction",
      "grief",
      "coastal town",
      "slow-burn",
      "solitude",
    ]);
    assert.equal(out.workType, "film");
  });

  it("accepts each of the four types", () => {
    for (const workType of ["film", "music", "book", "game"]) {
      assert.equal(toTagProposal({ tags: FIVE, workType }).workType, workType);
    }
  });

  it("rejects a short list, a missing array, a non-object and a bad type", () => {
    assert.throws(() =>
      toTagProposal({ tags: ["one", "two"], workType: "film" }),
    );
    assert.throws(() => toTagProposal({ words: ["a"], workType: "film" }));
    assert.throws(() => toTagProposal("nope"));
    assert.throws(() => toTagProposal({ tags: FIVE, workType: "opera" }));
    assert.throws(() => toTagProposal({ tags: FIVE }));
  });

  it("dedupes case and separator variants", () => {
    const out = toTagProposal({
      tags: [
        "slow burn",
        "Slow-Burn",
        "slow  burn",
        "quiet",
        "grief",
        "coastal town",
        "science fiction",
      ],
      workType: "music",
    });
    assert.deepEqual(out.words, [
      "slow burn",
      "quiet",
      "grief",
      "coastal town",
      "science fiction",
    ]);
  });

  it("caps at TAG_WORDS.max", () => {
    const many = Array.from({ length: 12 }, (_, i) => `w${i}`);
    const out = toTagProposal({ tags: many, workType: "book" });
    assert.equal(out.words.length, TAG_WORDS.max);
  });

  it("keeps honest title suggestions, trimmed and capped", () => {
    const out = toTagProposal({
      tags: FIVE,
      workType: "film",
      similarTitles: [
        " Blade Runner 2049 ",
        "The Matrix",
        "blade runner 2049",
        "Ghost in the Shell",
        "Arrival",
        "Dune",
        "Interstellar",
      ],
    });
    assert.deepEqual(out.similarTitles, [
      "Blade Runner 2049",
      "The Matrix",
      "Ghost in the Shell",
      "Arrival",
      "Dune",
    ]);
  });

  it("treats missing or malformed suggestions as no suggestions, never a failure", () => {
    assert.deepEqual(
      toTagProposal({ tags: FIVE, workType: "film" }).similarTitles,
      [],
    );
    assert.deepEqual(
      toTagProposal({ tags: FIVE, workType: "film", similarTitles: "Dune" })
        .similarTitles,
      [],
    );
    assert.deepEqual(
      toTagProposal({
        tags: FIVE,
        workType: "film",
        similarTitles: ["", 42, "x".repeat(81), "Dune", null],
      }).similarTitles,
      ["Dune"],
    );
  });
});
