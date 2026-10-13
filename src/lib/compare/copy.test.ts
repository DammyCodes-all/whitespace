/**
 * buildCopy: the card says what the fields say. Each case pins the exact
 * sentences so a copy edit that drifts from the numbers fails loudly.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCopy, cap, pct } from "./copy.ts";

const BEST = { label: "Literary fiction about isolation", score: 0.72 };
const RUNNER_UP = { label: "Slow science-fiction", score: 0.61 };
const TITLES = ["Never Let Me Go"];

describe("buildCopy", () => {
  it("Strong states every score outright, with only on the control", () => {
    const copy = buildCopy({
      verdict: "Strong",
      best: BEST,
      controlScore: 0.44,
      runnerUp: RUNNER_UP,
      titles: TITLES,
    });
    assert.equal(copy.badge, "Strong fit");
    assert.deepEqual(copy.body, [
      "Literary fiction about isolation fits your idea best.",
      "Their taste matches your idea at 72%.",
      "An unrelated group matches it at only 44%.",
      "Slow science-fiction matches it at 61%.",
    ]);
    assert.equal(copy.source, "Based on the title you named: Never Let Me Go");
  });

  it("Mixed hedges the win and never says only", () => {
    const copy = buildCopy({
      verdict: "Mixed",
      best: BEST,
      controlScore: 0.44,
      runnerUp: RUNNER_UP,
      titles: TITLES,
    });
    assert.equal(copy.badge, "Mixed fit");
    assert.equal(
      copy.body[0],
      "Literary fiction about isolation fits your idea best, but not by much.",
    );
    assert.ok(!copy.body.join(" ").includes("only"));
  });

  it("Weak names no winner and drops the runner-up", () => {
    const copy = buildCopy({
      verdict: "Weak",
      best: BEST,
      controlScore: 0.44,
      runnerUp: RUNNER_UP,
      titles: TITLES,
    });
    assert.equal(copy.badge, "Weak fit");
    assert.deepEqual(copy.body, [
      "No audience stands out for your idea.",
      "The closest is Literary fiction about isolation at 72%.",
      "An unrelated group matches it at 44%.",
    ]);
    assert.ok(!copy.body.join(" ").includes("only"));
  });

  it("drops the runner-up sentence when there is none", () => {
    const copy = buildCopy({
      verdict: "Strong",
      best: BEST,
      controlScore: 0.44,
      runnerUp: null,
      titles: TITLES,
    });
    assert.equal(copy.body.length, 3);
    assert.ok(!copy.body.join(" ").includes("Slow science-fiction"));
  });

  it("omits the source line when no titles were named", () => {
    const copy = buildCopy({
      verdict: "Strong",
      best: BEST,
      controlScore: 0.44,
      runnerUp: null,
      titles: [],
    });
    assert.equal(copy.source, null);
  });

  it("uses the singular source line for one title", () => {
    const copy = buildCopy({
      verdict: "Strong",
      best: BEST,
      controlScore: 0.44,
      runnerUp: null,
      titles: ["Never Let Me Go"],
    });
    assert.equal(copy.source, "Based on the title you named: Never Let Me Go");
  });

  it("joins three titles with commas, no dangling punctuation", () => {
    const copy = buildCopy({
      verdict: "Strong",
      best: BEST,
      controlScore: 0.44,
      runnerUp: null,
      titles: ["Never Let Me Go", "Arrival", "Moon"],
    });
    assert.equal(
      copy.source,
      "Based on the titles you named: Never Let Me Go, Arrival, Moon",
    );
    assert.ok(!copy.source.endsWith(","));
  });

  it("capitalises lowercase labels at sentence starts", () => {
    const copy = buildCopy({
      verdict: "Strong",
      best: { label: "slow science-fiction", score: 0.61 },
      controlScore: 0.44,
      runnerUp: { label: "ambient music listeners", score: 0.33 },
      titles: [],
    });
    assert.ok(copy.body[0]?.startsWith("Slow science-fiction fits"));
    assert.ok(
      copy.body[3]?.startsWith("Ambient music listeners matches"),
    );
  });

  it("rounds 0.716 to 72% in the single rounding helper", () => {
    assert.equal(pct(0.716), 72);
    const copy = buildCopy({
      verdict: "Strong",
      best: { label: "Slow science-fiction", score: 0.716 },
      controlScore: 0.444,
      runnerUp: null,
      titles: [],
    });
    assert.ok(copy.body[1]?.includes("at 72%"));
    assert.ok(copy.body[2]?.includes("at only 44%"));
  });

  it("withholds numbers for Inconclusive but keeps the source", () => {
    const copy = buildCopy({
      verdict: "Inconclusive",
      best: null,
      controlScore: null,
      runnerUp: null,
      titles: TITLES,
    });
    assert.equal(copy.badge, "Inconclusive");
    assert.ok(!copy.body.join(" ").match(/\d/));
    assert.equal(copy.source, "Based on the title you named: Never Let Me Go");
  });

  it("cap leaves empty labels alone", () => {
    assert.equal(cap(""), "");
    assert.equal(cap("a"), "A");
  });
});
