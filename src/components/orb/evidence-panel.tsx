"use client";

/**
 * The run's receipt shelf: every Qloo call behind the result, the run's
 * own step ledger, and the sidecar calls (compare, change). Collapsed
 * by default — the verdict above never waits on it.
 *
 * Spec ref: §6.12 (every claim opens its call).
 */

import type { FlowEvidence, FlowResult } from "@/lib/flow/contract";
import type { FlowStepRow } from "@/lib/flow/view-types";
import type { QlooCall } from "@/lib/types";

function callToEvidence(call: QlooCall): FlowEvidence {
  return {
    request: { endpoint: call.endpoint, params: { ...call.params } },
    response: call.responseBody ?? call.responseSummary ?? "not captured",
    truncated: call.responseTruncated ?? call.responseBody === undefined,
    status: call.status,
    fromCache: call.fromCache,
  };
}

export function EvidencePanel({
  result,
  steps,
  compareCalls,
}: {
  result: FlowResult;
  steps: FlowStepRow[];
  /** Sidecar calls, folded in so the count never undersells the run. */
  compareCalls: QlooCall[];
}) {
  const total = result.qlooCalls.total + compareCalls.length;

  return (
    <div className="mt-10">
      <details>
        <summary className="cursor-pointer text-base tracking-tight text-ink">
          Evidence · {total} calls
        </summary>
        {steps.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer font-mono text-xs text-ink-3">
              Run steps · {steps.length}
            </summary>
            <ul className="mt-1 space-y-1">
              {steps.map((step) => (
                <li
                  key={step.id}
                  className="text-sm leading-relaxed text-ink-2"
                >
                  {step.label} — {step.detail ?? "done"}
                </li>
              ))}
            </ul>
          </details>
        )}
        <ul className="mt-2 divide-y divide-rule">
          {Object.entries({
            ...result.evidence,
            ...Object.fromEntries(
              compareCalls.map((call) => [call.id, callToEvidence(call)]),
            ),
          }).map(([id, line]) => (
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
