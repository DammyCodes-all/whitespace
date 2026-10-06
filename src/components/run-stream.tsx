"use client";

import { useEffect, useState } from "react";
import { RunSteps } from "@/components/run-steps";
import type { RunStep } from "@/lib/types";

/**
 * Day 3 fake stream over RunSteps (§5.4).
 * Advances pending → active → done on timers, stopping at the first
 * step that isn't done in the input so the settling frame matches the
 * passed statuses exactly (no snap-back). Renders the final state
 * statically under prefers-reduced-motion. Timers clean up on unmount.
 */
export function RunStream({ steps }: { steps: RunStep[] }) {
  // Always start streaming: the initializer must match SSR output, so
  // the reduced-motion shortcut is detected in a mount effect instead.
  const [final, setFinal] = useState(false);
  const [pointer, setPointer] = useState(0);

  const firstOpen = steps.findIndex((step) => step.status !== "done");
  const end = firstOpen === -1 ? steps.length : firstOpen;

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset when a new steps array arrives.
  useEffect(() => {
    setPointer(0);
    setFinal(false);
  }, [steps]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFinal(true);
    }
  }, []);

  useEffect(() => {
    if (final) return;
    if (pointer > end) {
      setFinal(true);
      return;
    }
    const timer = setTimeout(() => setPointer((p) => p + 1), 800);
    return () => clearTimeout(timer);
  }, [final, pointer, end]);

  if (final) {
    return <RunSteps steps={steps} />;
  }

  const live: RunStep[] = steps.map((step, i) => ({
    ...step,
    status: i < pointer ? "done" : i === pointer ? "active" : "pending",
  }));
  return <RunSteps steps={live} />;
}
