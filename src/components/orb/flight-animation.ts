import type { FlightRect } from "@/components/entry-box";

/**
 * The handoff's move as composited DOM animation: the run page's twin
 * clone flies from the stored landing-box rect to the idle pill while
 * it reshapes card → ink ball, then joins the runtime at the ball with
 * a hard swap (no crossfade). A ball-shaped rect (the entry already
 * morphed in place) flies straight, no morph.
 *
 * Two composited layers, one job each — the outer translates the
 * flight, the inner scales + reshapes — so no flight frame re-lays-out,
 * and the translate runs on one curve the whole way (the old single
 * left/top/width/height track stopped dead at the pill and restarted).
 * The clone is portaled to <body>: a fixed child of a transformed
 * ancestor (the .page-enter rise) would ride along with it.
 *
 * The swap: the clone's last frame IS the runtime's first ball frame
 * (60px flat ink, same centre, same fill), so the old 160ms crossfade
 * double-exposed two inks — instead the runtime joins at the ball and
 * the clone clears a frame later (see the data-handoff rule in
 * globals.css). The pitch text melts out first (blur + drop) while the
 * box keeps flying behind it, so it never sits still for the cut.
 */

export function flyClone({
  clone,
  shape,
  text,
  from,
  target,
  onJoin,
  onDone,
}: {
  /** Outer layer: position at `from`, translates only. */
  clone: HTMLDivElement;
  /** Inner layer: scales + reshapes card → ball. */
  shape: HTMLDivElement | null;
  /** Pitch text: melted out in the opening beat. */
  text: HTMLElement | null;
  from: FlightRect;
  target: FlightRect;
  /** The clone landed: join the runtime's ball. */
  onJoin: () => void;
  /** A frame after the join: safe to unmount the clone. */
  onDone: () => void;
}): Animation {
  const cx = target.left + target.width / 2 - 30;
  const cy = target.top + target.height / 2 - 30;

  const fly = clone.animate(
    [
      { transform: "translate3d(0px, 0px, 0)" },
      {
        transform: `translate3d(${cx - from.left}px, ${cy - from.top}px, 0)`,
      },
    ],
    {
      duration: 650,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    },
  );
  fly.onfinish = () => {
    onJoin();
    window.requestAnimationFrame(onDone);
  };

  // Ball handoff (the entry morphed in place before navigating): the
  // clone is already a 60px ink ball — the flight is pure translate.
  if (from.shape === "ball" || shape === null) return fly;

  const w = Math.max(1, from.width);
  const h = Math.max(1, from.height);
  // Card → ball: hold the entry's own shape through the flight (card
  // and pill are the same 720×200 at every width we ship), then
  // condense in the last third. The radius lands in local px, so the
  // non-uniform scale resolves it to a true 30px circle at touchdown.
  shape.animate(
    [
      { transform: "scale(1, 1)", offset: 0 },
      {
        transform: `scale(${target.width / w}, ${target.height / h})`,
        offset: 0.62,
      },
      {
        transform: `scale(${60 / w}, ${60 / h})`,
        offset: 1,
      },
    ],
    {
      duration: 650,
      easing: "cubic-bezier(0.65, 0, 0.35, 1)",
      fill: "forwards",
    },
  );
  shape.animate(
    [
      {
        borderRadius: "16px / 16px",
        backgroundColor: "#ffffff",
        boxShadow: "4px 4px 0 #17151f",
        offset: 0,
      },
      {
        borderRadius: "16px / 16px",
        backgroundColor: "#ffffff",
        boxShadow: "4px 4px 0 #17151f",
        offset: 0.68,
      },
      {
        borderRadius: `${w / 2}px / ${h / 2}px`,
        backgroundColor: "#17151f",
        boxShadow: "0px 0px 0 rgba(23,21,31,0)",
        offset: 1,
      },
    ],
    {
      duration: 650,
      easing: "cubic-bezier(0.65, 0, 0.35, 1)",
      fill: "forwards",
    },
  );
  // Input melt: the pitch text blurs + drops out fast in the
  // opening beat (the original's inScale melt), while the box
  // keeps flying + reshaping behind it.
  text?.animate(
    [
      { opacity: "1", filter: "blur(0px)" },
      { opacity: "0", filter: "blur(12px)" },
    ],
    { duration: 200, easing: "ease-out", fill: "forwards" },
  );

  return fly;
}
