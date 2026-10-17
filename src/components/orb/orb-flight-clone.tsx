"use client";

import type { RefObject } from "react";
import { createPortal } from "react-dom";
import type { OrbFlightState } from "@/components/orb/types";

/**
 * The landing box's twin during the handoff: a 0×0 fixed anchor centred
 * on the ball spot, with the shape layer absolutely centred on it — the
 * twin condenses card → ball in place by animating its own geometry
 * (see `morphClone`), nothing travels. Portaled to <body>: a fixed child
 * of a transformed ancestor (the .page-enter rise) would ride along with
 * it. The opening frame sizes inline from the landing rect, so the first
 * paint is exactly the box it came from even before the animation arms.
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
  const cx = flight.target.left + flight.target.width / 2;
  const cy = flight.target.top + flight.target.height / 2;
  return createPortal(
    <div
      aria-hidden="true"
      className="flight-clone"
      style={{ left: cx, top: cy }}
    >
      <div
        ref={cloneInnerRef}
        className="flight-inner"
        style={{ width: flight.rect.width, height: flight.rect.height }}
      >
        <p ref={cloneTextRef} className="flight-text">
          {flight.pitch}
        </p>
      </div>
    </div>,
    document.body,
  );
}
