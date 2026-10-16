"use client";

import type { FlowEvidence } from "@/lib/flow/contract";

/**
 * Evidence drawer block. Small enough to stay its own module.
 * Spec: §6.12 (structure unchanged).
 */
export function FlowEvidenceBlock({
  steps,
  evidence,
  totalCalls,
}: {
  steps: { id: string; label: string; detail?: string }[];
  evidence: Record<string, FlowEvidence>;
  totalCalls: number;
}) {
  return (
    <div className="mt-10">
      <details>
        <summary className="cursor-pointer text-base tracking-tight text-ink">
          Evidence · {totalCalls} calls
        </summary>
        {steps.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer font-mono text-xs text-ink-3">
              Run steps · {steps.length}
            </summary>
            <ol className="mt-1 space-y-1">
              {steps.map((step) => (
                <li
                  key={step.id}
                  className="text-sm leading-relaxed text-ink-2"
                >
                  {step.label} — {step.detail ?? "done"}
                </li>
              ))}
            </ol>
          </details>
        )}
        <ul className="mt-2 divide-y divide-rule">
          {Object.entries(evidence).map(([id, line]) => (
            <li key={id} id={id} className="py-3">
              <details>
                <summary className="cursor-pointer font-mono text-xs text-ink-2">
                  {line.request.endpoint} · status {line.status}
                  {line.fromCache ? " · saved" : ""}
                  {line.truncated ? " · truncated" : ""}
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all bg-paper p-3 font-mono text-xs text-ink-2">
                  {JSON.stringify(line.request.params)}
                  {"\n"}
                  {line.response}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
