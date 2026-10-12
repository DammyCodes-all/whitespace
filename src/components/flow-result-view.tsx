/**
 * Package C step 8: the results view, built on the adapter only.
 * Server Component: no `FlowResult` field is re-derived here, and no
 * placeholder 0 can reach a bar because the adapter already nulled
 * unjudgeable scores.
 *
 * design-direction.md §2 (bars + solid ink control line), §3 (verdict
 * always carries its word), §6 (no number without evidence).
 */

import type { FlowBarRow, FlowResult } from "@/lib/flow/contract";
import { barRows, isCloseCall } from "@/lib/flow/contract";

const VERDICT_WORDS: Record<FlowResult["verdict"], string> = {
  strong: "Strong fit",
  split: "Split fit",
  weak: "Weak fit",
  inconclusive: "Inconclusive",
};

const VERDICT_FILLS: Record<FlowResult["verdict"], string> = {
  strong: "bg-strong",
  split: "bg-split",
  weak: "bg-weak",
  inconclusive: "bg-paper",
};

function Cite({ evidenceId }: { evidenceId: string | null }) {
  if (evidenceId === null) return null;
  return (
    <a
      href={`#${evidenceId}`}
      className="cite ml-1"
      aria-label="Open the Qloo call behind this claim"
    >
      [e]
    </a>
  );
}

function VerdictHeadline({ result }: { result: FlowResult }) {
  return (
    <div className={`card px-6 py-5 ${VERDICT_FILLS[result.verdict]}`}>
      <p className="font-mono text-xs tracking-tight text-ink-2">
        {VERDICT_WORDS[result.verdict]}
      </p>
      <h2 className="mt-1 font-serif text-2xl tracking-tight text-ink">
        {result.surprise
          ? "Your best fit is not the audience you named."
          : verdictSentence(result)}
      </h2>
      {isCloseCall(result) && (
        <p className="mt-2 max-w-prose text-body text-ink-2">
          Close call — this sits near the control line, so a re-run may read
          differently. Tighten the words and run again.
        </p>
      )}
      <p data-numeric className="tnum mt-2 font-mono text-sm text-ink-2">
        {result.ceiling === null
          ? "control ceiling: not measured"
          : `control ceiling: ${result.ceiling.toFixed(2)}`}
        <span className="ml-2">
          Qloo calls: {result.qlooCalls.network} network,{" "}
          {result.qlooCalls.cached} cached
        </span>
      </p>
    </div>
  );
}

function verdictSentence(result: FlowResult): string {
  const rows = barRows(result);
  const top = rows[0];
  if (result.verdict === "inconclusive") {
    return "Too little matched data to judge this pitch.";
  }
  if (result.verdict === "weak") {
    return "Nothing beat the control ceiling, so no reach plan is shown.";
  }
  if (top === undefined) return "No audience cleared the control ceiling.";
  return `Best fit: ${top.name}.`;
}

function Bars({ result }: { result: FlowResult }) {
  const rows: FlowBarRow[] = barRows(result);
  const ceiling = result.ceiling;
  const top = Math.max(
    0.0001,
    ceiling ?? 0,
    ...rows.map((r) => r.score),
    ...result.audiences
      .filter((a) => a.role === "control" && a.score !== null)
      .map((a) => a.score as number),
  );
  return (
    <section aria-label="Ranked audiences" className="mt-8">
      <h3 className="text-base tracking-tight text-ink">
        Fit against the control ceiling
      </h3>
      <div className="mt-4">
        {rows.length === 0 ? (
          <p className="nodata px-3 py-2 font-mono text-xs text-ink-2">
            not measured
          </p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="border-b border-rule py-3">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-[15px] tracking-tight text-ink">
                  {row.name}
                  <span className="ml-2 font-mono text-xs text-ink-3">
                    {row.role}
                  </span>
                </p>
                <p data-numeric className="tnum font-mono text-sm text-ink">
                  {row.score.toFixed(2)}
                  <Cite evidenceId={row.evidenceId} />
                </p>
              </div>
              <div className="relative mt-2 h-7 bg-surface">
                <div
                  className="bar-grow absolute inset-y-0 left-0 bg-strong"
                  style={{
                    width: `${(row.score / top) * 100}%`,
                    borderRadius: "999px",
                    border: "2px solid var(--outline)",
                  }}
                />
                {ceiling !== null && (
                  <div
                    className="control-line absolute inset-y-[-4px]"
                    style={{ left: `${(ceiling / top) * 100}%` }}
                  />
                )}
              </div>
            </div>
          ))
        )}
        {ceiling !== null && (
          <div className="relative mt-1 h-6" aria-hidden="true">
            <div
              className="absolute top-0 -translate-x-1/2"
              style={{ left: `${(ceiling / top) * 100}%` }}
            >
              <span className="control-pill">control</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const REACH_SLOTS: Array<{
  slot: "interests" | "people" | "podcasts" | "brands" | "places";
  label: string;
}> = [
  { slot: "interests", label: "Interests" },
  { slot: "people", label: "People" },
  { slot: "podcasts", label: "Podcasts" },
  { slot: "brands", label: "Brands" },
  { slot: "places", label: "Places" },
];

function ReachBlock({ result }: { result: FlowResult }) {
  const reach = result.reach;
  if (reach === null) {
    return (
      <section aria-label="Reach plan" className="mt-8">
        <h3 className="text-base tracking-tight text-ink">Reach plan</h3>
        <p className="mt-2 text-body text-ink-2">
          Nothing beat the control ceiling, so there is no reach plan. The app
          says so instead of inventing one.
        </p>
      </section>
    );
  }
  if (reach.length === 0) {
    return (
      <section aria-label="Reach plan" className="mt-8">
        <h3 className="text-base tracking-tight text-ink">Reach plan</h3>
        <p className="mt-2 text-body text-ink-2">
          This audience beat the ceiling, but no reach items were measured.
        </p>
      </section>
    );
  }
  return (
    <section aria-label="Reach plan" className="mt-8">
      <h3 className="text-base tracking-tight text-ink">Reach plan</h3>
      {reach.map((group) => (
        <div key={group.audienceId} className="mt-4">
          <p className="font-serif text-lg tracking-tight text-ink">
            {group.audienceName}
          </p>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            {REACH_SLOTS.map(({ slot, label }) => {
              const items = group[slot];
              return (
                <div key={String(slot)} className="bg-paper p-4">
                  <h4 className="text-base tracking-tight text-ink">{label}</h4>
                  {items.length === 0 ? (
                    <p className="nodata mt-3 px-2 py-2 font-mono text-xs text-ink-2">
                      not measured
                    </p>
                  ) : (
                    <ul className="mt-2 divide-y divide-rule">
                      {items.map((item) => (
                        <li
                          key={`${slot}-${item.name}`}
                          className="flex items-baseline justify-between gap-3 py-2"
                        >
                          <p className="text-[15px] text-ink">{item.name}</p>
                          <p
                            data-numeric
                            className="tnum shrink-0 font-mono text-sm text-ink"
                          >
                            #{item.rank}
                            <Cite evidenceId={item.evidenceId} />
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

export function FlowResultView({ result }: { result: FlowResult }) {
  return (
    <div>
      <VerdictHeadline result={result} />
      <Bars result={result} />
      <ReachBlock result={result} />
      <section aria-label="Targeting brief" className="mt-8">
        <h3 className="text-base tracking-tight text-ink">Targeting brief</h3>
        <p className="mt-1 max-w-prose text-body text-ink-2">
          One-page markdown you can paste anywhere.
        </p>
        <button
          type="button"
          className="btn-primary mt-3 px-5 py-2.5 text-sm"
          onClick={() => {
            const rows = barRows(result);
            const lines = [
              `# Targeting brief — ${VERDICT_WORDS[result.verdict]}`,
              "",
              `Pitch: ${result.pitch}`,
              `Type: ${result.type}`,
              "",
              "## Fit scores",
              ...rows.map(
                (r) =>
                  `- ${r.name} (${r.role}): ${r.score.toFixed(2)}${
                    r.evidenceId ? ` [evidence: ${r.evidenceId}]` : ""
                  }`,
              ),
              "",
              `Control ceiling: ${
                result.ceiling === null
                  ? "not measured"
                  : result.ceiling.toFixed(2)
              }`,
              ...(isCloseCall(result)
                ? [
                    "Close call: near the control line — a re-run may read differently.",
                  ]
                : []),
              `Qloo calls: ${result.qlooCalls.network} network, ${result.qlooCalls.cached} cached`,
              "",
              "## Reach plan",
              ...(result.reach === null
                ? ["None: nothing beat the control ceiling."]
                : result.reach.flatMap((g) => [
                    `### ${g.audienceName}`,
                    ...REACH_SLOTS.flatMap(({ slot, label }) => [
                      `${label}: ${
                        g[slot].length === 0
                          ? "not measured"
                          : g[slot]
                              .map((i) => `${i.name} (#${i.rank})`)
                              .join(", ")
                      }`,
                    ]),
                  ])),
              "",
              "Built from group-level taste data. Does not predict outcomes.",
            ];
            void navigator.clipboard?.writeText(lines.join("\n"));
          }}
        >
          Copy as targeting brief
        </button>
      </section>
    </div>
  );
}
