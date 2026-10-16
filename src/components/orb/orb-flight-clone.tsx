"use client";

import type { RefObject } from "react";
import { createPortal } from "react-dom";
import type { OrbFlightState } from "@/components/orb/types";

/**
 * The landing box's twin during the handoff: it starts where the box
 * was and is animated to the pill by `useOrbFlight`. Portaled to
 * <body> — a fixed child of a transformed ancestor (the .page-enter
 * rise) would ride along with it. The outer layer only translates; the
 * inner scales + reshapes card → ball, so no flight frame re-lays-out.
 * A ball-shaped handoff has no text — the entry already melted it.
 */
export function OrbFlightClone({
  flight,
  cloneRef,
  cloneInnerRef,
  cloneTextRef,
}: {
  flight: OrbFlightState;
  cloneRef: RefObject<HTMLDivElement | null>;
  cloneInnerRef: RefObject<HTMLDivElement | null>;
  cloneTextRef: RefObject<HTMLParagraphElement | null>;
}) {
  if (typeof document === "undefined") return null;
  const ball = flight.rect.shape === "ball";
  return createPortal(
    <div
      ref={cloneRef}
      aria-hidden="true"
      className="flight-clone"
      style={{
        left: flight.rect.left,
        top: flight.rect.top,
        width: flight.rect.width,
        height: flight.rect.height,
      }}
    >
      <div
        ref={cloneInnerRef}
        className={ball ? "flight-inner flight-ball" : "flight-inner"}
      >
        {ball ? null : (
          <p ref={cloneTextRef} className="flight-text">
            {flight.pitch}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
