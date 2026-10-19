import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TAG_WORDS } from "../config.ts";
import {
  EXTRACT_TEMPERATURE,
  systemPrompt,
  toTagProposal,
} from "./extract-tags.ts";

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

  it("ignores any extra fields the model adds", () => {
    const out = toTagProposal({
      tags: FIVE,
      workType: "film",
      similarTitles: ["Dune", "Arrival"],
    });
    assert.deepEqual(out.words, [
      "science-fiction",
      "grief",
      "coastal town",
      "slow-burn",
      "solitude",
    ]);
    assert.equal(out.workType, "film");
    assert.ok(!("similarTitles" in out));
  });

  it("accepts a short-but-usable reply instead of failing the route", () => {
    // Four words: below TAG_WORDS.min but the flow gate (3 matched) can
    // still judge it, so the chips should render rather than a 502.
    const out = toTagProposal({
      tags: ["heist", "crew", "betrayal", "undercover"],
      workType: "film",
    });
    assert.equal(out.words.length, 4);
    assert.throws(() =>
      toTagProposal({ tags: ["one", "two"], workType: "film" }),
    );
  });
});

describe("systemPrompt", () => {
  const prompt = systemPrompt();

  it("asks for one fixed count, not a range", () => {
    assert.ok(prompt.includes(`exactly ${TAG_WORDS.max - 1} tags`));
    assert.ok(!prompt.includes(`${TAG_WORDS.min} and ${TAG_WORDS.max}`));
  });

  it("states word form, the plural rule and the plain-name rule", () => {
    assert.ok(prompt.includes("singular"));
    assert.ok(prompt.includes("no plurals"));
    assert.ok(prompt.includes("small town"));
  });

  it("keeps specific genre words and demotes broad buckets", () => {
    assert.ok(prompt.includes("cyberpunk"));
    assert.ok(prompt.includes("never broad buckets like thriller or drama"));
  });

  it("keeps the honesty fences (§7, §8)", () => {
    assert.ok(prompt.includes("Never name something the pitch is not about"));
    assert.ok(prompt.includes("No titles, no ids, no numbers"));
    assert.ok(prompt.includes("No claims about audiences"));
  });

  it("pins extraction to a deterministic temperature", () => {
    assert.equal(EXTRACT_TEMPERATURE, 0);
  });
});
