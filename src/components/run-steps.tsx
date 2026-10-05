import type { RunStep } from "@/lib/types";

/**
 * §5.4 run-steps view. A protocol executing, not a genie thinking:
 * steps get mono counts, never sparkle or shimmer.
 * Server Component. Numbers use tabular-nums via data-numeric.
 */
export function RunSteps({ steps }: { steps: RunStep[] }) {
  return (
    <ol className="border-t border-rule" aria-label="Run progress">
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
