import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { segmentReachProse } from "./reach-highlight.ts";

describe("segmentReachProse", () => {
  it("picks the measured names out of the sentence", () => {
    const segments = segmentReachProse(
      "Mara Voss leads: a novelist of quiet, interior fiction.",
      ["Mara Voss", "Jonas Feld"],
    );
    assert.equal(segments[0]?.text, "Mara Voss");
    assert.equal(segments[0]?.strong, true);
    assert.equal(
      segments[1]?.text,
      " leads: a novelist of quiet, interior fiction.",
    );
    assert.equal(segments[1]?.strong, false);
  });

  it("matches the original casing, not the name's", () => {
    const segments = segmentReachProse(
      "Deep Dive Podcast is the first listen.",
      ["Deep Dive Podcast"],
    );
    assert.equal(segments[0]?.text, "Deep Dive Podcast");
    assert.equal(segments[0]?.strong, true);
  });

  it("never lights up a name inside a longer word", () => {
    const segments = segmentReachProse("The theater district heats up.", [
      "Heat",
    ]);
    assert.equal(
      segments.some((segment) => segment.strong),
      false,
    );
  });

  it("lights up the same name in any casing", () => {
    const segments = segmentReachProse("Slow Burn Audio comes next.", [
      "Slow Burn Audio",
    ]);
    assert.equal(segments[0]?.strong, true);
    const lower = segmentReachProse("mara voss leads.", ["Mara Voss"]);
    assert.equal(lower[0]?.strong, true);
  });

  it("lets the longest name win where two overlap", () => {
    const segments = segmentReachProse("Deep Dive Podcast came first.", [
      "Deep Dive",
      "Deep Dive Podcast",
    ]);
    assert.equal(segments[0]?.text, "Deep Dive Podcast");
    assert.equal(segments[0]?.strong, true);
  });

  it("skips names too short or too ordinary to mean anything", () => {
    const segments = segmentReachProse(
      "The art of the show and the art of it.",
      ["art", "the"],
    );
    assert.equal(
      segments.some((segment) => segment.strong),
      false,
    );
  });

  it("returns the whole line as plain prose when nothing matches", () => {
    const segments = segmentReachProse("Nothing here was measured.", [
      "Mara Voss",
    ]);
    assert.deepEqual(segments, [
      { text: "Nothing here was measured.", strong: false, id: "s0" },
    ]);
  });

  it("gives every segment a stable id", () => {
    const segments = segmentReachProse("Mara Voss, then Mara Voss again.", [
      "Mara Voss",
    ]);
    const ids = segments.map((segment) => segment.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
