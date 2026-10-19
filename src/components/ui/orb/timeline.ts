/**
 * The orb's timeline: every track set, in the order the runtime plays
 * them.
 *
 * A track is one animated channel (a CSS custom property on the actor,
 * or a runtime-side value) moving from `from` to `to` between `t0` and
 * `t1` milliseconds, on one easing curve. The runtime plays a list of
 * tracks; the curve is applied to the progress, the numbers are
 * interpolated, and the channel is written once per frame.
 */

import {
  BALL_MS,
  COLLAPSE_FROM_MS,
  INK_MS,
  MELT_MS,
  SQUASH_MS,
  SQUEEZE_OVER,
  SQUEEZE_TALL,
} from "@/components/orb/morph-geometry";
import { E, type Ease } from "@/components/ui/orb/easing";
import {
  BALL_SMALL,
  BOX_R,
  CARD_H,
  FLY_D,
  ORB_D,
  PILL_H,
} from "@/components/ui/orb/geometry";

export interface Track {
  ch: string;
  from: number;
  to: number;
  t0: number;
  t1: number;
  ease?: Ease;
}
export const T = (
  ch: string,
  from: number,
  to: number,
  t0: number,
  t1: number,
  ease: Ease = E.io,
): Track => ({ ch, from, to, t0, t1, ease });

export interface Geo {
  pw: number;
  cw: number;
  H: number;
  dir: number;
}

/* One shape, never cut (see morph-geometry): the pill's content melts
   out first, then the empty pill falls straight into the circle — past
   it, SQUEEZE_OVER narrower and SQUEEZE_TALL taller — before springing
   back out to it; the ink turn is the closing beat (here the pill →
   ball crossfade). Beats mirror the flight clone's, so a direct entry
   reads the same as the landing handoff. */
export const launchTracks = (g: Geo): Track[] => [
  T("oInput", 1, 0, 0, MELT_MS, E.in),
  T("oGlow", 1, 0, 0, SQUASH_MS, E.out),
  T("oAur", 1, 0, 0, SQUASH_MS, E.out),
  T("w", g.pw, BALL_SMALL - SQUEEZE_OVER, COLLAPSE_FROM_MS, SQUASH_MS, E.push),
  T(
    "h",
    PILL_H,
    BALL_SMALL + SQUEEZE_TALL,
    COLLAPSE_FROM_MS,
    SQUASH_MS,
    E.push,
  ),
  T("r", BOX_R, BALL_SMALL / 2, COLLAPSE_FROM_MS, SQUASH_MS, E.push),
  T("w", BALL_SMALL - SQUEEZE_OVER, BALL_SMALL, SQUASH_MS, BALL_MS, E.settle),
  T("h", BALL_SMALL + SQUEEZE_TALL, BALL_SMALL, SQUASH_MS, BALL_MS, E.settle),
  T("oPill", 1, 0, BALL_MS, INK_MS, E.out),
  T("oBall", 0, 1, BALL_MS, INK_MS, E.out),
  T("u", 0, 1, INK_MS, INK_MS + 880, E.fly),
  T("w", BALL_SMALL, FLY_D, INK_MS, INK_MS + 680, E.grow),
  T("h", BALL_SMALL, FLY_D, INK_MS, INK_MS + 680, E.grow),
  T("r", BALL_SMALL / 2, ORB_D / 2, INK_MS, INK_MS + 880, E.out),
  T("w", FLY_D, ORB_D, INK_MS + 680, INK_MS + 880, E.out),
  T("h", FLY_D, ORB_D, INK_MS + 680, INK_MS + 880, E.out),
  T("cHalo", 0, 0.6, INK_MS, INK_MS + 880, E.out),
  T("trail", 0, 1, INK_MS + 80, INK_MS + 180, E.out),
  T("trail", 1, 0, INK_MS + 680, INK_MS + 880, E.in),
];

/* Flight handoff: the clone already morphed card → ball, so the runtime
   joins at the ball (second half of launch, re-based to t=0) and grows
   to the orb. Timings mirror launchTracks from the ink beat on. */
export const launchBallTracks = (): Track[] => [
  T("u", 0, 1, 0, 880, E.fly),
  T("w", BALL_SMALL, FLY_D, 0, 680, E.grow),
  T("h", BALL_SMALL, FLY_D, 0, 680, E.grow),
  T("r", BALL_SMALL / 2, ORB_D / 2, 0, 880, E.out),
  T("w", FLY_D, ORB_D, 680, 880, E.out),
  T("h", FLY_D, ORB_D, 680, 880, E.out),
  T("cHalo", 0, 0.6, 0, 880, E.out),
  T("trail", 0, 1, 80, 180, E.out),
  T("trail", 1, 0, 680, 880, E.in),
];

export const ASSEMBLE: Track[] = [
  T("oRing", 1, 0, 0, 300, E.out),
  T("oBall", 1, 0, 0, 260, E.out),
  T("orb.k", 0, 1, 0, 800, E.out),
  T("orb.alpha", 0, 1, 0, 800, E.out),
  T("orb.spin", 0, 0.9, 0, 800, E.out),
  T("orb.pop", 1, 1.05, 0, 420, E.out),
  T("orb.pop", 1.05, 1, 420, 800, E.io),
  T("sOp", 0, 1, 300, 620, E.out),
  T("sTy", 6, 0, 300, 620, E.out),
];

export const RESOLVE: Track[] = [
  T("orb.sweep", 0, 1, 0, 700, E.io),
  T("orb.spin", 0.9, 0.3, 0, 700, E.out),
  T("orb.gain", 1, 0, 0, 700, E.out),
  T("orb.floor", 0, 0.95, 400, 900, E.out),
  T("orb.rad", 0, 0.15, 400, 900, E.out),
  T("orb.pop", 1, 1.04, 600, 800, E.out),
  T("orb.pop", 1.04, 1, 800, 900, E.out),
];

export const CONDENSE: Track[] = [
  T("orb.pop", 1, 1.06, 0, 120, E.out),
  T("sOp", 1, 0, 0, 160, E.in),
  T("sTy", 0, -6, 0, 160, E.in),
  T("orb.k", 1, 0, 120, 640, E.vortex),
  T("orb.vortex", 0, 1.6, 120, 640, E.vortex),
  T("oGreen", 0, 1, 260, 700, E.spring),
  T("gs", 0.55, 1, 260, 700, E.spring),
  T("pulse", 0, 1, 320, 760, E.out),
  T("oHalo", 0, 0.35, 380, 700, E.out),
  T("orb.alpha", 1, 0, 500, 800, E.out),
];

export const unfoldTracks = (g: Geo, tw: number): Track[] => [
  T("w", ORB_D, 124, 0, 90, E.in),
  T("h", ORB_D, 124, 0, 90, E.in),
  T("w", 124, g.cw, 90, 700, E.card),
  T("h", 124, CARD_H, 90, 700, E.out),
  T("r", ORB_D / 2, BOX_R, 90, 700, E.io),
  T("oGreen", 1, 0, 200, 560, E.out),
  T("oCard", 0, 1, 200, 560, E.out),
  T("oHalo", 0.35, 0, 300, 700, E.out),
  T("cHalo", 0.6, 0.22, 300, 700, E.out),
  T("hOp", 0, 1, 520, 840, E.out),
  T("dotS", 0, 1, 520, 840, E.spring),
  T("wp", 0, 1, 600, 600 + tw, E.lin),
  T("bloom", 1, 0.625, 700, 1200, E.io),
];

/* reduced-motion: pure cross-fades */
export const R_OUT: Track[] = [
  T("oInput", 1, 0, 0, 140, E.out),
  T("oPill", 1, 0, 0, 200, E.out),
  T("oGlow", 1, 0, 0, 200, E.out),
  T("oAur", 1, 0, 0, 200, E.out),
  T("oRing", 1, 0, 0, 200, E.out),
];
export const R_IN: Track[] = [
  T("orb.alpha", 0, 1, 0, 200, E.out),
  T("sOp", 0, 1, 0, 200, E.out),
  T("cHalo", 0, 0.6, 0, 200, E.out),
];
export const R_RESOLVE: Track[] = [
  T("orb.sweep", 0, 1, 0, 250, E.io),
  T("orb.floor", 0, 0.95, 0, 250, E.out),
];
export const R_CONDENSE: Track[] = [
  T("oGreen", 0, 1, 0, 250, E.out),
  T("orb.alpha", 1, 0, 0, 250, E.out),
  T("sOp", 1, 0, 0, 250, E.out),
];
export const R_GREEN_OUT: Track[] = [T("oGreen", 1, 0, 0, 120, E.out)];

/**
 * Clear-ending finale length: resolve sweep (tail 1700) + condense
 * (tail 1300) + green-out (120). The scored run returns its receipt
 * at once and flips to done after this, so the flash plays before the
 * result takes over. Bounded wait, never gated on the animation —
 * a dead runtime delays the result, never strands it.
 */
export const CLEAR_FINALE_MS = 3150;
/** Same finale under reduced motion (250 + 250 + 120). */
export const CLEAR_FINALE_REDUCED_MS = 650;
export const rCardIn = (tw: number): Track[] => [
  T("oCard", 0, 1, 0, 250, E.out),
  T("hOp", 0, 1, 0, 250, E.out),
  T("wp", 0, 1, 0, tw, E.lin),
  T("bloom", 1, 0.625, 0, 250, E.out),
];

export const FADE = [
  "oGlow",
  "oAur",
  "oPill",
  "oBall",
  "oGreen",
  "oCard",
  "oRing",
  "oInput",
  "oHalo",
  "sOp",
  "orb.alpha",
  "trail",
];

export const INIT: Record<string, number> = {
  h: PILL_H,
  r: BOX_R,
  oGlow: 1,
  oHalo: 0,
  oPill: 1,
  oBall: 0,
  oGreen: 0,
  oCard: 0,
  oRing: 1,
  oInput: 1,
  oAur: 1,
  gs: 0.55,
  cs: 1,
  hOp: 0,
  dotS: 0,
  bloom: 1,
  u: 0,
  yOff: 0,
  trail: 0,
  pulse: -1,
  sOp: 0,
  sTy: 6,
  cHalo: 0,
  wp: 0,
  "orb.k": 0,
  "orb.alpha": 0,
  "orb.spin": 0,
  "orb.pop": 1,
  "orb.sweep": 0,
  "orb.vortex": 0,
  "orb.gain": 1,
  "orb.floor": 0,
  "orb.rad": 0,
};
