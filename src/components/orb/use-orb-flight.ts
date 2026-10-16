"use client";

/**
 * The handoff's orchestration. When the landing entry navigates to
 * /run?pitch=, the box's rect is waiting in session storage: this hook
 * arms the entry leg, flies a twin clone from that rect to the idle
 * pill (reshaping card → ball on the way), then joins the runtime at
 * the ball. Mount-only, so one pitch spends one tag call, never two.
 *
 * The morph lives inside the move — the entry navigates at once, with
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
import { flyClone } from "@/components/orb/flight-animation";
import type { OrbFlightState } from "@/components/orb/types";
import type { OrbHandle } from "@/components/ui/ai-thinking-orb-and-input";

export interface OrbFlight {
  /** The clone to render, or null when there is nothing in flight. */
  flight: OrbFlightState | null;
  /** Attach to the element the orb sits in — the pill-target anchor. */
  stageRef: RefObject<HTMLDivElement | null>;
  /** Attach to the clone root (portaled to <body>); it translates only. */
  cloneRef: RefObject<HTMLDivElement | null>;
  /** Attach to the clone's inner layer; it scales + reshapes card → ball. */
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
  const cloneRef = useRef<HTMLDivElement>(null);
  /** Inner clone layer: the one that scales (outer only translates). */
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
    setFlight({ rect, pitch: shared });
    const box: FlightRect = rect;
    // Let the page crossfade get going first so the flight isn't
    // buried under the outgoing snapshot — then fly + morph live.
    let timer = 0;
    const raf = window.requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        startFlight();
      }, 120);
    });
    function startFlight() {
      const target = pillTarget();
      const clone = cloneRef.current;
      if (target === null || clone === null) {
        setFlight(null);
        clearFlight();
        startNow();
        return;
      }
      flightAnim.current = flyClone({
        clone,
        shape: cloneInnerRef.current,
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
    }
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      flightAnim.current?.cancel();
      flightAnim.current = null;
      scheduledRef.current = false;
    };
  }, []);

  return { flight, stageRef, cloneRef, cloneInnerRef, cloneTextRef };
}
