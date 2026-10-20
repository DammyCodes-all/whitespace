"use client";

import type { FlowStepRow } from "@/components/flow/flow-types";
import LoadingState from "@/components/ui/loading-state";

/**
 * Running phase: streamed steps as an ordered list.
 * Heading contract: h1#flow-run-heading labels section.
 * Spec: §5 (copy unchanged).
 */
export function FlowRunningStep({ steps }: { steps: FlowStepRow[] }) {
  return (
    <section aria-labelledby="flow-run-heading">
      <h1 id="flow-run-heading" className="sr-only" tabIndex={-1}>
        Running the analysis
      </h1>
      <output aria-live="polite" className="block py-2">
        <LoadingState label="Running pitch" variant="Dots" />
      </output>
      <ol
        aria-label="Run progress"
        aria-live="polite"
        className="mt-4 space-y-2"
      >
        {steps.length === 0 && (
          <li className="font-mono text-sm text-ink-3">starting the run…</li>
        )}
        {steps.map((step) => (
          <li key={step.id} className="flex items-baseline gap-3">
            <span className="font-mono text-xs text-ink-3">{step.id}</span>
            <span className="text-[15px] text-ink">{step.label}</span>
            {step.detail !== undefined && (
              <span className="font-mono text-xs text-ink-2">
                {step.detail}
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
