// Vendored from 21st.dev (anark17r, "ai thiking orb and input") via MCP,
// then slimmed: this build keeps ONLY the orb animation and the morph
// (idle pill → ball → dotted orb → receipt). No text input, no send
// button, no reset button, no debug panel — entry lives on the landing
// page and the host drives legs through OrbHandle.
//
// Whitespace adaptations: the idle pill is the old pitch box (tall
// card, 16px corners); submit deforms it on the runtime's own w/h/r
// tracks; stage-relative geometry via measureStage.

import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/* ───────────────────────────── copy ───────────────────────────── */
const COPY = {
  labels: ["Thinking", "Searching", "Analyzing", "Composing"],
  done: "Done",
  waiting: "Over to you.",
  answerTitle: "Answer",
  answerBody: "The answer goes here",
};

export type OrbPhase =
  | "idle"
  | "launch"
  | "assemble"
  | "think"
  | "resolve"
  | "condense"
  | "unfold"
  | "answered"
  | "waiting"
  | "reset";
type Phase = OrbPhase;

export interface MorphOrbProps {
  onSubmit?: (text: string) => Promise<string> | string;
  minThinkMs?: number;
  speed?: number;
  /** Real work line for the think phase ("Reading your pitch's
   *  tags…"). When set, it replaces the generic Thinking/Searching
   *  cycle — the label names only the call actually in flight. */
  workingLabel?: string;
  /** Copy for the hold state (default "Over to you."). */
  waitingLabel?: string;
  /** Ref drive for multi-leg flows: ask() runs one morph→think→receipt
   *  cycle around caller-supplied work; reset() returns to the idle pill. */
  orbRef?: React.Ref<OrbHandle | null>;
  /** Phase changes (OrbPhase); lets the host advance its own step UI
   *  when a leg's receipt lands. */
  onPhaseChange?: (phase: OrbPhase) => void;
}

/** Imperative drive for hosts that run several orb legs in a row. */
export interface OrbHandle {
  ask: (
    text: string,
    work: (text: string) => Promise<string> | string,
    end?: OrbEnd,
  ) => void;
  /** Think-only cycle around caller work: no box morph — the orb works
   *  from its current frame into think, then resolves. For mid-leg
   *  refreshes (Check). Returns false while a cycle is mid-flight. */
  pulse: (
    text: string,
    work: (text: string) => Promise<string> | string,
    end?: OrbEnd,
  ) => boolean;
  /** Between-leg advance beat: no cycle runs while the orb glides down
   *  and back, but the orb still holds its thinking pose for the whole
   *  window (`label` is the honest line for it) — and hands back to the
   *  waiting pose on `false`. Only applies to the settled waiting orb:
   *  a live cycle owns its own pose. */
  beat: (on: boolean, label?: string) => void;
  reset: () => void;
  /** Entry-leg controls for the ?pitch= autostart. */
  setText: (text: string) => void;
  submit: (text?: string, end?: OrbEnd) => void;
  /** Flight handoff: the clone already morphed card → ball in flight,
   *  so the runtime joins at the ball and grows to the orb (no replay). */
  submitFromBall: (text?: string, end?: OrbEnd) => void;
}

/** How a leg ends: a receipt card ("card"), a held orb waiting for
 *  input ("wait"), or a green flash dissolving into the result ("clear"). */
export type OrbEnd = "card" | "wait" | "clear";

/* ─────────────────────────── geometry ─────────────────────────── */
/* Whitespace adaptation: the idle pill IS the old pitch box (tall card,
   16px corners), so submit deforms it — wide card → ball → orb — on the
   runtime's own w/h/r tracks. */
const PILL_H = 200,
  BALL_SMALL = 60,
  ORB_D = 132,
  ORB_R = 66,
  CANVAS = 220;
const BOX_R = 16;
const CARD_H = 108;
const FLY_D = 138;
/* The orb embeds in page flow (a bounded stage) instead of owning the
   viewport, so width derives from the stage's own size once mounted,
   falling back to the window before that. */
let stageW = 0;
export function measureStage(el: HTMLElement | null) {
  if (el) {
    stageW = el.clientWidth;
  }
}
const stageSpan = () => (stageW > 0 ? stageW : window.innerWidth) - 32;
const pillW = () => Math.max(280, Math.min(720, stageSpan()));
const cardW = () => Math.min(320, stageSpan());
/* Short flight: the box rests 80px below the orb anchor, so the stage
   stays compact. */
const homeDy = () => 80;

/* ───────────────────────── math + easing ───────────────────────── */
type Ease = (t: number) => number;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const fmt = (v: number) => String(Math.round(v * 1e4) / 1e4);
const TAU = Math.PI * 2;

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1,
    bx = 3 * (x2 - x1) - cx,
    ax = 1 - cx - bx;
  const cy = 3 * y1,
    by = 3 * (y2 - y1) - cy,
    ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return t;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0,
      hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const e = sx(t);
      if (Math.abs(e - x) < 1e-6) break;
      if (x > e) lo = t;
      else hi = t;
      t = (hi - lo) / 2 + lo;
    }
    return t;
  };
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)));
}

const E = {
  out: cubicBezier(0.22, 1, 0.36, 1),
  io: cubicBezier(0.65, 0, 0.35, 1),
  in: cubicBezier(0.4, 0, 1, 1),
  fly: cubicBezier(0.5, 0, 0.1, 1),
  grow: cubicBezier(0.3, 0, 0.2, 1),
  vortex: cubicBezier(0.6, 0, 0.2, 1),
  spring: cubicBezier(0.34, 1.4, 0.64, 1),
  card: cubicBezier(0.65, 0, 0.2, 1),
  lin: (t: number) => t,
};

const bez = (t: number, p0: number, c: number, p2: number) =>
  (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * c + t * t * p2;

/* ───────────────────────── timeline data ───────────────────────── */
interface Track {
  ch: string;
  from: number;
  to: number;
  t0: number;
  t1: number;
  ease?: Ease;
}
const T = (
  ch: string,
  from: number,
  to: number,
  t0: number,
  t1: number,
  ease: Ease = E.io,
): Track => ({ ch, from, to, t0, t1, ease });

interface Geo {
  pw: number;
  cw: number;
  H: number;
  dir: number;
}

const launchTracks = (g: Geo): Track[] => [
  T("w", g.pw, g.pw - 12, 0, 100, E.out),
  T("oInput", 1, 0, 0, 160, E.in),
  T("oGlow", 1, 0, 0, 300, E.out),
  T("oAur", 1, 0, 0, 300, E.out),
  T("w", g.pw - 12, BALL_SMALL, 100, 560, E.io),
  T("h", PILL_H, PILL_H + 6, 380, 500, E.out),
  T("h", PILL_H + 6, BALL_SMALL, 500, 620, E.out),
  T("r", BOX_R, BALL_SMALL / 2, 100, 560, E.io),
  T("oPill", 1, 0, 300, 560, E.out),
  T("oBall", 0, 1, 300, 560, E.out),
  T("u", 0, 1, 620, 1500, E.fly),
  T("w", BALL_SMALL, FLY_D, 620, 1300, E.grow),
  T("h", BALL_SMALL, FLY_D, 620, 1300, E.grow),
  T("r", BALL_SMALL / 2, ORB_D / 2, 620, 1500, E.out),
  T("w", FLY_D, ORB_D, 1300, 1500, E.out),
  T("h", FLY_D, ORB_D, 1300, 1500, E.out),
  T("cHalo", 0, 0.6, 620, 1500, E.out),
  T("trail", 0, 1, 700, 800, E.out),
  T("trail", 1, 0, 1300, 1500, E.in),
];

/* Flight handoff: the clone already morphed card → ball, so the runtime
   joins at the ball (second half of launch, re-based to t=0) and grows
   to the orb. Timings mirror launchTracks[620…1500]. */
const launchBallTracks = (): Track[] => [
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

const ASSEMBLE: Track[] = [
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

const RESOLVE: Track[] = [
  T("orb.sweep", 0, 1, 0, 700, E.io),
  T("orb.spin", 0.9, 0.3, 0, 700, E.out),
  T("orb.gain", 1, 0, 0, 700, E.out),
  T("orb.floor", 0, 0.95, 400, 900, E.out),
  T("orb.rad", 0, 0.15, 400, 900, E.out),
  T("orb.pop", 1, 1.04, 600, 800, E.out),
  T("orb.pop", 1.04, 1, 800, 900, E.out),
];

const CONDENSE: Track[] = [
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

const unfoldTracks = (g: Geo, tw: number): Track[] => [
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
const R_OUT: Track[] = [
  T("oInput", 1, 0, 0, 140, E.out),
  T("oPill", 1, 0, 0, 200, E.out),
  T("oGlow", 1, 0, 0, 200, E.out),
  T("oAur", 1, 0, 0, 200, E.out),
  T("oRing", 1, 0, 0, 200, E.out),
];
const R_IN: Track[] = [
  T("orb.alpha", 0, 1, 0, 200, E.out),
  T("sOp", 0, 1, 0, 200, E.out),
  T("cHalo", 0, 0.6, 0, 200, E.out),
];
const R_RESOLVE: Track[] = [
  T("orb.sweep", 0, 1, 0, 250, E.io),
  T("orb.floor", 0, 0.95, 0, 250, E.out),
];
const R_CONDENSE: Track[] = [
  T("oGreen", 0, 1, 0, 250, E.out),
  T("orb.alpha", 1, 0, 0, 250, E.out),
  T("sOp", 1, 0, 0, 250, E.out),
];
const R_GREEN_OUT: Track[] = [T("oGreen", 1, 0, 0, 120, E.out)];

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
const rCardIn = (tw: number): Track[] => [
  T("oCard", 0, 1, 0, 250, E.out),
  T("hOp", 0, 1, 0, 250, E.out),
  T("wp", 0, 1, 0, tw, E.lin),
  T("bloom", 1, 0.625, 0, 250, E.out),
];

const FADE = [
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

const INIT: Record<string, number> = {
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

/* ─────────────────────────── async utils ─────────────────────────── */
const ABORT = Symbol("abort");

function sleep(ms: number, sig: AbortSignal) {
  return new Promise<void>((res) => {
    if (sig.aborted) return res();
    let id = 0;
    const onAbort = () => {
      window.clearTimeout(id);
      res();
    };
    id = window.setTimeout(
      () => {
        sig.removeEventListener("abort", onAbort);
        res();
      },
      Math.max(0, ms),
    );
    sig.addEventListener("abort", onAbort, { once: true });
  });
}

function abortable<V>(p: Promise<V>, sig: AbortSignal) {
  return new Promise<V | undefined>((res) => {
    if (sig.aborted) return res(undefined);
    const onAbort = () => res(undefined);
    sig.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => {
        sig.removeEventListener("abort", onAbort);
        res(v);
      },
      () => {
        sig.removeEventListener("abort", onAbort);
        res(undefined);
      },
    );
  });
}

/* ───────────────────────────── dotted orb ───────────────────────────── */
const RINGS = 16;
const DOT_LIST = (() => {
  const rand = mulberry32(7);
  const out: { x: number; y: number; z: number; u: number; seed: number }[] =
    [];
  for (let k = 0; k < RINGS; k++) {
    const y = 1 - ((k + 0.5) / RINGS) * 2;
    const r = Math.sqrt(1 - y * y);
    const m = Math.max(4, Math.round(30 * r));
    for (let j = 0; j < m; j++) {
      const a = (j / m) * TAU + k * 0.35;
      out.push({
        x: Math.cos(a) * r,
        y,
        z: Math.sin(a) * r,
        u: (1 - y) / 2,
        seed: rand() * 6.283,
      });
    }
  }
  return out;
})();
const N = DOT_LIST.length;
const DX = Float32Array.from(DOT_LIST, (d) => d.x);
const DY = Float32Array.from(DOT_LIST, (d) => d.y);
const DZ = Float32Array.from(DOT_LIST, (d) => d.z);
const DU = Float32Array.from(DOT_LIST, (d) => d.u);
const DS = Float32Array.from(DOT_LIST, (d) => d.seed);

const G_STEPS = 24,
  A_STEPS = 48;
const COLORS: string[] = (() => {
  // Dark on light: dots read on paper, never on a disc. Base is ink,
  // sweeping toward --hold orange (#ea580c) so the hold state reads
  // as "waiting on you" — mint stays the run-done color.
  const out: string[] = [];
  for (let gi = 0; gi <= G_STEPS; gi++) {
    const g = gi / G_STEPS;
    const r = Math.round(lerp(23, 234, g)),
      gg = Math.round(lerp(21, 88, g)),
      b = Math.round(lerp(31, 12, g));
    for (let ai = 0; ai <= A_STEPS; ai++)
      out.push(`rgba(${r},${gg},${b},${(ai / A_STEPS).toFixed(3)})`);
  }
  return out;
})();

interface OrbParams {
  k: number;
  alpha: number;
  spin: number;
  rot: number;
  sweep: number;
  pop: number;
  vortex: number;
  gain: number;
  floor: number;
  rad: number;
  prog: number;
}
const ORB_KEYS = [
  "k",
  "alpha",
  "spin",
  "sweep",
  "pop",
  "vortex",
  "gain",
  "floor",
  "rad",
] as const;

function createOrb(
  canvas: HTMLCanvasElement,
  getSpeed: () => number,
  isReduced: () => boolean,
) {
  const P: OrbParams = {
    k: 0,
    alpha: 0,
    spin: 0,
    rot: 0,
    sweep: 0,
    pop: 1,
    vortex: 0,
    gain: 1,
    floor: 0,
    rad: 0,
    prog: 0,
  };
  const ctx = canvas.getContext("2d");
  const lit = new Float32Array(N);
  const SX = new Float32Array(N),
    SY = new Float32Array(N),
    SR = new Float32Array(N),
    SD = new Float32Array(N);
  const SC = new Int16Array(N);
  const pw = [1, 0, 0, 0];
  let time = 0,
    raf = 0,
    last = 0,
    dead = false;

  const reset = () => {
    P.k = 0;
    P.alpha = 0;
    P.spin = 0;
    P.rot = 0;
    P.sweep = 0;
    P.pop = 1;
    P.vortex = 0;
    P.gain = 1;
    P.floor = 0;
    P.rad = 0;
    P.prog = 0;
    lit.fill(0);
    pw[0] = 1;
    pw[1] = 0;
    pw[2] = 0;
    pw[3] = 0;
    time = isReduced() ? 1.2 : 0;
  };
  reset();

  if (!ctx) return { P, ensure() {}, reset, destroy() {} };

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(CANVAS * dpr);
  canvas.height = Math.round(CANVAS * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const S = 0.6,
    CP = Math.cos(0.35),
    SP = Math.sin(0.35),
    C0 = CANVAS / 2;

  const draw = (dt: number) => {
    ctx.clearRect(0, 0, CANVAS, CANVAS);
    time += dt;
    P.rot += P.spin * dt;
    const yaw = P.rot + P.vortex,
      cyw = Math.cos(yaw),
      syw = Math.sin(yaw);
    const stepW = dt / 0.35;
    for (let q = 0; q < 4; q++) {
      const d = (q === P.prog ? 1 : 0) - pw[q];
      pw[q] += Math.abs(d) <= stepW ? d : d > 0 ? stepW : -stepW;
    }
    const decay = Math.exp(-dt / 0.5);
    const h0 = (time * 300) % N,
      h3 = (time * 480) % N;
    const a1 = time * 0.8,
      b1 = Math.sin(time * 0.5) * 0.9;
    const f1x = Math.cos(b1) * Math.cos(a1),
      f1y = Math.sin(b1),
      f1z = Math.cos(b1) * Math.sin(a1);
    const a2 = time * 0.55 + 2.1,
      b2 = Math.cos(time * 0.42) * 0.9;
    const f2x = Math.cos(b2) * Math.cos(a2),
      f2y = Math.sin(b2),
      f2z = Math.cos(b2) * Math.sin(a2);
    const lat = Math.sin(time * 2.2);
    const swirlK = P.vortex * 1.5;

    for (let n = 0; n < N; n++) {
      const dx = DX[n],
        dy = DY[n],
        dz = DZ[n],
        u = DU[n];

      /* light programs: dots are lit in turn */
      let pulse = 0;
      if (pw[0] > 0.001) {
        let dd = Math.abs(n - h0);
        if (dd > N - dd) dd = N - dd;
        const v = Math.max(0, 1 - dd / 16);
        pulse = Math.max(pulse, v * v * pw[0]);
      }
      if (pw[1] > 0.001) {
        const v1 = Math.max(0, (dx * f1x + dy * f1y + dz * f1z - 0.72) / 0.28);
        const v2 = Math.max(0, (dx * f2x + dy * f2y + dz * f2z - 0.72) / 0.28);
        const v = Math.max(v1, v2);
        pulse = Math.max(pulse, v * v * pw[1]);
      }
      if (pw[2] > 0.001) {
        const e = dy - lat;
        const v = Math.max(0, 1 - (e * e) / 0.02);
        pulse = Math.max(pulse, v * v * pw[2]);
      }
      if (pw[3] > 0.001) {
        let dd = Math.abs(n - h3);
        if (dd > N - dd) dd = N - dd;
        const v = Math.max(0, 1 - dd / 22);
        pulse = Math.max(pulse, v * v * pw[3]);
      }
      const l = Math.max(lit[n] * decay, pulse * P.gain);
      lit[n] = l;

      /* per-dot appearance: top dots first, bottom collapse first */
      const ki = clamp01(P.k * (1 + S) - S * u);
      if (ki <= 0.001) {
        SC[n] = -1;
        continue;
      }
      const eo = E.out(ki),
        kk = eo * P.pop;

      const x1 = dx * cyw + dz * syw,
        z1 = -dx * syw + dz * cyw;
      const y2 = dy * CP - z1 * SP,
        z2 = dy * SP + z1 * CP;
      const f = 2.8 / (2.8 - z2),
        depth = (z2 + 1) / 2;
      let ox = x1 * ORB_R * kk * f,
        oy = -y2 * ORB_R * kk * f;
      if (swirlK > 0.001) {
        const sw = (1 - ki) * swirlK,
          cc = Math.cos(sw),
          ss = Math.sin(sw);
        const tx = ox * cc - oy * ss;
        oy = ox * ss + oy * cc;
        ox = tx;
      }

      const g = clamp01((P.sweep * 1.4 - u) / 0.4);
      let a =
        0.1 +
        0.035 * Math.sin(DS[n] + time * 1.6) * (1 - g) +
        0.32 * depth * depth +
        0.75 * l * (1 - g) +
        g * (0.55 + 0.4 * depth) +
        2 * g * (1 - g);
      a = Math.max(a, P.floor * (0.7 + 0.3 * depth));
      if (a > 1) a = 1;
      a *= eo * P.alpha;

      SX[n] = C0 + ox;
      SY[n] = C0 + oy;
      SD[n] = depth;
      SR[n] =
        (1.15 * (0.45 + 0.75 * depth) * f + 0.9 * l + g * 0.25) *
        (1 + P.rad) *
        (0.4 + 0.6 * eo);
      const ai = Math.round(a * A_STEPS),
        gi = Math.round(g * G_STEPS);
      SC[n] = ai <= 0 ? -1 : gi * (A_STEPS + 1) + ai;
    }

    /* two passes: back half first, then front half */
    for (let pass = 0; pass < 2; pass++) {
      for (let n = 0; n < N; n++) {
        const c = SC[n];
        if (c < 0) continue;
        if (SD[n] >= 0.5 !== (pass === 1)) continue;
        ctx.fillStyle = COLORS[c];
        ctx.beginPath();
        ctx.arc(SX[n], SY[n], SR[n], 0, TAU);
        ctx.fill();
      }
    }
  };

  const frame = (now: number) => {
    raf = 0;
    if (dead) return;
    const dt = isReduced()
      ? 0
      : Math.max(0, Math.min(0.05, (now - last) / 1000)) * getSpeed();
    last = now;
    draw(dt);
    if (P.alpha > 0.002) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, CANVAS, CANVAS);
  };

  const ensure = () => {
    if (raf || dead || P.alpha <= 0.002) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const destroy = () => {
    dead = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  return { P, ensure, reset, destroy };
}

/* ───────────────────────────── runtime ───────────────────────────── */
interface UI {
  setPhase(p: Phase): void;
  swapLabel(name: string): void;
  resetLabel(): void;
  setAnswer(s: string): void;
  clearInput(): void;
  live(s: string): void;
  lock(on: boolean): void;
  idleReady(): void;
  focusAnswer(): void;
}
interface Env {
  root: HTMLElement;
  mover: HTMLElement;
  actor: HTMLElement;
  ghosts: HTMLElement[];
  canvas: HTMLCanvasElement;
  pulse: HTMLElement;
  status: HTMLElement;
  getBody: () => HTMLElement | null;
  /** Real work line while a leg runs, or null to cycle generic labels. */
  getWorkLabel: () => string | null;
  getWaitLabel: () => string;
  ui: UI;
  getSpeed: () => number;
  isReduced: () => boolean;
}
interface RunCfg {
  onSubmit: (text: string) => Promise<string> | string;
  minThink: number;
  end: OrbEnd;
}
interface Runtime {
  start(text: string, cfg: RunCfg): boolean;
  /** Join at the ball: clone already did card → ball, grow to orb. */
  startFromBall(text: string, cfg: RunCfg): boolean;
  /** Think-only: skip launch + assemble and work from the current
   *  (assembled) orb straight into think, then resolve. For mid-leg
   *  refreshes like Check that must never replay the box morph. */
  pulse(text: string, cfg: RunCfg): boolean;
  /** Between-leg beat: park the orb in its thinking pose while no cycle
   *  runs (see OrbHandle.beat). */
  beat(on: boolean, label?: string): void;
  escape(): void;
  reset(): void;
  hard(): void;
  home(): void;
  busy(): boolean;
  destroy(): void;
}
interface Sample {
  t: number;
  x: number;
  y: number;
  d: number;
}

function sampleAt(h: Sample[], t: number, out: Sample) {
  const n = h.length;
  const copy = (s: Sample) => {
    out.x = s.x;
    out.y = s.y;
    out.d = s.d;
  };
  if (n === 0) {
    out.x = 0;
    out.y = 0;
    out.d = 0;
    return;
  }
  if (t <= h[0].t) return copy(h[0]);
  for (let i = n - 1; i > 0; i--) {
    const a = h[i - 1],
      b = h[i];
    if (t >= a.t) {
      if (t >= b.t) return copy(b);
      const k = (t - a.t) / (b.t - a.t || 1);
      out.x = lerp(a.x, b.x, k);
      out.y = lerp(a.y, b.y, k);
      out.d = lerp(a.d, b.d, k);
      return;
    }
  }
  copy(h[n - 1]);
}

function createRuntime(env: Env): Runtime {
  const { actor, mover, root, status, pulse, ghosts } = env;
  const life = new AbortController();
  const geo: Geo = { pw: pillW(), cw: cardW(), H: homeDy(), dir: -1 };
  const orb = createOrb(env.canvas, env.getSpeed, env.isReduced);
  const vals: Record<string, number> = {};
  const dirty = new Set<string>();
  const CH: Record<string, (v: number) => void> = {};

  let current: AbortController | null = null;
  let idleCtl: AbortController | null = null;
  let beatCtl: AbortController | null = null;
  let busy = false,
    idling = false,
    settled = false,
    epoch = 0;
  let curX = 0,
    curY = 0,
    curD = BALL_SMALL,
    trailVis = 0,
    ghostsShown = false;
  let wStagger = 45,
    wDur = 320;
  const hist: Sample[] = [];
  const tmp: Sample = { t: 0, x: 0, y: 0, d: 0 };

  const child = () => {
    const ac = new AbortController();
    if (life.signal.aborted) ac.abort();
    else
      life.signal.addEventListener("abort", () => ac.abort(), { once: true });
    return ac;
  };

  /** A cycle is taking the orb: stop any beat pose blend under it, so
   *  a stale blend can never write over the cycle's own tracks. */
  const stopBeat = () => {
    beatCtl?.abort();
    beatCtl = null;
    settled = false;
  };

  /* ── flight path + comet trail ── */
  const renderTrail = () => {
    if (trailVis <= 0.001) {
      if (ghostsShown) {
        ghosts.forEach((g) => (g.style.opacity = "0"));
        ghostsShown = false;
      }
      return;
    }
    ghostsShown = true;
    const now = performance.now();
    for (let i = 0; i < ghosts.length; i++) {
      sampleAt(hist, now - (i + 1) * 45, tmp);
      const k = (tmp.d * (1 - 0.08 * (i + 1))) / 100;
      const g = ghosts[i];
      g.style.transform = `translate3d(${(tmp.x - curX).toFixed(2)}px,${(tmp.y - curY).toFixed(2)}px,0) translate(-50%,-50%) scale(${k.toFixed(3)})`;
      g.style.opacity = (0.28 * (1 - i / 6) ** 1.5 * trailVis).toFixed(3);
    }
  };

  const applyPath = () => {
    const u = vals.u ?? 0,
      H = geo.H;
    curX = bez(u, 0, geo.dir * 0.3 * H, 0);
    curY = bez(u, H, 0.6 * H, 0) + (vals.yOff ?? 0);
    mover.style.transform = `translate3d(${curX.toFixed(2)}px,${curY.toFixed(2)}px,0)`;
    const now = performance.now();
    hist.push({ t: now, x: curX, y: curY, d: curD });
    while (hist.length > 2 && hist[0].t < now - 500) hist.shift();
    renderTrail();
  };

  /* ── answer words ── */
  const applyWords = (v: number) => {
    const body = env.getBody();
    if (!body) return;
    const nodes = body.querySelectorAll<HTMLElement>(".mo-w");
    const total = (nodes.length - 1) * wStagger + wDur;
    const time = v * total;
    const reduced = env.isReduced();
    nodes.forEach((el, i) => {
      const p = E.out(clamp01((time - i * wStagger) / wDur));
      el.style.opacity = fmt(p);
      el.style.transform =
        p >= 0.999 || reduced ? "none" : `translateY(${fmt((1 - p) * 4)}px)`;
      el.style.filter =
        p >= 0.999 || reduced ? "none" : `blur(${fmt((1 - p) * 4)}px)`;
    });
  };

  /* ── channels ── */
  [
    "oGlow",
    "oHalo",
    "oPill",
    "oBall",
    "oGreen",
    "oCard",
    "oRing",
    "oInput",
    "oAur",
    "gs",
    "cs",
    "hOp",
    "dotS",
    "bloom",
  ].forEach((n) => {
    CH[n] = (v) => actor.style.setProperty("--" + n, fmt(v));
  });
  ["w", "h", "r"].forEach((n) => {
    CH[n] = (v) => {
      actor.style.setProperty("--" + n, fmt(v) + "px");
      if (n === "w") curD = v;
    };
  });
  CH.sOp = (v) => status.style.setProperty("--sOp", fmt(v));
  CH.sTy = (v) => status.style.setProperty("--sTy", fmt(v));
  CH.cHalo = (v) => root.style.setProperty("--oCenter", fmt(v));
  CH.u = () => applyPath();
  CH.yOff = () => applyPath();
  CH.trail = (v) => {
    trailVis = v;
    renderTrail();
  };
  CH.pulse = (v) => {
    if (v < 0) {
      pulse.style.opacity = "0";
      return;
    }
    pulse.style.opacity = fmt(0.5 * (1 - v));
    pulse.style.transform = `scale(${fmt(1 + v)})`;
  };
  CH.wp = applyWords;
  ORB_KEYS.forEach((name) => {
    CH["orb." + name] = (v) => {
      orb.P[name] = v;
      if (name === "alpha") orb.ensure();
    };
  });

  const set = (ch: string, v: number) => {
    vals[ch] = v;
    dirty.add(ch);
  };
  const flush = () => {
    dirty.forEach((ch) => CH[ch]?.(vals[ch]));
    dirty.clear();
  };
  const setNow = (ch: string, v: number) => {
    vals[ch] = v;
    CH[ch]?.(v);
  };
  const resetChannels = () => {
    setNow("w", geo.pw);
    for (const ch of Object.keys(INIT)) setNow(ch, INIT[ch]);
  };

  /* ── timeline engine ── */
  const play = (tracks: Track[], sig: AbortSignal) =>
    new Promise<void>((res) => {
      if (sig.aborted) return res();
      const end = tracks.reduce((m, k) => Math.max(m, k.t1), 0);
      const done = new Set<Track>();
      let raf = 0,
        t = 0,
        last = performance.now();
      const onAbort = () => {
        cancelAnimationFrame(raf);
        res();
      };
      const finish = () => {
        sig.removeEventListener("abort", onAbort);
        res();
      };
      const step = (now: number) => {
        const dt = Math.max(0, Math.min(100, now - last));
        last = now;
        t += dt * env.getSpeed();
        for (const k of tracks) {
          if (done.has(k) || t < k.t0) continue;
          const p = Math.min(1, (t - k.t0) / Math.max(1, k.t1 - k.t0));
          set(k.ch, k.from + (k.to - k.from) * (k.ease ?? E.io)(p));
          if (p === 1) done.add(k);
        }
        flush(); // one DOM write pass per frame
        if (t >= end) finish();
        else raf = requestAnimationFrame(step);
      };
      sig.addEventListener("abort", onAbort, { once: true });
      raf = requestAnimationFrame(step);
    });

  /* ── resting poses ── */
  /* The orb has two resting looks: thinking (ink dots, working spin,
     the light programs on) and holding (the orange nudge, programs
     off). A leg ending leaves the holding pose on screen, so quiet
     work and the between-leg beat blend the orb back to whichever
     pose the moment implies. */
  const POSE_MS = 260;
  interface Pose {
    sweep: number;
    gain: number;
    floor: number;
    rad: number;
    spin: number;
  }
  const THINK_POSE: Pose = { sweep: 0, gain: 1, floor: 0, rad: 0, spin: 0.9 };
  const HOLD_POSE: Pose = {
    sweep: 1,
    gain: 0,
    floor: 0.95,
    rad: 0.15,
    spin: 0.25,
  };
  const toPose = (pose: Pose, sig: AbortSignal) => {
    if (env.isReduced()) {
      /* No spin under reduced motion (matches the wait ending). */
      for (const key of ["sweep", "gain", "floor", "rad"] as const)
        setNow("orb." + key, pose[key]);
      return;
    }
    const tracks: Track[] = [];
    for (const key of ["sweep", "gain", "floor", "rad"] as const) {
      const from = orb.P[key];
      if (Math.abs(from - pose[key]) > 0.001)
        tracks.push(T("orb." + key, from, pose[key], 0, POSE_MS, E.io));
    }
    if (Math.abs(orb.P.spin - pose.spin) > 0.001)
      tracks.push(T("orb.spin", orb.P.spin, pose.spin, 0, POSE_MS + 140, E.out));
    if (tracks.length === 0) return;
    void play(tracks, sig);
  };

  /* ── thinking labels ── */
  /* The label follows the work line for the whole cycle, read live
     rather than once at think start: a line that lands a commit after
     the pulse (quiet starts), or one the caller steps forward as its
     chained calls land, is picked up within a beat. The generic cycle
     is only the no-line fallback. */
  const LABEL_POLL_MS = 110;
  const labelFollow = async (sig: AbortSignal, ctl: { stop: boolean }) => {
    let shown = env.getWorkLabel() ?? COPY.labels[0];
    let i = 0;
    let cycledAt = performance.now();
    while (!sig.aborted && !ctl.stop) {
      await sleep(LABEL_POLL_MS, sig);
      if (sig.aborted || ctl.stop) return;
      const line = env.getWorkLabel();
      if (line !== null) {
        if (line !== shown) {
          shown = line;
          env.ui.swapLabel(line);
          env.ui.live(line);
        }
        continue;
      }
      const now = performance.now();
      if (!COPY.labels.includes(shown)) {
        // A line was cleared (between-leg settle): cycle again.
        i = 0;
        shown = COPY.labels[0];
        cycledAt = now;
        orb.P.prog = 0;
        env.ui.swapLabel(shown);
      } else {
        const beat = 1150 / env.getSpeed();
        if (now - cycledAt < beat) continue;
        i = (i + 1) % COPY.labels.length;
        shown = COPY.labels[i];
        cycledAt = now;
        orb.P.prog = i % 4;
        env.ui.swapLabel(shown);
      }
    }
  };

  /* ── orchestrator ── */
  const run = async (
    text: string,
    sig: AbortSignal,
    cfg: RunCfg,
    fromBall = false,
    quiet = false,
  ) => {
    const reduced = env.isReduced();
    const go = async (tracks: Track[]) => {
      await play(tracks, sig);
      if (sig.aborted) throw ABORT;
    };
    try {
      if (!quiet) {
        env.ui.setPhase("launch");
        hist.length = 0;
        if (!reduced) {
          if (fromBall) {
            await go(launchBallTracks());
          } else {
            await go(launchTracks(geo));
          }
          setNow("r", ORB_D / 2);
          env.ui.setPhase("assemble");
          await go(ASSEMBLE);
        } else {
          await go(R_OUT);
          setNow("u", 1);
          setNow("w", ORB_D);
          setNow("h", ORB_D);
          setNow("r", ORB_D / 2);
          setNow("sTy", 0);
          setNow("orb.k", 1);
          setNow("orb.spin", 0);
          env.ui.setPhase("assemble");
          await go(R_IN);
        }
      }
      /* Quiet starts skip the morph, so the caller's work line (set in
         the same tick the pulse is requested) is still one React commit
         away — yield a frame so the read below names the real call
         instead of falling into the generic label cycle. */
      if (quiet) {
        await abortable(
          new Promise<void>((r) => requestAnimationFrame(() => r())),
          sig,
        );
        if (sig.aborted) throw ABORT;
      }
      /* think — until the answer settled AND the minimum time elapsed */
      env.ui.setPhase("think");
      // Ink dots, working spin, the light programs back on: a quiet
      // pulse starts from the settled holding pose, so blend back to
      // the thinking pose here (no-op when a fresh cycle already is one).
      toPose(THINK_POSE, sig);
      const workLabel = env.getWorkLabel();
      if (workLabel !== null) {
        // Honest line: names the call actually in flight, no cycling.
        env.ui.swapLabel(workLabel);
        env.ui.live(workLabel);
      } else {
        orb.P.prog = 0;
        env.ui.swapLabel(COPY.labels[0]);
        env.ui.live(COPY.labels[0]);
      }
      const ctl = { stop: false };
      void labelFollow(sig, ctl);
      const t0 = performance.now();
      const pending = Promise.resolve()
        .then(() => cfg.onSubmit(text))
        .then(
          (b) => (typeof b === "string" && b.trim() ? b : COPY.answerBody),
          () => COPY.answerBody,
        );
      const got = await abortable(pending, sig);
      if (sig.aborted) throw ABORT;
      const body = got ?? COPY.answerBody;
      await sleep(
        cfg.minThink / env.getSpeed() - (performance.now() - t0),
        sig,
      );
      ctl.stop = true;
      if (sig.aborted) throw ABORT;

      /* Quiet legs never unfold a receipt card. "wait" plays the
         resolve sweep, then holds the orb with a nudge for input;
         "clear" plays resolve + the green condense flash, then
         dissolves everything so the result below takes over. */
      if (cfg.end !== "card") {
        env.ui.setPhase("resolve");
        // Legs end quietly: only the final leg ("clear") may print
        // Done. Mid-run legs keep the work line through the sweep,
        // then hand straight to the waiting nudge. Spec §5.
        if (cfg.end === "clear") env.ui.swapLabel(COPY.done);
        if (!reduced) {
          await go(RESOLVE);
        } else {
          await go(R_RESOLVE);
        }
        if (cfg.end === "wait") {
          env.ui.setPhase("waiting");
          const waitLabel = env.getWaitLabel();
          env.ui.swapLabel(waitLabel);
          env.ui.live(waitLabel);
          if (!reduced) setNow("orb.spin", 0.25);
          settled = true;
          return;
        }
        if (!reduced) {
          env.ui.setPhase("condense");
          await go(CONDENSE);
          await go(R_GREEN_OUT);
        } else {
          env.ui.setPhase("condense");
          await go(R_CONDENSE);
          await go(R_GREEN_OUT);
        }
        env.ui.setPhase("answered");
        env.ui.live(COPY.done);
        return;
      }

      const words = body.split(/\s+/).filter(Boolean);
      const n = Math.max(1, words.length);

      if (!reduced) {
        env.ui.setPhase("resolve");
        env.ui.swapLabel(COPY.done);
        await go(RESOLVE);

        env.ui.setPhase("condense");
        await go(CONDENSE);

        env.ui.setPhase("unfold");
        wDur = 320;
        wStagger = n > 1 ? Math.min(45, 280 / (n - 1)) : 0;
        env.ui.setAnswer(body);
        await go(unfoldTracks(geo, (n - 1) * wStagger + wDur));
      } else {
        env.ui.setPhase("resolve");
        env.ui.swapLabel(COPY.done);
        await go(R_RESOLVE);
        await sleep(350 / env.getSpeed(), sig);
        if (sig.aborted) throw ABORT;

        env.ui.setPhase("condense");
        setNow("gs", 1);
        await go(R_CONDENSE);

        env.ui.setPhase("unfold");
        wDur = 250;
        wStagger = 0;
        env.ui.setAnswer(body);
        await go(R_GREEN_OUT);
        setNow("w", geo.cw);
        setNow("h", CARD_H);
        setNow("r", BOX_R);
        setNow("dotS", 1);
        await go(rCardIn(wDur));
      }

      env.ui.setPhase("answered");
      env.ui.live("Answer ready: " + body);
      env.ui.focusAnswer();
    } catch (e) {
      if (e === ABORT) return;
      hard();
    }
  };

  /* ── return to the idle pill ── */
  const toIdle = async (kind: "reset" | "esc") => {
    if (idling) return;
    idling = true;
    stopBeat();
    const my = ++epoch;
    const ac = child();
    idleCtl = ac;
    const sig = ac.signal;
    const outMs = kind === "reset" ? 240 : 200;
    const inMs = kind === "reset" ? 420 : 200;
    env.ui.setPhase("reset");

    const out: Track[] = [T("cHalo", vals.cHalo ?? 0, 0, 0, outMs, E.out)];
    for (const ch of FADE) {
      const v = vals[ch] ?? 0;
      if (v > 0.001) out.push(T(ch, v, 0, 0, outMs, E.out));
    }
    if (kind === "reset") out.push(T("cs", 1, 0.98, 0, outMs, E.out));
    await play(out, sig);
    if (sig.aborted || my !== epoch) return;

    setNow("pulse", -1);
    env.ui.setAnswer("");
    env.ui.resetLabel();
    env.ui.clearInput();
    orb.reset();
    hist.length = 0;
    geo.pw = pillW();
    geo.cw = cardW();
    geo.H = homeDy();
    resetChannels();
    const pillCh = ["oPill", "oInput", "oGlow", "oAur", "oRing"];
    pillCh.forEach((ch) => setNow(ch, 0));
    setNow("yOff", kind === "reset" ? 8 : 0);
    const inn: Track[] = pillCh.map((ch) => T(ch, 0, 1, 0, inMs, E.out));
    if (kind === "reset") inn.push(T("yOff", 8, 0, 0, inMs, E.out));
    await play(inn, sig);
    if (sig.aborted || my !== epoch) return;

    resetChannels();
    current = null;
    idleCtl = null;
    busy = false;
    idling = false;
    env.ui.lock(false);
    env.ui.setPhase("idle");
    env.ui.idleReady();
  };

  function hard() {
    epoch++;
    current?.abort();
    current = null;
    idleCtl?.abort();
    idleCtl = null;
    stopBeat();
    orb.reset();
    hist.length = 0;
    env.ui.setAnswer("");
    env.ui.resetLabel();
    geo.pw = pillW();
    geo.cw = cardW();
    geo.H = homeDy();
    resetChannels();
    setNow("pulse", -1);
    busy = false;
    idling = false;
    env.ui.lock(false);
    env.ui.setPhase("idle");
    env.ui.idleReady();
  }

  /** Between-leg beat (see OrbHandle.beat): the host parks an advance
   *  while the orb glides down and back up; no cycle runs, so hold the
   *  thinking pose for the whole window — the glide never rides in the
   *  waiting colour. `false` hands back to the holding pose. Refused
   *  off the settled waiting orb: a live cycle owns its own pose. */
  function beat(on: boolean, label?: string) {
    if (!settled || idling) return;
    beatCtl?.abort();
    beatCtl = child();
    toPose(on ? THINK_POSE : HOLD_POSE, beatCtl.signal);
    if (on) orb.P.prog = 0;
    const line = on ? (label ?? COPY.waiting) : env.getWaitLabel();
    env.ui.swapLabel(line);
    env.ui.live(line);
  }

  resetChannels();

  return {
    start(text, cfg) {
      if (busy) return false;
      busy = true;
      stopBeat();
      geo.pw = pillW();
      geo.cw = cardW();
      geo.H = homeDy(); // snapshot once, never read layout in frames
      geo.dir = -geo.dir;
      orb.reset();
      setNow("u", 0);
      const ac = child();
      current = ac;
      env.ui.lock(true);
      void run(text, ac.signal, cfg);
      return true;
    },
    startFromBall(text, cfg) {
      if (busy) return false;
      busy = true;
      stopBeat();
      geo.pw = pillW();
      geo.cw = cardW();
      geo.H = homeDy();
      geo.dir = -geo.dir;
      orb.reset();
      // Ball state: what launchTracks leaves behind at t=620.
      setNow("w", BALL_SMALL);
      setNow("h", BALL_SMALL);
      setNow("r", BALL_SMALL / 2);
      setNow("oPill", 0);
      setNow("oBall", 1);
      setNow("oGlow", 0);
      setNow("oAur", 0);
      setNow("oInput", 0);
      setNow("u", 0);
      const ac = child();
      current = ac;
      env.ui.lock(true);
      void run(text, ac.signal, cfg, true);
      return true;
    },
    pulse(text, cfg) {
      // Take over from a settled cycle: the wait-end resolve returns
      // with busy still set (only hard()/toIdle clear it), yet no work
      // remains — release it here without touching the current frame,
      // so the orb thinks from exactly what is on screen. The ref
      // entry only allows this from waiting, where no cycle runs.
      stopBeat();
      busy = false;
      current?.abort();
      current = null;
      busy = true;
      // No reset, no launch: the orb is already assembled (waiting),
      // so work starts straight into think from the current frame.
      const ac = child();
      current = ac;
      env.ui.lock(true);
      void run(text, ac.signal, cfg, false, true);
      return true;
    },
    escape() {
      if (!busy || idling) return;
      current?.abort();
      void toIdle("esc");
    },
    reset() {
      if (!busy || idling) return;
      void toIdle("reset");
    },
    hard,
    beat,
    home() {
      if (busy) return;
      geo.pw = pillW();
      geo.cw = cardW();
      geo.H = homeDy();
      setNow("w", geo.pw);
      setNow("u", 0);
    },
    busy: () => busy,
    destroy() {
      life.abort();
      orb.destroy();
    },
  };
}

/* ───────────────────────────── component ───────────────────────────── */
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function MorphOrb(props: MorphOrbProps) {
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [lbl, setLbl] = useState<{
    cur: string;
    prev: string | null;
    n: number;
  }>({ cur: COPY.labels[0], prev: null, n: 0 });
  const [answer, setAnswer] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const moverRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const ghostRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const phaseRef = useRef<Phase>("idle");
  const reducedRef = useRef(false);
  const rtRef = useRef<Runtime | null>(null);
  const textRef = useRef("");
  const workLabelRef = useRef<string | null>(null);
  const waitLabelRef = useRef("");

  const propsRef = useRef(props);
  propsRef.current = props;
  workLabelRef.current = props.workingLabel ?? null;
  waitLabelRef.current = props.waitingLabel ?? "";
  const speedRef = useRef(1);
  speedRef.current = props.speed ?? 1;

  useIsoLayoutEffect(() => {
    const root = rootRef.current,
      mover = moverRef.current,
      actor = actorRef.current,
      canvas = canvasRef.current;
    const pulse = pulseRef.current,
      status = statusRef.current;
    const ghosts = ghostRefs.current.filter((g): g is HTMLSpanElement => !!g);
    if (!root || !mover || !actor || !canvas || !pulse || !status) return;
    measureStage(root);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onMq = (e: MediaQueryListEvent) => {
      reducedRef.current = e.matches;
    };
    mq.addEventListener("change", onMq);

    const rt = createRuntime({
      root,
      mover,
      actor,
      ghosts,
      canvas,
      pulse,
      status,
      getBody: () => bodyRef.current,
      getWorkLabel: () => workLabelRef.current,
      getWaitLabel: () => waitLabelRef.current || COPY.waiting,
      getSpeed: () => speedRef.current,
      isReduced: () => reducedRef.current,
      ui: {
        setPhase: (p) => {
          phaseRef.current = p;
          setPhaseState(p);
          propsRef.current.onPhaseChange?.(p);
        },
        swapLabel: (name) =>
          setLbl((l) =>
            l.cur === name ? l : { cur: name, prev: l.cur, n: l.n + 1 },
          ),
        resetLabel: () =>
          setLbl((l) => ({ cur: COPY.labels[0], prev: null, n: l.n + 1 })),
        setAnswer: (s) => setAnswer(s),
        clearInput: () => {
          textRef.current = "";
        },
        live: (s) => {
          if (liveRef.current) liveRef.current.textContent = s;
        },
        lock: () => {},
        idleReady: () => {},
        focusAnswer: () => {
          answerRef.current?.focus({ preventScroll: true });
        },
      },
    });
    rtRef.current = rt;

    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        phaseRef.current !== "idle" &&
        phaseRef.current !== "reset"
      ) {
        e.preventDefault();
        rt.escape();
      }
    };
    const onResize = () => {
      measureStage(rootRef.current);
      if (phaseRef.current === "idle" && !rt.busy()) rt.home();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      mq.removeEventListener("change", onMq);
      rt.destroy();
      rtRef.current = null;
    };
  }, []);

  const defaultSubmit = () =>
    new Promise<string>((res) => {
      window.setTimeout(() => res(COPY.answerBody), 4600 / speedRef.current);
    });
  const makeCfg = (end: OrbEnd = "card"): RunCfg => ({
    onSubmit: propsRef.current.onSubmit ?? defaultSubmit,
    minThink: propsRef.current.minThinkMs ?? 3450,
    end,
  });

  /* Ref-based under the hood (makeCfg reads propsRef at call time),
     so re-creation is identity churn only, never stale behaviour. */
  const submitText = (raw: string, end: OrbEnd = "card") => {
    const rt = rtRef.current;
    if (!rt || rt.busy() || phaseRef.current !== "idle") return;
    const text = raw.trim();
    if (text === "") return;
    textRef.current = text;
    rt.start(text, makeCfg(end));
  };

  const submitFromBallText = (raw: string, end: OrbEnd = "card") => {
    const rt = rtRef.current;
    if (!rt || rt.busy() || phaseRef.current !== "idle") return;
    const text = raw.trim();
    if (text === "") return;
    textRef.current = text;
    rt.startFromBall(text, makeCfg(end));
  };

  const words = answer.split(/\s+/).filter(Boolean);

  useImperativeHandle(
    props.orbRef,
    () => ({
      /* One orb cycle around caller work: hard-reset (sync, so a stale
         answered card never lingers), then start on the next frame.
         Refused while a cycle is mid-flight; allowed from
         answered/idle/waiting/reset. */
      ask: (text, work, end = "card") => {
        const rt = rtRef.current;
        if (!rt) return;
        const phase = phaseRef.current;
        if (
          phase !== "answered" &&
          phase !== "idle" &&
          phase !== "waiting" &&
          phase !== "reset"
        )
          return;
        rt.hard();
        textRef.current = text;
        const cfg: RunCfg = {
          onSubmit: () => work(text),
          minThink: propsRef.current.minThinkMs ?? 3450,
          end,
        };
        window.requestAnimationFrame(() => {
          rt.start(text, cfg);
        });
      },
      reset: () => {
        rtRef.current?.reset();
      },
      pulse: (text, work, end = "card") => {
        const rt = rtRef.current;
        if (!rt) return false;
        // Assembled orb only (waiting): from the pill or a receipt
        // card there is no orb frame to think from.
        if (phaseRef.current !== "waiting") return false;
        textRef.current = text;
        const cfg: RunCfg = {
          onSubmit: () => work(text),
          minThink: propsRef.current.minThinkMs ?? 3450,
          end,
        };
        return rt.pulse(text, cfg);
      },
      beat: (on, label) => {
        rtRef.current?.beat(on, label);
      },
      setText: (text: string) => {
        textRef.current = text;
      },
      submit: (text?: string, end: OrbEnd = "card") => {
        submitText(text ?? textRef.current, end);
      },
      submitFromBall: (text?: string, end: OrbEnd = "card") => {
        submitFromBallText(text ?? textRef.current, end);
      },
    }),
    [submitText],
  );

  const labelInner = (name: string) =>
    name === COPY.done ? (
      <span className="mo-lab-done">{name}</span>
    ) : (
      <>
        <span className="mo-lab-t">{name}</span>
        <span className="mo-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </>
    );

  return (
    <div className="mo-root" data-phase={phase} ref={rootRef}>
      <div className="mo-bg" aria-hidden="true" />
      <div className="mo-halo" aria-hidden="true" />

      <div className="mo-mover" ref={moverRef}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className="mo-trail"
            aria-hidden="true"
            ref={(el) => {
              ghostRefs.current[i] = el;
            }}
          />
        ))}

        <div className="mo-actor" ref={actorRef}>
          <div className="mo-underglow" aria-hidden="true" />
          <div className="mo-halo-green" aria-hidden="true" />
          <div className="mo-surface" aria-hidden="true">
            <div className="mo-aurora">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="mo-ball" aria-hidden="true" />
          <div className="mo-green" aria-hidden="true" />
          <div className="mo-card" aria-hidden="true" />
          <div className="mo-ring" aria-hidden="true" />

          <canvas className="mo-orb" ref={canvasRef} aria-hidden="true" />
          <div className="mo-pulse" ref={pulseRef} aria-hidden="true" />

          <div
            className="mo-answer"
            ref={answerRef}
            tabIndex={-1}
            role="group"
            aria-label={COPY.answerTitle}
          >
            <div className="mo-a-head">
              <i className="mo-a-dot" aria-hidden="true" />
              <span>{COPY.answerTitle}</span>
            </div>
            <p className="mo-a-body" ref={bodyRef}>
              {words.map((w, i) => (
                <span key={i} className="mo-w">
                  {w}{" "}
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>

      <div className="mo-status" ref={statusRef} aria-hidden="true">
        {lbl.prev !== null && (
          <span key={"p" + lbl.n} className="mo-lab mo-out">
            {labelInner(lbl.prev)}
          </span>
        )}
        <span key={"c" + lbl.n} className="mo-lab mo-in">
          {labelInner(lbl.cur)}
        </span>
      </div>

      <div className="mo-live" ref={liveRef} role="status" aria-live="polite" />
    </div>
  );
}
