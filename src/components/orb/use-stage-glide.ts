"use client";

/**
 * The stage glide: the orb owns the page centre on working legs and
 * moves up only when input UI appears below it. FLIP — by the time
 * this runs the layout is already final, so it only slides the visual
 * from the old centre to the new one: a lively ease-out with a touch
 * of overshoot, so the orb settles rather than slides flat.
 * Skipped under reduced motion: the orb just snaps to its slot.
 *
 * Sequencing: the returned flag stays false until the glide finishes,
 * so the host holds the leg UI back until the orb has settled; when
 * the UI goes away it unmounts at once and the orb glides back down.
 *
 * Spec ref: §5.
 */

import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Layout effect on the client, passive on the server (no SSR warning). */
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** The glide's length — the UI hold matches it exactly. */
const GLIDE_MS = 500;

/** Docking up reads over a longer travel with UI arriving after, so it
 *  gets its own slower length — otherwise the return to work is over
 *  before the eye catches it. */
const DOCK_MS = 800;

/** Beat the orb rests at centre between legs, so return-then-dock
 *  reads as two moves with a rest, not one abrupt out-and-back. */
export const RETURN_HOLD_MS = 450;

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** How long the host holds a beat the glide covers: the full glide,
 *  or nothing under reduced motion (the orb snaps, so there is nothing
 *  to wait for). Single source of truth for both the hook and host. */
export function glideWaitMs(): number {
  if (reducedMotion()) return 0;
  return GLIDE_MS;
}

/** How long docking up takes — the UI hold matches it. */
function dockWaitMs(): number {
  if (reducedMotion()) return 0;
  return DOCK_MS;
}

/** Full between-legs wait: glide back to centre, rest, then settle —
 *  nothing under reduced motion. */
export function returnWaitMs(): number {
  if (reducedMotion()) return 0;
  return GLIDE_MS + RETURN_HOLD_MS;
}

export function useStageGlide(
  stageRef: RefObject<HTMLDivElement | null>,
  centered: boolean,
): boolean {
  const [uiReady, setUiReady] = useState(false);
  const prevCentered = useRef(centered);
  const lastCenterY = useRef<number | null>(null);

  useIsoLayoutEffect(() => {
    const stage = stageRef.current;
    const was = prevCentered.current;
    prevCentered.current = centered;
    if (stage === null) {
      lastCenterY.current = null;
      return;
    }
    const rect = stage.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    if (!reducedMotion() && was !== centered && lastCenterY.current !== null) {
      const dy = lastCenterY.current - y;
      if (Math.abs(dy) > 4) {
        stage.animate(
          [
            { transform: `translateY(${dy}px)` },
            { transform: "translateY(0px)" },
          ],
          // Plain ease-out, no overshoot: the return-then-dock beat
          // already gives the move its shape, so the glide itself
          // stays smooth. Docking up takes the slower length.
          {
            duration: centered ? GLIDE_MS : DOCK_MS,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        );
      }
    }
    lastCenterY.current = y;
  });

  useEffect(() => {
    if (centered) {
      setUiReady(false);
      return;
    }
    // The UI hold matches the docking glide, which runs slower.
    const t = window.setTimeout(() => setUiReady(true), dockWaitMs());
    return () => window.clearTimeout(t);
  }, [centered]);

  return uiReady;
}
