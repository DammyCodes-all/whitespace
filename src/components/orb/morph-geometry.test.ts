/**
 * morph-geometry: the beats stay in order, the curves stay gentle (the
 * push never overshoots, the settle only a hair) and the join ball
 * keeps the number both halves share.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BALL_D,
  BALL_MS,
  COLLAPSE_FROM_MS,
  cubicBezier,
  EASE_PUSH,
  EASE_SETTLE,
  INK_MS,
  MELT_MS,
  pushEase,
  SQUASH_MS,
  SQUEEZE_OVER,
  SQUEEZE_TALL,
  settleEase,
} from "./morph-geometry.ts";

const peak = (ease: (t: number) => number) => {
  let max = -Infinity;
  for (let i = 0; i <= 1000; i++) max = Math.max(max, ease(i / 1000));
  return max;
};

describe("morph-geometry", () => {
  it("push compresses without ever overshooting, soft at both ends", () => {
    assert.equal(pushEase(0), 0);
    assert.equal(pushEase(1), 1);
    let prev = -Infinity;
    for (let i = 0; i <= 1000; i++) {
      const v = pushEase(i / 1000);
      assert.ok(v >= 0 && v <= 1, `out of band at ${i}: ${v}`);
      assert.ok(v >= prev - 1e-9, `dipped at ${i}: ${prev} → ${v}`);
      prev = v;
    }
    // lands on the squash with no speed left (the beat's release curve
    // takes it from here, which is what makes the overshoot read)
    assert.ok(1 - pushEase(0.95) < 0.05, "push should ease into the squash");
  });

  it("settle springs back with a visible, exact overshoot", () => {
    assert.equal(settleEase(0), 0);
    assert.equal(settleEase(1), 1);
    const p = peak(settleEase);
    assert.ok(p > 1.12, `overshoot too small to feel: ${p}`);
    assert.ok(p <= 1.22, `overshoot too big: ${p}`);
    // in px on the beat the curve actually runs on: the rebound passes
    // the ball by a couple of px — seen, not wobbled
    const past = (p - 1) * SQUEEZE_OVER;
    assert.ok(past >= 1.5 && past <= 4, `rebound past the ball: ${past}px`);
  });

  it("the WAAPI strings are the same curves the runtime runs", () => {
    const pts = (ease: string) => ease.match(/[0-9.]+/g)?.map(Number) ?? [];
    const [p1, p2, p3, p4] = pts(EASE_PUSH);
    const [s1, s2, s3, s4] = pts(EASE_SETTLE);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      assert.equal(cubicBezier(p1, p2, p3, p4)(t), pushEase(t));
      assert.equal(cubicBezier(s1, s2, s3, s4)(t), settleEase(t));
    }
  });

  it("beats run melt → collapse → ink, in order", () => {
    assert.ok(0 < COLLAPSE_FROM_MS && COLLAPSE_FROM_MS < MELT_MS);
    assert.ok(MELT_MS < SQUASH_MS && SQUASH_MS < BALL_MS);
    assert.ok(BALL_MS < INK_MS);
    assert.ok(INK_MS <= 700, "the morph stays tight at pace 1");
    // the collapse gets a head start on the melt, but only a little:
    // the content is on its way out before the shape takes the eye
    assert.ok(
      MELT_MS - COLLAPSE_FROM_MS <= 120,
      "the melt must not be trampled by the collapse",
    );
  });

  it("overshoots are deliberate, positive and read as rubber", () => {
    for (const px of [SQUEEZE_OVER, SQUEEZE_TALL]) {
      assert.ok(px > 0, "an overshoot of 0 is a cut, not a spring");
      assert.ok(px <= 20, `too much wobble: ${px}px`);
    }
    assert.ok(
      SQUEEZE_OVER >= BALL_D / 5,
      "the squash has to be deep enough to see",
    );
    assert.ok(SQUEEZE_OVER < BALL_D / 3, "the squash stays a squash");
  });

  it("join geometry: the ball is 60px and fully round", () => {
    assert.equal(BALL_D, 60);
    assert.equal(BALL_D / 2, 30, "…so its radius is half of it");
  });
});
