import type { FlightRect } from "@/components/entry-box";

/**
 * The handoff's move as plain DOM animation: the run page's twin clone
 * flies from the stored landing-box rect to the idle pill while it
 * reshapes card → ink ball, then joins the runtime at the ball and
 * crossfades out. A ball-shaped rect (the entry already morphed in
 * place) flies straight, no morph.
 *
 * A legacy card rect melts its own text out first (blur + drop) while
 * the box keeps flying behind it, so the pitch never sits still for the
 * cut.
 */

/** The 60px ink disc at the pill's centre — where the runtime joins. */
function ballAt(target: FlightRect) {
  return {
    left: target.left + target.width / 2 - 30,
    top: target.top + target.height / 2 - 30,
  };
}

/** Fade the clone out over the runtime's own fade-in (never a cut). */
function crossfadeOut(clone: HTMLElement, done: () => void) {
  try {
    const fade = clone.animate([{ opacity: "1" }, { opacity: "0" }], {
      duration: 160,
      easing: "ease-out",
      fill: "forwards",
    });
    if (typeof fade.finished === "object" && fade.finished !== null) {
      fade.finished.then(done, done);
    } else {
      window.setTimeout(done, 170);
    }
  } catch {
    done();
  }
}

export function flyClone({
  clone,
  text,
  from,
  target,
  onJoin,
  onDone,
}: {
  clone: HTMLDivElement;
  text: HTMLElement | null;
  from: FlightRect;
  target: FlightRect;
  /** The clone landed: join the runtime's ball. */
  onJoin: () => void;
  /** The clone finished fading: safe to unmount it. */
  onDone: () => void;
}): Animation {
  const ball = ballAt(target);
  let anim: Animation;

  if (from.shape === "ball") {
    // Ball handoff: the entry morphed in place before navigating, so
    // the clone is already a 60px ink ball — just fly it home.
    anim = clone.animate(
      [
        { left: `${from.left}px`, top: `${from.top}px` },
        { left: `${ball.left}px`, top: `${ball.top}px` },
      ],
      {
        duration: 450,
        easing: "cubic-bezier(0.65, 0, 0.35, 1)",
        fill: "forwards",
      },
    );
  } else {
    // Twin of the landing card → ink ball at the pill centre.
    anim = clone.animate(
      [
        {
          left: `${from.left}px`,
          top: `${from.top}px`,
          width: `${from.width}px`,
          height: `${from.height}px`,
          borderRadius: "16px",
          backgroundColor: "#ffffff",
          boxShadow: "4px 4px 0 #17151f",
        },
        {
          left: `${target.left}px`,
          top: `${target.top}px`,
          width: `${target.width}px`,
          height: `${target.height}px`,
          borderRadius: "16px",
          backgroundColor: "#ffffff",
          boxShadow: "4px 4px 0 #17151f",
          offset: 0.6,
        },
        {
          left: `${ball.left}px`,
          top: `${ball.top}px`,
          width: "60px",
          height: "60px",
          borderRadius: "30px",
          backgroundColor: "#17151f",
          boxShadow: "0px 0px 0 rgba(23,21,31,0)",
        },
      ],
      {
        duration: 650,
        easing: "cubic-bezier(0.65, 0, 0.35, 1)",
        fill: "forwards",
      },
    );
    // Input melt: the original's inScale melt, opened out — the text
    // blurs and drops in the opening beat while the box flies on.
    text?.animate(
      [
        { opacity: "1", filter: "blur(0px)" },
        { opacity: "0", filter: "blur(12px)" },
      ],
      { duration: 200, easing: "ease-out", fill: "forwards" },
    );
  }

  anim.onfinish = () => {
    onJoin();
    crossfadeOut(clone, onDone);
  };
  return anim;
}
