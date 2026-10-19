/**
 * The comet trail behind the flying orb.
 *
 * The trail is six ghost copies of the orb, each trailing 45ms behind
 * the last, sampled from a 500ms history of where the orb has been.
 * The ghosts scale with the orb's current diameter, so the trail thins
 * as the orb grows.
 */

import { lerp } from "@/components/ui/orb/easing";
import { BALL_SMALL } from "@/components/ui/orb/geometry";

interface Sample {
  t: number;
  x: number;
  y: number;
  d: number;
}

/** Where the orb was at time `t`, interpolated from the path history. */
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

export interface Trail {
  /** The orb's current diameter — the ghosts scale with it. */
  setDiameter(d: number): void;
  /** Trail visibility; 0 hides the ghosts. */
  setVisible(v: number): void;
  /** Move the orb: writes the transform and records the path. */
  move(x: number, y: number): void;
  /** Drop the path history (a new leg starts clean). */
  clear(): void;
}

export function createTrail(mover: HTMLElement, ghosts: HTMLElement[]): Trail {
  let curX = 0;
  let curY = 0;
  let curD = BALL_SMALL;
  let vis = 0;
  let shown = false;
  const hist: Sample[] = [];
  const tmp: Sample = { t: 0, x: 0, y: 0, d: 0 };

  const render = () => {
    if (vis <= 0.001) {
      if (shown) {
        ghosts.forEach((g) => (g.style.opacity = "0"));
        shown = false;
      }
      return;
    }
    shown = true;
    const now = performance.now();
    for (let i = 0; i < ghosts.length; i++) {
      sampleAt(hist, now - (i + 1) * 45, tmp);
      const k = (tmp.d * (1 - 0.08 * (i + 1))) / 100;
      const g = ghosts[i];
      g.style.transform = `translate3d(${(tmp.x - curX).toFixed(2)}px,${(tmp.y - curY).toFixed(2)}px,0) translate(-50%,-50%) scale(${k.toFixed(3)})`;
      g.style.opacity = (0.28 * (1 - i / 6) ** 1.5 * vis).toFixed(3);
    }
  };

  return {
    setDiameter(d) {
      curD = d;
    },
    setVisible(v) {
      vis = v;
      render();
    },
    move(x, y) {
      curX = x;
      curY = y;
      mover.style.transform = `translate3d(${curX.toFixed(2)}px,${curY.toFixed(2)}px,0)`;
      const now = performance.now();
      hist.push({ t: now, x: curX, y: curY, d: curD });
      while (hist.length > 2 && hist[0].t < now - 500) hist.shift();
      render();
    },
    clear() {
      hist.length = 0;
    },
  };
}
