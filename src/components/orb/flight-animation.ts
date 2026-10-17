import type { FlightRect } from "@/components/entry-box";

/**
 * The handoff's move: one in-place condense on real geometry. The run
 * page renders the landing box's twin centred on the ball spot, and the
 * twin shrinks its own width/height/radius — never scale — so the 2px
 * border and the hard shadow stay crisp to the last frame (a scale
 * squash distorts strokes at different rates per axis; a geometry
 * squeeze keeps them true). Three beats in 420ms:
 *
 *   melt      0–170ms  the pitch text fades, blurs and drops out while
 *                      the box barely moves — content leaves before the
 *                      shape travels, never two motions fighting
 *   gather    0–126ms  the card nips 16px narrower — a breath before the
 *                      squeeze, so the condense reads as intentional
 *   condense  126–357ms the empty card collapses toward the ball; the
 *                      30px radius clamps to a true circle as it lands
 *   ink       231–378ms the fill and shadow ease from surface to ink
 *                      across the late collapse — a smooth darkening
 *                      (same io family as the orb's own curves), not a
 *                      snap at touchdown, and never grey across the
 *                      whole squeeze: the card keeps its identity while
 *                      it is big and only turns black as it condenses
 *   settle    357–420ms 54 → 60px, the flip completes — the card is the
 *                      ink ball exactly as it lands
 *
 * The swap: the clone's last frame IS the runtime's first ball frame
 * (60px flat ink, same centre, same fill), so a crossfade would
 * double-expose two inks — instead the runtime joins at the ball and
 * the clone clears a frame later (see the data-handoff rule in
 * globals.css). Both halves of the motion pause on the ball, so the
 * cut lands on a still frame and reads as one continuous gesture:
 * squeeze in, spring out into the orb.
 *
 * The clone is portaled to <body>: a fixed child of a transformed
 * ancestor (the .page-enter rise) would ride along with it.
 *
 * Reduced motion never reaches here — use-orb-flight drops the stored
 * rect and the runtime plays its crossfade path instead.
 */

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
  /** Orb pace multiplier (1 = live), shared with the runtime so the
   *  squeeze keeps the same rhythm as the slower journey around it. */
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
        width: `${fw}px`,
        height: `${fh}px`,
        borderRadius: "16px",
        backgroundColor: surface,
        boxShadow: `4px 4px 0 ${outline}`,
        offset: 0,
        easing: "cubic-bezier(0.23, 1, 0.32, 1)",
      },
      {
        width: `${fw - 16}px`,
        height: `${fh}px`,
        borderRadius: "16px",
        backgroundColor: surface,
        boxShadow: `4px 4px 0 ${outline}`,
        offset: 0.3,
        easing: "cubic-bezier(0.77, 0, 0.175, 1)",
      },
      /* The ink beat: fill + shadow only, so width/height interpolate
         straight across these frames. The darkening runs on the same
         io curve the orb runtime uses for on-screen morphs. */
      {
        backgroundColor: surface,
        boxShadow: `4px 4px 0 ${outline}`,
        offset: 0.55,
        easing: "cubic-bezier(0.65, 0, 0.35, 1)",
      },
      {
        width: "54px",
        height: "54px",
        borderRadius: "30px",
        offset: 0.85,
        easing: "cubic-bezier(0.23, 1, 0.32, 1)",
      },
      {
        backgroundColor: ink,
        boxShadow: "0px 0px 0 rgba(23, 21, 31, 0)",
        offset: 0.9,
      },
      {
        width: "60px",
        height: "60px",
        borderRadius: "30px",
        offset: 1,
      },
    ],
    { duration: Math.round(420 / pace), fill: "forwards" },
  );
  morph.onfinish = () => {
    onJoin();
    window.requestAnimationFrame(onDone);
  };

  // Input melt: blur + a real drop this time (the old melt only blurred
  // despite its comment saying otherwise), fast and early so the text is
  // gone before the condense takes over the eye.
  text?.animate(
    [
      { opacity: "1", filter: "blur(0px)", transform: "translateY(0px)" },
      {
        opacity: "0",
        filter: "blur(10px)",
        transform: "translateY(10px)",
      },
    ],
    {
      duration: Math.round(170 / pace),
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
      fill: "forwards",
    },
  );

  return morph;
}
