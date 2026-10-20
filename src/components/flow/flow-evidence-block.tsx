import { evidenceCache, evidenceStatus } from "@/components/evidence-label";
import type { FlowEvidence } from "@/lib/flow/contract";

/**
 * Evidence drawer block. Small enough to stay its own module, and
 * deliberately free of hooks so the static recorded-run page can render
 * it on the server instead of shipping every response to the client.
 * Spec: §6.12 (structure unchanged; mock rows never read as cache hits).
 */
export function FlowEvidenceBlock({
  steps,
  evidence,
  totalCalls,
  note,
}: {
  steps: { id: string; label: string; detail?: string }[];
  evidence: Record<string, FlowEvidence>;
  totalCalls: number;
  /** Optional provenance note, e.g. "responses trimmed for the sample". */
  note?: string;
}) {
  const rows = Object.values(evidence);
  const mockOnly = rows.length > 0 && rows.every((line) => line.mock === true);
  return (
    <div className="mt-10">
      <details>
        <summary className="cursor-pointer text-base tracking-tight text-ink">
          {mockOnly
            ? `Evidence · ${rows.length} mock traces, no Qloo key`
            : `Evidence · ${totalCalls} calls`}
        </summary>
        {note !== undefined && (
          <p className="mt-2 max-w-prose text-sm text-ink-3">{note}</p>
        )}
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
                  {line.request.endpoint} · {evidenceStatus(line)}
                  {evidenceCache(line)}
                  {line.truncated ? " · truncated" : ""}
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-all bg-paper p-3 font-mono text-xs text-ink-2">
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
