/**
 * Day 5 U: evidence drawer building blocks. Owned by U.
 *
 * Lifted from the Day 1 `/run` skeleton into its planned component.
 * `EvidenceCalls` renders the trace list every `[e]` citation points at
 * (§6.12); anchor ids are the call ids, so existing links keep working.
 * The interactive drawer (open a call, see what was asked and what came
 * back) lands on this list; the list itself stays a Server Component.
 *
 * Spec ref: §6.12 (evidence trace), §10 #8 (every claim opens its call).
 */

import type { QlooCall } from "@/lib/types";

/**
 * The Qloo calls behind a run: endpoint, status, duration and params.
 * Never renders the API key — traces carry paths only (§6.12).
 */
export function EvidenceCalls({ calls }: { calls: QlooCall[] }) {
  return (
    <section aria-label="Evidence calls" className="mt-12">
      <h2 className="text-lg tracking-tight text-ink">Evidence calls</h2>
      <div className="mt-4 border-t border-rule">
        {calls.map((call) => (
          <div
            key={call.id}
            id={call.id}
            className="border-b border-rule py-3 font-mono text-xs text-ink-2"
          >
            <p data-numeric>
              {call.method} {call.endpoint} · {call.status} · {call.durationMs}
              ms
              {call.fromCache ? " · saved" : ""}
            </p>
            <p className="mt-1 break-all text-ink-3">
              {Object.entries(call.params)
                .map(([k, v]) => `${k}=${v}`)
                .join(" ")}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
