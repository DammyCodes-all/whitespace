/**
 * The dotted orb: a canvas renderer for the sphere of light dots.
 *
 * The dots live on a fixed sphere (deterministic seed, so every mount
 * draws the same orb). The runtime drives ten parameters on it — k,
 * alpha, spin, sweep, pop, vortex, gain, floor, rad — and the renderer
 * turns them into positions, sizes and opacities.
 */

import { clamp01, E, lerp, mulberry32, TAU } from "@/components/ui/orb/easing";
import { CANVAS, ORB_R } from "@/components/ui/orb/geometry";

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

export interface OrbParams {
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
export const ORB_KEYS = [
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

/** The renderer the runtime drives: the live parameters plus its frame. */
export interface OrbRenderer {
  P: OrbParams;
  /** Start the frame loop (no-op when the orb is not visible). */
  ensure: () => void;
  /** Back to the resting parameters. */
  reset: () => void;
  /** Stop the frame loop for good. */
  destroy: () => void;
}

export function createOrb(
  canvas: HTMLCanvasElement,
  getSpeed: () => number,
  isReduced: () => boolean,
): OrbRenderer {
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
