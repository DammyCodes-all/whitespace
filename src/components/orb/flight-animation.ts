import type { FlightRect } from "@/components/entry-box";
import {
  BALL_D,
  BALL_MS,
  CARD_R,
  COLLAPSE_FROM_MS,
  EASE_PUSH,
  EASE_SETTLE,
  INK_MS,
  MELT_MS,
  SQUASH_MS,
  SQUEEZE_OVER,
  SQUEEZE_TALL,
} from "@/components/orb/morph-geometry";

/**
 * The handoff's move: one shape, never cut (beats and the motion
 * language live in morph-geometry). The landing box's twin morphs its
 * own size, radius and colour through two states — real geometry in
 * px, never scale, so the 2px border and the hard shadow stay crisp to
 * the last frame:
 *
 *   card     0ms      the input as typed (landing rect, 16px corners)
 *   melt     0–170    the pitch blurs and drops out while the card
 *                     barely moves — the content is out of the way
 *                     before the shape takes the eye
 *   collapse 80–340   the empty card falls straight into the circle,
 *                     well past it: 16px narrower, 7px taller — the
 *                     egg (no state in between: the squash IS the
 *                     arrival, and the corners clamp to a stadium on
 *                     the way, so the last of the card rounds off for
 *                     free)
 *           340–480   the egg springs back out to the ball, overshooting
 *                     it by a few px before resting
 *   ink      480–590  surface → ink once the shape has landed
 *
 * The last frame IS the runtime's first ball frame (same centre, size,
 * radius, fill — the join contract), so the runtime joins at the ball
 * and the clone clears a frame later (see the data-handoff rule in
 * globals.css) — a still-frame cut that reads as one gesture.
 *
 * The clone is portaled to <body> (see OrbFlightClone): a fixed child
 * of a transformed ancestor (the .page-enter rise) would ride along.
 *
 * Reduced motion never reaches here — use-orb-flight drops the stored
 * rect and the runtime plays its crossfade path instead.
 */

/** The ink turn is a fill, not a move: a plain ease-out, no bounce. */
const EASE_INK = "cubic-bezier(0.23, 1, 0.32, 1)";

const at = (ms: number) => ms / INK_MS;

export function morphClone({
  shape,
  text,
  from,
  onJoin,
  onDone,
  speed = 1,
}: {
  /** The twin's shape layer: real geometry card → ball, at the ball spot. */
  shape: HTMLDivElement;
  /** Pitch text: melted out in the opening beat. */
  text: HTMLElement | null;
  /** The landing box: sizes the opening card frame. */
  from: FlightRect;
  /** The clone condensed: join the runtime's ball. */
  onJoin: () => void;
  /** A frame after the join: safe to unmount the clone. */
  onDone: () => void;
  /** Orb pace multiplier (1 = live), shared with the runtime. */
  speed?: number;
}): Animation {
  const pace = Math.max(0.2, speed);

  // Fill and ink come from the twin's own computed tokens (surface,
  // outline) and the document's --ink, so the final frame matches the
  // runtime ball (.mo-ball paints var(--ink)) under any future token
  // change — no hardcoded hex drifting out of step.
  const cs = getComputedStyle(shape);
  const surface = cs.backgroundColor || "#ffffff";
  const outline = cs.borderColor || "#17151f";
  const ink =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--ink")
      .trim() || outline;

  const fw = Math.max(1, Math.round(from.width));
  const fh = Math.max(1, Math.round(from.height));

  const morph = shape.animate(
    [
      {
        /* card: still the input */
        width: `${fw}px`,
        height: `${fh}px`,
        borderRadius: `${CARD_R}px`,
        backgroundColor: surface,
        boxShadow: `4px 4px 0 ${outline}`,
        offset: 0,
        easing: "linear",
      },
      {
        /* the same card a beat later, when the collapse takes over:
           the melt gets its head start (identical values, so nothing
           moves before COLLAPSE_FROM_MS) */
        width: `${fw}px`,
        height: `${fh}px`,
        borderRadius: `${CARD_R}px`,
        backgroundColor: surface,
        boxShadow: `4px 4px 0 ${outline}`,
        offset: at(COLLAPSE_FROM_MS),
        easing: EASE_PUSH,
      },
      {
        /* the collapse's squash point: narrower and taller than the
           ball (the egg) */
        width: `${BALL_D - SQUEEZE_OVER}px`,
        height: `${BALL_D + SQUEEZE_TALL}px`,
        borderRadius: `${BALL_D / 2}px`,
        backgroundColor: surface,
        boxShadow: `2px 2px 0 ${outline}`,
        offset: at(SQUASH_MS),
        easing: EASE_SETTLE,
      },
      {
        /* the ball, still surface — the ink turn waits for the settle */
        width: `${BALL_D}px`,
        height: `${BALL_D}px`,
        borderRadius: `${BALL_D / 2}px`,
        backgroundColor: surface,
        boxShadow: `2px 2px 0 ${outline}`,
        offset: at(BALL_MS),
        easing: EASE_INK,
      },
      {
        /* ink: the closing beat only */
        width: `${BALL_D}px`,
        height: `${BALL_D}px`,
        borderRadius: `${BALL_D / 2}px`,
        backgroundColor: ink,
        boxShadow: "0px 0px 0 rgba(23, 21, 31, 0)",
        offset: 1,
      },
    ],
    { duration: Math.round(INK_MS / pace), fill: "forwards" },
  );
  morph.onfinish = () => {
    onJoin();
    window.requestAnimationFrame(onDone);
  };

  // Input melt: blur + a real drop, fast and early so the text is gone
  // before the collapse takes over the eye.
  text?.animate(
    [
      { opacity: "1", filter: "blur(0px)", transform: "translateY(0px)" },
      { opacity: "0", filter: "blur(10px)", transform: "translateY(10px)" },
    ],
    {
      duration: Math.round(MELT_MS / pace),
      easing: EASE_INK,
      fill: "forwards",
    },
  );

  return morph;
}
