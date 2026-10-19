/**
 * The input → circle morph's shared geometry, beats and curves.
 *
 * One shape, never cut: the input and the circle are the same element
 * in two states. Every transition moves size, radius and colour on that
 * element; only the content swaps, with a short blur.
 *
 * The motion is authored as spring beats, not slides. Every beat has a
 * push (soft at both ends — it compresses into the far state with no
 * speed left) and a settle (a fast release that overshoots a hair and
 * rests). The overshoots are deliberate, small, and measured in px so
 * they read the same at every size:
 *
 *   melt     0–170   the pitch blurs and drops out while the card
 *                    barely moves — content leaves before the shape
 *                    travels (the collapse follows just behind it, at
 *                    COLLAPSE_FROM_MS)
 *   collapse 80–340  the empty card falls straight into the circle,
 *                    well past it: SQUEEZE_OVER narrower and
 *                    SQUEEZE_TALL taller — the egg
 *          340–480   the egg springs back out to the ball, overshooting
 *                    it by a few px before resting
 *   ink      480–590 the fill turns once the shape has landed, never
 *                    mid-squeeze, where a darkening reads as a blink
 *
 * There is no intermediate state between the two: the card is the
 * input, the ball is the circle, and the only thing between them is
 * the squash that gives the arrival its weight.
 *
 * Both halves of the movement read these numbers, so they can never
 * drift apart:
 *  - the flight clone (WAAPI keyframes, `flight-animation.ts`);
 *  - the runtime's own launch (`launchTracks`).
 *
 * The join contract: the clone's last frame is the runtime's first
 * ball frame — BALL_D wide, fully round, ink.
 */

/** Join ball: the clone ends here, the runtime picks up here. */
export const BALL_D = 60;
/** The card state's corner radius (the landing box). */
export const CARD_R = 16;

/* Beat boundaries in ms at pace 1 (every duration scales by 1/pace). */
export const MELT_MS = 170;
export const COLLAPSE_FROM_MS = 80;
export const SQUASH_MS = 340;
export const BALL_MS = 480;
export const INK_MS = 590;

/* Overshoot depths in px — the squash each settle springs back from.
   Deep enough to read as rubber, shallow enough to stay a ball. */
/** The collapse passes the ball's width by this much (the squash). */
export const SQUEEZE_OVER = 16;
/** …and stands this much taller than it while squashed (the egg). */
export const SQUEEZE_TALL = 7;

/** Standard cubic-bezier solver: control points → easing function. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
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
  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)));
}

/* The two curves every beat rides. Push: zero speed at both ends, so
   the shape arrives on the squash rather than through it. Settle: a
   fast release with a ~16% overshoot — a few px on the distances it
   runs on — that rests exactly on the target. */
const PUSH_PTS = [0.55, 0, 0.15, 1] as const;
const SETTLE_PTS = [0.3, 1.75, 0.6, 1] as const;

export const EASE_PUSH = `cubic-bezier(${PUSH_PTS.join(", ")})`;
export const EASE_SETTLE = `cubic-bezier(${SETTLE_PTS.join(", ")})`;

/** The same curves as functions, for the runtime's track engine. */
export const pushEase = cubicBezier(...PUSH_PTS);
export const settleEase = cubicBezier(...SETTLE_PTS);
