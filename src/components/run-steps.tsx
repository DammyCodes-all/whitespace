"use client";

/**
 * Day 3 U: run-steps view on a fake stream. Owned by U.
 *
 * `RunSteps` stays the pure presentational list (saved runs render it
 * directly). `RunStepsPlayer` plays the same shapes forward on fixtures:
 * one active step at a time, each tick marks it done and activates the
 * next. No Qloo calls, no AI, no new shapes: the Day 6 seam swaps the
 * data source, not these views.
 *
 * Spec ref: §5.4 (watch the agent work), §6.12 (each step links its Qloo
 * call), design-direction (protocol executing, mono counts, no shimmer;
 * numbers use tabular-nums via data-numeric).
 */

import { useEffect, useState } from "react";
import type { RunStep } from "@/lib/types";
export function RunSteps({ steps }: { steps: RunStep[] }) {
  return (
    <ol
      className="border-t border-rule"
      aria-label="Run progress"
      aria-live="off"
    >
      {steps.map((step, index) => (
        <li
          key={step.id}
          className="flex items-baseline gap-4 border-b border-rule py-4"
        >
          <span
            data-numeric
            className="w-8 shrink-0 font-mono text-xs text-ink-3"
            aria-hidden="true"
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] tracking-tight text-ink">
              {step.label}
              {step.status === "active" && (
                <span className="ml-2 font-mono text-xs text-measured">
                  running
                </span>
              )}
            </p>
            {step.detail ? (
              <p data-numeric className="mt-1 font-mono text-xs text-ink-3">
                {step.detail}
              </p>
            ) : null}
          </div>
          {step.callId ? (
            <a
              href={`#${step.callId}`}
              className="cite shrink-0"
              aria-label={`Evidence for ${step.label}`}
            >
              [{index + 1}]
            </a>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** First step active, the rest pending: the stream always starts here. */
function resetForStream(steps: RunStep[]): RunStep[] {
  return steps.map((step, index) => ({
    ...step,
    status: index === 0 ? "active" : "pending",
  }));
}

/**
 * Fake-stream player for fixtures and demos. Advances one step per
 * `intervalMs` until every step is done, then calls `onDone` once.
 * Statuses are the only thing that moves; labels, details and evidence
 * links come straight from the input steps.
 */
export function RunStepsPlayer({
  steps,
  intervalMs = 900,
  onDone,
}: {
  steps: RunStep[];
  intervalMs?: number;
  onDone?: () => void;
}) {
  const [current, setCurrent] = useState<RunStep[]>(() =>
    resetForStream(steps),
  );
  const [finished, setFinished] = useState(steps.length === 0);

  useEffect(() => {
    setCurrent(resetForStream(steps));
    setFinished(steps.length === 0);
  }, [steps]);

  useEffect(() => {
    if (finished) return;
    const activeIndex = current.findIndex((s) => s.status === "active");
    if (activeIndex === -1) {
      setFinished(true);
      onDone?.();
      return;
    }
    const timer = setTimeout(
      () => {
        setCurrent((prev) =>
          prev.map((step, index) =>
            index === activeIndex
              ? { ...step, status: "done" }
              : index === activeIndex + 1
                ? { ...step, status: "active" }
                : step,
          ),
        );
      },
      Math.max(0, intervalMs),
    );
    return () => clearTimeout(timer);
  }, [current, finished, intervalMs, onDone]);

  return (
    <div aria-live="polite">
      <RunSteps steps={current} />
    </div>
  );
}
