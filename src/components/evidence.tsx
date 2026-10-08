/**
 * Day 5 U: evidence drawer building blocks. Owned by U.
 *
 * Lifted from the Day 1 `/run` skeleton into its planned component.
 * Claim-first: the rows every `[e]` citation points at (§6.12) render
 * up front under their claim text, and the remaining trace sits
 * collapsed under "All calls" so long runs stop dominating the page.
 * Anchor ids stay the call ids, so existing links keep working.
 * The interactive drawer (open a call, see what was asked and what came
 * back) lands on these rows; the list itself stays a Server Component.
 *
 * Spec ref: §6.10 (evidence lines), §6.12 (evidence trace), §10 #8
 * (every claim opens its call).
 */

import type { QlooCall } from "@/lib/types";

/**
 * One visible claim backed by a Qloo call. Structurally matches
 * `CaseEvidenceLine`; kept local so this component never imports the
 * case builder.
 */
export interface EvidenceLine {
  text: string;
  callId?: string;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max).trim()}…` : value;
}

/**
 * Short human label for a call no claim cites: the query it asked
 * about instead of a bare method + endpoint.
 */
function describeCall(call: QlooCall): string {
  const query = call.params.query ?? Object.values(call.params)[0];
  if (typeof query === "string" && query !== "") {
    return `${call.method} ${call.endpoint} “${truncate(query, 48)}”`;
  }
  return `${call.method} ${call.endpoint}`;
}

function statusLabel(call: QlooCall): string {
  if (call.status === 200) return "ok";
  if (call.status === 0 && call.fromCache) return "mock";
  return "not ok";
}

function CallRow({
  call,
  label,
  tone = "key",
}: {
  call: QlooCall;
  label?: string;
  tone?: "key" | "trace";
}) {
  if (tone === "trace") {
    return (
      <details id={call.id} className="group py-1.5 text-xs text-ink-3">
        <summary className="cursor-pointer list-none hover:text-ink">
          <span data-numeric>
            {describeCall(call)} · {call.status} · {call.durationMs}ms
            {call.fromCache ? " · saved" : ""}
          </span>
        </summary>
        <div className="grid grid-rows-[0fr] group-open:grid-rows-[1fr] starting:grid-rows-[0fr] motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-out">
          <div className="overflow-hidden">
            <div className="mt-1 pl-3 font-mono">
              <p className="break-all">
                Asked:{" "}
                {Object.entries(call.params)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(" ") || "none"}
              </p>
              <p className="mt-1 break-all">
                Got: {call.responseSummary ?? "not captured"}
              </p>
            </div>
          </div>
        </div>
      </details>
    );
  }
  return (
    <details id={call.id} className="group py-3">
      <summary className="cursor-pointer list-none">
        <span className="flex items-baseline gap-2 text-[15px] leading-relaxed text-ink">
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            className="h-3 w-3 shrink-0 self-center text-ink-3 transition-transform group-open:rotate-90"
          >
            <path
              d="M4 2l4 4-4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          {label ?? describeCall(call)}
        </span>
      </summary>
      <div className="grid grid-rows-[0fr] group-open:grid-rows-[1fr] starting:grid-rows-[0fr] motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-out">
        <div className="overflow-hidden">
          <div className="mt-1.5 pl-5 font-mono text-xs text-ink-3">
            <p data-numeric>
              {call.method} {call.endpoint} · {call.status} · {call.durationMs}
              ms
              {call.fromCache ? " · saved" : ""}
            </p>
            <p className="mt-1 break-all">
              Asked:{" "}
              {Object.entries(call.params)
                .map(([k, v]) => `${k}=${v}`)
                .join(" ") || "none"}
            </p>
            <p className="mt-1 break-all">
              Got: {call.responseSummary ?? "not captured"} ({statusLabel(call)}
              )
            </p>
          </div>
        </div>
      </div>
    </details>
  );
}

/**
 * The Qloo calls behind a run: endpoint, status, duration and params.
 * Never renders the API key — traces carry paths only (§6.12).
 *
 * Pass `evidence` (claim text + call id) and the cited calls render
 * first; the rest collapse under "All calls". Without `evidence`, or
 * when none of its ids match, the full list renders open as before —
 * so an Inconclusive run never strands the user with zero trace.
 */
export function EvidenceCalls({
  calls,
  evidence,
}: {
  calls: QlooCall[];
  evidence?: EvidenceLine[];
}) {
  const byId = new Map(calls.map((call) => [call.id, call]));
  const linkedIds: string[] = [];
  const labelById = new Map<string, string>();
  for (const line of evidence ?? []) {
    if (
      line.callId === undefined ||
      !byId.has(line.callId) ||
      labelById.has(line.callId)
    ) {
      continue;
    }
    labelById.set(line.callId, line.text);
    linkedIds.push(line.callId);
  }
  const linked = new Set(linkedIds);
  const rest = calls.filter((call) => !linked.has(call.id));

  if (linkedIds.length === 0) {
    return (
      <section aria-label="Evidence calls" className="mt-12">
        <h2 className="text-lg tracking-tight text-ink">Evidence calls</h2>
        <div className="mt-2">
          {calls.map((call) => (
            <CallRow key={call.id} call={call} tone="trace" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Evidence calls" className="mt-12">
      <h2 className="text-lg tracking-tight text-ink">Evidence calls</h2>
      <div className="mt-2 divide-y divide-rule">
        {linkedIds.flatMap((id) => {
          const call = byId.get(id);
          return call === undefined ? (
            []
          ) : (
            <CallRow key={id} call={call} label={labelById.get(id)} />
          );
        })}
      </div>
      {rest.length > 0 ? (
        <details className="group/all mt-3">
          <summary className="cursor-pointer list-none text-sm text-ink-3 underline decoration-dotted underline-offset-4 hover:text-ink">
            <span className="group-open/all:hidden">
              Show all {calls.length} calls
            </span>
            <span className="hidden group-open/all:inline">
              Hide full trace
            </span>
          </summary>
          <div className="grid grid-rows-[0fr] group-open/all:grid-rows-[1fr] starting:grid-rows-[0fr] motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-out">
            <div className="overflow-hidden">
              <div className="mt-2 max-h-80 overflow-y-auto">
                {rest.map((call) => (
                  <CallRow key={call.id} call={call} tone="trace" />
                ))}
              </div>
            </div>
          </div>
        </details>
      ) : null}
    </section>
  );
}
