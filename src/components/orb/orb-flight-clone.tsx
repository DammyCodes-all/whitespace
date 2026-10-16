"use client";

import type { RefObject } from "react";
import { createPortal } from "react-dom";
import type { OrbFlightState } from "@/components/orb/types";

/**
 * The landing box's twin during the handoff: it renders at the idle
 * pill and condenses card → ball in place (see `morphClone`) — nothing
 * travels. Portaled to <body>: a fixed child of a transformed ancestor
 * (the .page-enter rise) would ride along with it.
 */
export function OrbFlightClone({
  flight,
  cloneInnerRef,
  cloneTextRef,
}: {
  flight: OrbFlightState;
  cloneInnerRef: RefObject<HTMLDivElement | null>;
  cloneTextRef: RefObject<HTMLParagraphElement | null>;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      aria-hidden="true"
      className="flight-clone"
      style={{
        left: flight.target.left,
        top: flight.target.top,
        width: flight.target.width,
        height: flight.target.height,
      }}
    >
      <div ref={cloneInnerRef} className="flight-inner">
        <p ref={cloneTextRef} className="flight-text">
          {flight.pitch}
        </p>
      </div>
    </div>,
    document.body,
  );
}
