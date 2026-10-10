/**
 * Phase 3 U: v2 result view (presentational). Owned by U.
 *
 * Renders a frozen `V2Result` with no scores and no verdicts: the
 * interpretation ("we read this as X"), reference lenses ("this
 * reference represents Y"), evidence counts, explorations, and
 * limitations. Factual counts come from code-owned fields; labels
 * come from returned metadata or read as interpretation.
 *
 * Correction flow: confirming an analogy or revising the pitch starts
 * a new version via the parent — never a silent rescue of this one.
 */

"use client";

import { useState } from "react";
import type { V2Result } from "@/lib/pipeline/v2/types";
import { isLegacyV2Replay, isSafeHttpLink } from "./v2-replay";
import {
  evidenceJson,
  memberEvidenceIds,
  recordedEvidenceIds,
} from "./v2-result-utils";

const HEADLINES: Record<V2Result["reportState"], string> = {
  hypotheses: "Audiences worth investigating",
  "exploration-only": "Exploration, not hypotheses yet",
  "no-supported-hypothesis": "No supported hypothesis returned",
  "unable-to-assess": "Could not assess this pitch",
  "needs-clarification": "A quick clarification first",
  unsupported: "Outside what taste data can judge",
};

export function V2ResultView({
  result,
  restored,
  onConfirm,
  onRevise,
}: {
  result: V2Result;
  restored: boolean;
  onConfirm: (aspectIds: string[]) => void;
  onRevise: () => void;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const readOnly = isLegacyV2Replay(result);
  // Candidate audiences assume these not-yet-confirmed analogies.
  // Confirming them re-runs the same grouping as evidence.
  const provisionalDiscoveryIds = result.lenses
    .filter(
      (lens) =>
        lens.role === "discovery" &&
        lens.identity === "resolved" &&
        lens.bridge === "llm-provisional",
    )
    .map((lens) => lens.aspectId);
  const toggle = (id: string) =>
    setChecked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  return (
    <div className="mt-8 flex min-w-0 flex-col gap-6 [overflow-wrap:anywhere]">
      <section aria-label="Result" aria-live="polite">
        <p className="font-mono text-xs tracking-tight text-ink-3">
          {result.reportState} · data {result.dataState}
          {restored ? " · restored, no new run spent" : ""}
        </p>
        <h2 className="mt-2 font-serif text-2xl tracking-tight text-ink">
          {HEADLINES[result.reportState]}
        </h2>
        {result.brief !== null && (
          <p className="mt-2 max-w-prose text-body text-ink-2">
            We read this as: {result.brief.interpretation}
          </p>
        )}
      </section>

      {readOnly && (
        <p className="text-sm text-ink-3">
          Older v2 version · read-only replay. Its original findings are
          preserved; positional approvals cannot be reused. Start a fresh
          analysis to use the current pipeline.
        </p>
      )}

      {result.lenses.length > 0 && (
        <section
          aria-label="Reference lenses"
          className="border border-rule bg-surface p-5"
        >
          <h3 className="font-serif text-lg text-ink">Reference lenses</h3>
          <ul className="mt-3 space-y-3">
            {result.lenses.map((lens) => (
              <li key={lens.aspectId} className="text-sm text-ink-2">
                <p className="max-w-prose">
                  This reference represents one aspect:{" "}
                  <span className="text-ink">
                    {lens.analogy || lens.selectedName}
                  </span>
                </p>
                <p className="mt-1 font-mono text-xs text-ink-3">
                  {lens.entityName ?? lens.selectedName} · {lens.identity} ·{" "}
                  {lens.bridge === "llm-provisional"
                    ? "provisional analogy"
                    : lens.bridge}
                </p>
                <EvidenceLinks
                  result={result}
                  ids={lens.callId === undefined ? [] : [lens.callId]}
                  label="Reference lookup"
                />
                {!readOnly &&
                  lens.identity === "resolved" &&
                  lens.bridge === "llm-provisional" && (
                    <label className="mt-1 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked.includes(lens.aspectId)}
                        onChange={() => toggle(lens.aspectId)}
                      />
                      This analogy is right — use it as evidence next run
                    </label>
                  )}
                {lens.identity === "ambiguous" && (
                  <p className="mt-1 text-sm">
                    Multiple works share this name — tell us which one you
                    meant.
                  </p>
                )}
              </li>
            ))}
          </ul>
          {checked.length > 0 && (
            <button
              type="button"
              onClick={() => onConfirm(checked)}
              className="mt-4 border border-ink bg-ink px-4 py-2 text-sm text-surface"
            >
              Confirm {checked.length}{" "}
              {checked.length === 1 ? "analogy" : "analogies"} and re-run as a
              new version
            </button>
          )}
        </section>
      )}

      {(result.comparisons ?? []).length > 0 && (
        <section
          aria-label="Comparisons you named"
          className="border border-rule bg-surface p-5"
        >
          <h3 className="font-serif text-lg text-ink">
            Because you mentioned these
          </h3>
          <p className="mt-1 text-sm text-ink-3">
            Your comparisons, resolved and shown — never used as evidence for or
            against a hypothesis.
          </p>
          <ul className="mt-3 space-y-3">
            {(result.comparisons ?? []).map((c) => (
              <li key={c.query} className="text-sm text-ink-2">
                <p>
                  <span className="text-ink">{c.entityName ?? c.query}</span>{" "}
                  <span className="font-mono text-xs text-ink-3">
                    {c.identity === "resolved"
                      ? "resolved · your comparison"
                      : c.identity}
                  </span>
                </p>
                {c.entities.length > 0 && (
                  <p className="mt-1">
                    Nearby: {c.entities.map((e) => e.name).join(" · ")}
                  </p>
                )}
                <EvidenceLinks
                  result={result}
                  ids={c.evidenceIds}
                  label="Comparison queries"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.neighborhoods.length > 0 && (
        <section
          aria-label="Audience hypotheses"
          className="border border-rule bg-surface p-5"
        >
          <h3 className="font-serif text-lg text-ink">Audience hypotheses</h3>
          <ul className="mt-3 space-y-4">
            {result.neighborhoods.map((group) => {
              const explanation =
                (result.explanations ?? []).find(
                  (e) => e.neighborhoodId === group.id,
                ) ?? null;
              return (
                <li key={group.id}>
                  <p className="text-sm text-ink">
                    {explanation?.name ??
                      group.sharedDescriptor ??
                      "Reference overlap (no shared descriptor found)"}
                  </p>
                  {explanation !== null && (
                    <p className="mt-1 text-sm text-ink-2">
                      {explanation.whyInvestigate}{" "}
                      <span className="font-mono text-xs text-ink-3">
                        {explanation.source === "llm-grounded"
                          ? "interpretation of the evidence"
                          : "deterministic label"}
                      </span>
                    </p>
                  )}
                  <p className="mt-1 font-mono text-xs text-ink-3">
                    cross-aspect evidence · covers {group.coverage}{" "}
                    {group.coverage === 1 ? "aspect" : "aspects"} ·{" "}
                    {group.corroboration} corroborating{" "}
                    {group.corroboration === 1 ? "pair" : "pairs"}
                    {(group.supportingEvidence ?? []).length > 0
                      ? " · additional supporting evidence"
                      : ""}
                  </p>
                  <EvidenceLinks
                    result={result}
                    ids={group.evidenceIds}
                    label="Count and grouping queries"
                  />
                  <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-ink-2">
                    {group.members.map((m) => (
                      <li key={m.id}>
                        {m.name}
                        <EvidenceLinks
                          result={result}
                          ids={memberEvidenceIds(result, group, m.id)}
                          label="Returned connections"
                        />
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {result.candidateHypotheses !== undefined &&
        result.candidateHypotheses.length > 0 &&
        result.neighborhoods.length === 0 && (
          <section
            aria-label="Candidate audiences"
            className="border border-rule bg-surface p-5"
          >
            <h3 className="font-serif text-lg text-ink">
              Candidate audiences — worth a look
            </h3>
            <p className="mt-1 text-sm text-ink-3">
              What the overlap would support if you confirm the analogies above.
              Projected, not findings — nothing here is evidence yet.
            </p>
            <ul className="mt-3 space-y-4">
              {result.candidateHypotheses.map((group) => (
                <li key={group.id}>
                  <p className="text-sm text-ink">
                    {group.sharedDescriptor ??
                      "Reference overlap (no shared descriptor found)"}{" "}
                    <span className="font-mono text-xs text-ink-3">
                      candidate · would cover {group.coverage}{" "}
                      {group.coverage === 1 ? "aspect" : "aspects"} ·{" "}
                      {group.corroboration} corroborating{" "}
                      {group.corroboration === 1 ? "pair" : "pairs"}
                    </span>
                  </p>
                  <EvidenceLinks
                    result={result}
                    ids={group.evidenceIds}
                    label="Count and grouping queries"
                  />
                  <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-ink-2">
                    {group.members.map((m) => (
                      <li key={m.id}>
                        {m.name}
                        <EvidenceLinks
                          result={result}
                          ids={memberEvidenceIds(result, group, m.id)}
                          label="Returned connections"
                        />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            {!readOnly && provisionalDiscoveryIds.length > 0 && (
              <button
                type="button"
                onClick={() => onConfirm(provisionalDiscoveryIds)}
                className="mt-4 border border-ink bg-ink px-4 py-2 text-sm text-surface"
              >
                Confirm these analogies and re-run as a new version
              </button>
            )}
          </section>
        )}

      {result.explorations.length > 0 && (
        <section
          aria-label="Exploration"
          className="border border-rule bg-surface p-5"
        >
          <h3 className="font-serif text-lg text-ink">
            Starting points to investigate
          </h3>
          <ul className="mt-3 space-y-3">
            {result.explorations.map((exp) => (
              <li key={exp.aspectId} className="text-sm text-ink-2">
                <p>
                  Via {exp.referenceName ?? "this aspect"}:{" "}
                  {exp.entities.map((e) => e.name).join(" · ")}
                </p>
                <p className="mt-1 text-ink-3">{exp.suggestedAction}</p>
                <EvidenceLinks
                  result={result}
                  ids={exp.evidenceIds}
                  label="Exploration queries"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(result.leads ?? []).length > 0 && (
        <section
          aria-label="Investigation leads"
          className="border border-rule bg-surface p-5"
        >
          <h3 className="font-serif text-lg text-ink">Investigation leads</h3>
          <p className="mt-1 text-sm text-ink-3">
            Podcasts and people seeded by the hypotheses above — starting points
            for conversations, not validated reach.
          </p>
          <ul className="mt-3 space-y-3">
            {(result.leads ?? []).map((lead) => (
              <li
                key={`${lead.neighborhoodId}:${lead.id}`}
                className="text-sm text-ink-2"
              >
                <p>
                  <span className="text-ink">{lead.name}</span>{" "}
                  <span className="font-mono text-xs text-ink-3">
                    {lead.type}
                  </span>
                </p>
                {isSafeHttpLink(lead.link) && (
                  <p className="mt-1">
                    <a
                      href={lead.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Returned link
                    </a>
                  </p>
                )}
                <p className="mt-1 text-ink-3">{lead.investigationAction}</p>
                <EvidenceLinks
                  result={result}
                  ids={lead.callId === undefined ? [] : [lead.callId]}
                  label="Supporting lead query"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.limitations.length > 0 && (
        <section aria-label="Limitations">
          <h3 className="font-mono text-xs tracking-tight text-ink-3">
            limitations
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
            {result.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <EvidenceTrace result={result} />

      <div className="flex flex-wrap items-center gap-3">
        {!readOnly && (
          <button
            type="button"
            onClick={onRevise}
            className="border border-rule px-4 py-2 text-sm text-ink"
          >
            Revise the pitch as a new version
          </button>
        )}
        <p className="font-mono text-xs text-ink-3">
          {result.usage.httpAttempts}/{result.usage.ceiling} attempts ·{" "}
          {result.usage.llmCalls} recorded LLM{" "}
          {result.usage.llmCalls === 1 ? "call" : "calls"} ·{" "}
          {(result.usage.latencyMs ?? 0) < 1000
            ? `${result.usage.latencyMs ?? 0}ms`
            : `${((result.usage.latencyMs ?? 0) / 1000).toFixed(1)}s`}
        </p>
      </div>
    </div>
  );
}

function EvidenceLinks({
  result,
  ids = [],
  label,
}: {
  result: V2Result;
  ids?: string[];
  label: string;
}) {
  const recorded = recordedEvidenceIds(result, ids);
  return (
    <p className="mt-1 text-xs text-ink-3">
      {label}:{" "}
      {recorded.length === 0
        ? "query traces unavailable"
        : recorded.map((id) => {
            const index = (result.calls ?? []).findIndex(
              (call) => call.id === id,
            );
            const anchor = `v2-trace-${index}`;
            return (
              <a
                key={id}
                href={`#${anchor}`}
                className="mr-2 inline-block underline"
                aria-label={`Open ${label.toLowerCase()}: ${id}`}
                onClick={() => {
                  const row = document.getElementById(anchor);
                  if (row instanceof HTMLDetailsElement) {
                    row.open = true;
                    row.querySelector("summary")?.focus();
                  }
                }}
              >
                {id}
              </a>
            );
          })}
      {recorded.length > 0 && recorded.length < new Set(ids).size
        ? " · some query traces unavailable"
        : ""}
    </p>
  );
}

/** Every recorded stage can be inspected, including failed/empty retrievals. */
function EvidenceTrace({ result }: { result: V2Result }) {
  return (
    <section aria-label="Qloo evidence trace">
      <h3 className="font-serif text-lg text-ink">Qloo evidence trace</h3>
      <p className="mt-1 text-sm text-ink-3">
        What was asked and what came back. These are returned taste connections,
        not proof of demand. Authentication is not shown.
      </p>
      {(result.calls ?? []).length === 0 ? (
        <p className="mt-2 text-sm text-ink-3">
          Query traces unavailable for this version.
        </p>
      ) : (
        <ol className="mt-3 divide-y divide-rule">
          {(result.calls ?? []).map((call, index) => (
            <li key={call.id}>
              <details id={`v2-trace-${index}`} className="py-3">
                <summary className="cursor-pointer text-sm text-ink">
                  <span className="font-mono">
                    {call.id} · {call.method} {call.endpoint}
                  </span>{" "}
                  · status{" "}
                  {call.status === 0 ? "no HTTP response" : call.status} ·{" "}
                  {call.attempts} {call.attempts === 1 ? "attempt" : "attempts"}
                  {call.fromCache ? " · cached" : ""}
                </summary>
                <div className="mt-2 space-y-2 text-sm text-ink-2">
                  <p className="font-mono text-xs">
                    Duration: {call.durationMs}ms
                  </p>
                  <p>Query parameters</p>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap border border-rule bg-surface p-3 font-mono text-xs">
                    {evidenceJson(call.params)}
                  </pre>
                  {call.error !== undefined && (
                    <p>Failure: {evidenceJson(call.error)}</p>
                  )}
                  <p>
                    {call.response === null
                      ? "No response body captured."
                      : "Returned response"}
                    {call.responseTruncated
                      ? " · truncated in this saved trace"
                      : ""}
                  </p>
                  {call.response !== null && (
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap border border-rule bg-surface p-3 font-mono text-xs">
                      {evidenceJson(call.response)}
                    </pre>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ol>
      )}
      {(result.retrievals ?? []).length > 0 && (
        <details className="mt-3 text-sm text-ink-2">
          <summary className="cursor-pointer">
            Discovery and supporting retrieval outcomes
          </summary>
          <ul className="mt-2 space-y-2">
            {(result.retrievals ?? []).map((retrieval, index) => (
              <li key={`${retrieval.aspectId}:${retrieval.category}:${index}`}>
                {retrieval.aspectId} · {retrieval.category} · {retrieval.status}{" "}
                · {retrieval.entities.length} returned
                <EvidenceLinks
                  result={result}
                  ids={retrieval.callId === undefined ? [] : [retrieval.callId]}
                  label="Retrieval query"
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
