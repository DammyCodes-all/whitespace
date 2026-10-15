"use client";

import type { RefObject } from "react";
import type { OrbFlightState } from "@/components/orb/types";

/**
 * The landing box's twin during the handoff: it starts where the box
 * was and is animated to the pill by `useOrbFlight`. A ball-shaped
 * handoff has no text — the entry already melted it.
 */
export function OrbFlightClone({
  flight,
  cloneRef,
  cloneTextRef,
}: {
  flight: OrbFlightState;
  cloneRef: RefObject<HTMLDivElement | null>;
  cloneTextRef: RefObject<HTMLParagraphElement | null>;
}) {
  const ball = flight.rect.shape === "ball";
  return (
    <div
      ref={cloneRef}
      aria-hidden="true"
      className={ball ? "flight-clone flight-ball" : "flight-clone"}
      style={{
        left: flight.rect.left,
        top: flight.rect.top,
        width: flight.rect.width,
        height: flight.rect.height,
      }}
    >
      {ball ? null : (
        <p ref={cloneTextRef} className="flight-text">
          {flight.pitch}
        </p>
      )}
    </div>
  );
}
