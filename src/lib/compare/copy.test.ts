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
const TAGS = ["isolation", "grief", "slow burn"];

describe("buildCopy", () => {
  it("Strong states every score outright in plain sentences, with only on the control", () => {
    const copy = buildCopy({
      verdict: "Strong",
      best: BEST,
      controlScore: 0.44,
      runnerUp: RUNNER_UP,
      titles: TITLES,
      matchedTags: TAGS,
    });
    assert.equal(copy.badge, "Strong fit");
    assert.deepEqual(copy.body, [
      "Literary fiction about isolation fits this idea best. Qloo tastes put them at 72%. Strangers land at only 44%.",
      "Slow science-fiction sits at 61% too.",
      "What landed: isolation, grief, slow burn.",
    ]);
    assert.equal(
      copy.source,
      "Checked against the title you named: Never Let Me Go.",
    );
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
      "Literary fiction about isolation leads at 72%, but not by much. Strangers sit at 44%.",
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
      "No audience stands out here. Closest is Literary fiction about isolation at 72%.",
      "Strangers match it at 44%. Flat room.",
    ]);
    assert.ok(!copy.body.join(" ").includes("only"));
  });

  it("names a rival runner-up as a second checked crowd", () => {
    const copy = buildCopy({
      verdict: "Strong",
      best: BEST,
      controlScore: 0.44,
      runnerUp: { ...RUNNER_UP, role: "rival" },
      titles: TITLES,
    });
    assert.equal(
      copy.body[1],
      "And a rival reads it too: Slow science-fiction at 61%. Two crowds, both checked.",
    );
  });

  it("reads a named runner-up as the backing benchmark", () => {
    const copy = buildCopy({
      verdict: "Mixed",
      best: { ...BEST, role: "rival" },
      controlScore: 0.44,
      runnerUp: { ...RUNNER_UP, role: "named" },
      titles: TITLES,
    });
    assert.equal(
      copy.body[1],
      "Your comparables back it up: Slow science-fiction at 61% on the same tastes.",
    );
  });

  it("keeps the plain runner-up line when roles are unknown", () => {
    const copy = buildCopy({
      verdict: "Strong",
      best: BEST,
      controlScore: 0.44,
      runnerUp: RUNNER_UP,
      titles: TITLES,
    });
    assert.equal(copy.body[1], "Slow science-fiction sits at 61% too.");
  });

  it("drops the runner-up sentence when there is none", () => {
    const copy = buildCopy({
      verdict: "Strong",
      best: BEST,
      controlScore: 0.44,
      runnerUp: null,
      titles: TITLES,
    });
    assert.equal(copy.body.length, 1);
    assert.ok(!copy.body.join(" ").includes("Slow science-fiction"));
  });

  it("names the overlap tags when the top audience has hits", () => {
    const copy = buildCopy({
      verdict: "Strong",
      best: BEST,
      controlScore: 0.44,
      runnerUp: null,
      titles: TITLES,
      matchedTags: ["isolation", "grief"],
    });
    assert.equal(
      copy.body[copy.body.length - 1],
      "What landed: isolation, grief.",
    );
  });

  it("skips the overlap line when nothing matched", () => {
    const copy = buildCopy({
      verdict: "Strong",
      best: BEST,
      controlScore: 0.44,
      runnerUp: null,
      titles: TITLES,
      matchedTags: [],
    });
    assert.ok(!copy.body.join(" ").includes("What landed"));
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
    assert.equal(
      copy.source,
      "Checked against the title you named: Never Let Me Go.",
    );
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
      "Checked against the titles you named: Never Let Me Go, Arrival, Moon.",
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
    assert.ok(copy.body[1]?.startsWith("Ambient music listeners sits"));
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
    assert.ok(copy.body[0]?.includes("at 72%"));
    assert.ok(copy.body[0]?.includes("only 44%"));
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
    assert.equal(
      copy.source,
      "Checked against the title you named: Never Let Me Go.",
    );
  });

  it("cap leaves empty labels alone", () => {
    assert.equal(cap(""), "");
    assert.equal(cap("a"), "A");
  });
});
