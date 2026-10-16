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
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced && was !== centered && lastCenterY.current !== null) {
      const dy = lastCenterY.current - y;
      if (Math.abs(dy) > 4) {
        stage.animate(
          [
            { transform: `translateY(${dy}px)` },
            { transform: "translateY(0px)" },
          ],
          { duration: GLIDE_MS, easing: "cubic-bezier(0.34, 1.3, 0.64, 1)" },
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
    const t = window.setTimeout(() => setUiReady(true), GLIDE_MS);
    return () => window.clearTimeout(t);
  }, [centered]);

  return uiReady;
}
