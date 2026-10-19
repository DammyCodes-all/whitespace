/**
 * Math and easing for the orb.
 *
 * cubicBezier lives in morph-geometry: the morph's beats and this file's
 * own curves are the same solver, defined once.
 */

import {
  cubicBezier,
  pushEase,
  settleEase,
} from "@/components/orb/morph-geometry";

export type Ease = (t: number) => number;
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const fmt = (v: number) => String(Math.round(v * 1e4) / 1e4);
export const TAU = Math.PI * 2;

export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* cubicBezier lives in morph-geometry: the morph's beats and this
   file's own curves are the same solver, defined once. */

export const E = {
  out: cubicBezier(0.22, 1, 0.36, 1),
  io: cubicBezier(0.65, 0, 0.35, 1),
  in: cubicBezier(0.4, 0, 1, 1),
  fly: cubicBezier(0.5, 0, 0.1, 1),
  grow: cubicBezier(0.3, 0, 0.2, 1),
  vortex: cubicBezier(0.6, 0, 0.2, 1),
  spring: cubicBezier(0.34, 1.4, 0.64, 1),
  card: cubicBezier(0.65, 0, 0.2, 1),
  /* The morph's beats (mirrors of morph-geometry's EASE_PUSH/EASE_SETTLE):
     push compresses into the squash point, settle springs back out. */
  push: pushEase,
  settle: settleEase,
  lin: (t: number) => t,
};

export const bez = (t: number, p0: number, c: number, p2: number) =>
  (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * c + t * t * p2;
