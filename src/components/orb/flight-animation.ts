import type { FlightRect } from "@/components/entry-box";

/**
 * The handoff's move as a single in-place morph: the run page renders
 * the landing box's twin at the idle pill and condenses it card → ink
 * ball there, then joins the runtime at the ball with a hard swap (no
 * crossfade). Nothing travels — the old translate-then-condense flight
 * read as the card drifting sideways before morphing, so the travel
 * was cut: the twin appears at the pill and reshapes where it sits.
 *
 * The clone is portaled to <body>: a fixed child of a transformed
 * ancestor (the .page-enter rise) would ride along with it.
 *
 * The swap: the clone's last frame IS the runtime's first ball frame
 * (60px flat ink, same centre, same fill), so the old 160ms crossfade
 * double-exposed two inks — instead the runtime joins at the ball and
 * the clone clears a frame later (see the data-handoff rule in
 * globals.css). The pitch text melts out first (blur + drop) while the
 * box condenses behind it, so it never sits still for the cut.
 */

export function morphClone({
  shape,
  text,
  from,
  target,
  onJoin,
  onDone,
}: {
  /** Inner layer: sits at `target`, scales + reshapes card → ball. */
  shape: HTMLDivElement;
  /** Pitch text: melted out in the opening beat. */
  text: HTMLElement | null;
  /** The landing box: sizes the opening card frame. */
  from: FlightRect;
  /** The idle pill: where the twin renders and condenses. */
  target: FlightRect;
  /** The clone condensed: join the runtime's ball. */
  onJoin: () => void;
  /** A frame after the join: safe to unmount the clone. */
  onDone: () => void;
}): Animation {
  const tw = Math.max(1, target.width);
  const th = Math.max(1, target.height);
  // In place, one curve: the twin opens at the box's own size centred
  // on the pill, then condenses to the 60px ball. Origin is the CSS
  // centre (see .flight-inner), so no corner drifts while it shrinks —
  // and 50% radius resolves to a true 30px circle at touchdown under
  // the non-uniform scale.
  const morph = shape.animate(
    [
      {
        transform: `scale(${from.width / tw}, ${from.height / th})`,
        borderRadius: "16px / 16px",
        backgroundColor: "#ffffff",
        boxShadow: "4px 4px 0 #17151f",
        offset: 0,
      },
      {
        transform: `scale(${60 / tw}, ${60 / th})`,
        borderRadius: "50%",
        backgroundColor: "#17151f",
        boxShadow: "0px 0px 0 rgba(23,21,31,0)",
        offset: 1,
      },
    ],
    {
      duration: 550,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    },
  );
  morph.onfinish = () => {
    onJoin();
    window.requestAnimationFrame(onDone);
  };
  // Input melt: the pitch text blurs + drops out fast in the
  // opening beat (the original's inScale melt), while the box
  // keeps condensing behind it.
  text?.animate(
    [
      { opacity: "1", filter: "blur(0px)" },
      { opacity: "0", filter: "blur(12px)" },
    ],
    { duration: 200, easing: "ease-out", fill: "forwards" },
  );

  return morph;
}
