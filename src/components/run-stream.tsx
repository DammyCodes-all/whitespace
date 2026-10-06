"use client";

import { useEffect, useState } from "react";
import { RunSteps } from "@/components/run-steps";
import type { RunStep } from "@/lib/types";

/**
 * Day 3 fake stream over RunSteps (§5.4).
 * Advances pending → active → done on timers, settling on the passed
 * final statuses. Renders the final state statically under
 * prefers-reduced-motion. Timers clean up on unmount.
 */
export function RunStream({ steps }: { steps: RunStep[] }) {
  // Always start streaming: the initializer must match SSR output, so
  // the reduced-motion shortcut is detected in a mount effect instead.
  const [final, setFinal] = useState(false);
  const [pointer, setPointer] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFinal(true);
    }
  }, []);

  useEffect(() => {
    if (final) return;
    if (pointer > steps.length) {
      setFinal(true);
      return;
    }
    const timer = setTimeout(() => setPointer((p) => p + 1), 800);
    return () => clearTimeout(timer);
  }, [final, pointer, steps.length]);

  if (final) {
    return <RunSteps steps={steps} />;
  }

  const live: RunStep[] = steps.map((step, i) => ({
    ...step,
    status: i < pointer ? "done" : i === pointer ? "active" : "pending",
  }));
  return <RunSteps steps={live} />;
}
