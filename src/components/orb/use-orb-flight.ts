"use client";

/**
 * The handoff's orchestration. When the landing entry navigates to
 * /run?pitch=, the box's rect is waiting in session storage: this hook
 * arms the entry leg, renders a twin of the box at the idle pill that
 * condenses card → ball in place, then joins the runtime at the ball.
 * Mount-only, so one pitch spends one tag call, never two.
 *
 * Nothing travels — the twin appears at the pill and reshapes where it
 * sits. A ball-shaped rect (the entry already morphed in place) skips
 * the twin entirely and joins the runtime at once.
 *
 * The morph lives in the page move — the entry navigates at once, with
 * no landing hold, and the run page replays nothing.
 *
 * Spec ref: §5.
 */

import { useSearchParams } from "next/navigation";
import { type RefObject, useEffect, useRef, useState } from "react";
import {
  clearFlight,
  type FlightRect,
  peekFlight,
} from "@/components/entry-box";
import { morphClone } from "@/components/orb/flight-animation";
import type { OrbFlightState } from "@/components/orb/types";
import type { OrbHandle } from "@/components/ui/ai-thinking-orb-and-input";

export interface OrbFlight {
  /** The clone to render, or null when there is nothing in flight. */
  flight: OrbFlightState | null;
  /** Attach to the element the orb sits in — the pill-target anchor. */
  stageRef: RefObject<HTMLDivElement | null>;
  /** Attach to the clone's inner layer; it condenses card → ball. */
  cloneInnerRef: RefObject<HTMLDivElement | null>;
  /** Attach to the clone's pitch text; melted out in flight. */
  cloneTextRef: RefObject<HTMLParagraphElement | null>;
}

export function useOrbFlight({
  orbRef,
  arm,
}: {
  orbRef: RefObject<OrbHandle | null>;
  /** Arms the entry leg before the runtime reads its work line. */
  arm: (pitch: string) => void;
}): OrbFlight {
  const params = useSearchParams();
  const [flight, setFlight] = useState<OrbFlightState | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  /** Inner clone layer: condenses card → ball in place at the pill. */
  const cloneInnerRef = useRef<HTMLDivElement>(null);
  const cloneTextRef = useRef<HTMLParagraphElement>(null);
  const flightAnim = useRef<Animation | null>(null);
  const scheduledRef = useRef(false);
  const autoStarted = useRef(false);

  /** Flight target: the runtime rests the pill ~120px down the 240px
   *  .mo-root block, and the block sits centred in the stage — so the
   *  ball the runtime joins at is the stage's centre. */
  function pillTarget(): FlightRect | null {
    const stage = stageRef.current;
    if (stage === null) return null;
    const r = stage.getBoundingClientRect();
    if (r.width <= 0) return null;
    const w = Math.max(280, Math.min(720, r.width - 32));
    const h = 200;
    return {
      left: r.left + r.width / 2 - w / 2,
      top: r.top + r.height / 2 - h / 2,
      width: w,
      height: h,
    };
  }

  // Shared-link entry: ?pitch= autostarts, mount-only. Guarded for
  // StrictMode's double effect so one pitch spends one tag call, never
  // two. Arm the entry leg before the runtime reaches its think phase:
  // the orb reads the work line once, at think start — without this the
  // first (autostarted) leg plays the generic label cycle.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only auto-start
  useEffect(() => {
    if (autoStarted.current || scheduledRef.current) return;
    const shared = (params.get("pitch") ?? "").slice(0, 2000).trim();
    if (shared === "") return;
    scheduledRef.current = true;
    arm(shared);
    const startNow = () => {
      autoStarted.current = true;
      orbRef.current?.setText(shared);
      orbRef.current?.submit(shared, "wait");
    };
    const startFromBall = () => {
      autoStarted.current = true;
      orbRef.current?.setText(shared);
      orbRef.current?.submitFromBall(shared, "wait");
    };
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rect = reduced ? null : peekFlight();
    if (rect === null) {
      startNow();
      return;
    }
    const box: FlightRect = rect;
    // Ball handoff (the entry already morphed in place): no twin, no
    // travel — join the runtime at the ball once the page crossfade
    // gets going, same beat the morph would have played on.
    if (box.shape === "ball") {
      let timer = 0;
      const raf = window.requestAnimationFrame(() => {
        timer = window.setTimeout(() => {
          clearFlight();
          startFromBall();
        }, 120);
      });
      return () => {
        window.cancelAnimationFrame(raf);
        window.clearTimeout(timer);
        scheduledRef.current = false;
      };
    }
    // Let the page crossfade get going first so the twin isn't buried
    // under the outgoing snapshot — then it appears at the pill and
    // condenses in place.
    let timer = 0;
    const raf = window.requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        startFlight();
      }, 120);
    });
    function startFlight() {
      const target = pillTarget();
      if (target === null) {
        clearFlight();
        startNow();
        return;
      }
      setFlight({ rect: box, target, pitch: shared });
      // The twin mounts on setState — its refs attach a frame later,
      // so the morph starts on the next frame.
      window.requestAnimationFrame(() => {
        const shape = cloneInnerRef.current;
        if (shape === null) {
          setFlight(null);
          clearFlight();
          startNow();
          return;
        }
        flightAnim.current = morphClone({
          shape,
          text: cloneTextRef.current,
          from: box,
          target,
          onJoin: () => {
            flightAnim.current = null;
            // The runtime fades its actor in from idle; a handoff needs
            // the ball opaque in the same frame the clone clears (see the
            // data-handoff rule in globals.css).
            stageRef.current?.setAttribute("data-handoff", "flight");
            startFromBall();
          },
          onDone: () => {
            setFlight(null);
            clearFlight();
          },
        });
      });
    }
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      flightAnim.current?.cancel();
      flightAnim.current = null;
      scheduledRef.current = false;
    };
  }, []);

  return { flight, stageRef, cloneInnerRef, cloneTextRef };
}
