/**
 * Package C step 8: the results view, built on the adapter only.
 * Server Component: no `FlowResult` field is re-derived here, and no
 * placeholder 0 can reach a bar because the adapter already nulled
 * unjudgeable scores.
 *
 * design-direction.md §2 (bars + solid ink control line), §3 (verdict
 * always carries its word), §6 (no number without evidence).
 */

import { REACH_SLOTS, VERDICT_WORDS } from "@/lib/flow/brief";
import type { FlowBarRow, FlowResult } from "@/lib/flow/contract";
import { barRows, isCloseCall } from "@/lib/flow/contract";

const VERDICT_FILLS: Record<FlowResult["verdict"], string> = {
  strong: "bg-strong",
  mixed: "bg-split",
  weak: "bg-weak",
  inconclusive: "bg-paper",
};

const SLOT_FILLS: Record<string, string> = {
  interests: "bg-strong",
  people: "bg-split",
  podcasts: "bg-weak",
  brands: "bg-strong",
  places: "bg-split",
};

function marginLine(score: number, ceiling: number | null): string | null {
  if (ceiling === null) return null;
  const diff = Math.round((score - ceiling) * 100);
  if (diff > 0) return `${diff} points past the bar.`;
  if (diff < 0) return `${-diff} points short of the bar.`;
  return "Exactly on the bar.";
}

/**
 * §6.6 in one sentence. The score is how strongly this audience's tastes
 * match the pitch, so the line says exactly that — and never a difference
 * the reader has to work out. Show the numbers, never the gap.
 */
function scoreLine(result: FlowResult, top: FlowBarRow): string {
  const percent = Math.round(top.score * 100);
  if (result.surprise) return `${top.name} matches your idea ${percent}%.`;
  if (result.verdict === "weak") {
    return `The closest, ${top.name}, matches your idea ${percent}%.`;
  }
  return `Their taste matches your idea ${percent}%.`;
}

function barFill(index: number): string {
  if (index === 0) return "bg-strong";
  if (index === 1) return "bg-split";
  return "bg-weak";
}

function VerdictHeadline({
  result,
  orange,
}: {
  result: FlowResult;
  orange: boolean;
}) {
  const rows = barRows(result);
  const top = rows[0];
  return (
    <div
      className={`card px-6 py-5 ${VERDICT_FILLS[result.verdict]}`}
      style={
        orange
          ? { backgroundColor: "#f76743", color: "#17151F" }
          : undefined
      }
    >
      <p
        className={`font-mono text-xs tracking-tight ${orange ? "text-white" : "text-ink"}`}
      >
        {VERDICT_WORDS[result.verdict]}
      </p>
      <h2 className="mt-1 font-serif text-2xl tracking-tight text-ink">
        {result.surprise
          ? "Your best fit is not the audience you named."
          : verdictSentence(result)}
      </h2>
      {top !== undefined && (
        <p className="mt-2 max-w-prose text-body text-ink">
          {scoreLine(result, top)}
        </p>
      )}
      {isCloseCall(result) && (
        <p className="mt-2 max-w-prose text-body text-ink">
          Close call — this one sits only just above an unrelated group. A
          re-run may read differently. Adjust the words and run again.
        </p>
      )}
      <p className="mt-2 max-w-prose text-body text-ink">
        {result.ceiling === null
          ? "No unrelated group was measured, so there is nothing to compare this against."
          : `An unrelated group matches it ${Math.round(result.ceiling * 100)}%.`}
      </p>
    </div>
  );
}

function verdictSentence(result: FlowResult): string {
  const rows = barRows(result);
  const top = rows[0];
  if (result.verdict === "inconclusive") {
    return "There was not enough measured data to judge this pitch.";
  }
  if (result.verdict === "weak") {
    return "No audience clearly fits your idea.";
  }
  if (top === undefined) return "No audience matched your idea.";
  return `Best fit: ${top.name}.`;
}

function Bars({ result }: { result: FlowResult }) {
  const rows: FlowBarRow[] = barRows(result);
  const ceiling = result.ceiling;
  return (
    <section aria-label="Ranked audiences" className="mt-8">
      <h3 className="text-base tracking-tight text-ink">
        Who fits best
      </h3>
      <p className="mt-1 max-w-prose text-sm text-ink-2">
        One bar per audience, best first. The ink line is the bar: the best
        score of any audience that has nothing to do with your idea.
      </p>
      <div className="mt-4">
        {rows.length === 0 ? (
          <p className="nodata px-3 py-2 font-mono text-xs text-ink-2">
            not measured
          </p>
        ) : (
          rows.map((row, index) => {
            const margin = marginLine(row.score, ceiling);
            const fill = barFill(index);
            return (
              <div key={row.id} className="border-b border-rule py-3">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-[15px] tracking-tight text-ink">
                  {row.name}
                </p>
                <p data-numeric className="tnum font-mono text-sm text-ink">
                  {Math.round(row.score * 100)}%
                </p>
              </div>
              <div className="relative mt-2 h-7 rounded-full bg-surface">
                <div
                  className={`bar-grow absolute inset-y-0 left-0 ${fill}`}
                  style={{
                    width: `${row.score * 100}%`,
                    borderRadius: "999px",
                    border: "2px solid var(--outline)",
                  }}
                />
                {ceiling !== null && (
                  <div
                    className="control-line absolute inset-y-[-4px]"
                    style={{ left: `${ceiling * 100}%` }}
                  />
                )}
              </div>
              {margin !== null && (
                <p className="mt-1 text-sm text-ink-2">{margin}</p>
              )}
            </div>
            );
          })
        )}
        {ceiling !== null && (
          <div className="relative mt-1 h-6" aria-hidden="true">
            <div
              className="absolute top-0 -translate-x-1/2"
              style={{ left: `${ceiling * 100}%` }}
            >
              <span className="control-pill">the bar</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ReachBlock({ result }: { result: FlowResult }) {
  const reach = result.reach;
  if (reach === null) {
    return (
      <section aria-label="Where to find them" className="mt-8">
        <h3 className="text-base tracking-tight text-ink">Where to find them</h3>
        <p className="mt-2 text-body text-ink-2">
          Nothing beat the bar, so there is no list of where to find them.
          The app says so instead of inventing one.
        </p>
      </section>
    );
  }
  if (reach.length === 0) {
    return (
      <section aria-label="Where to find them" className="mt-8">
        <h3 className="text-base tracking-tight text-ink">Where to find them</h3>
        <p className="mt-2 text-body text-ink-2">
          This audience beat the bar, but nothing they love was measured.
        </p>
      </section>
    );
  }
  return (
    <section aria-label="Where to find them" className="mt-8">
      <h3 className="text-base tracking-tight text-ink">Where to find them</h3>
      <p className="mt-1 max-w-prose text-sm text-ink-3">
        What these audiences already love.
      </p>
      {reach.map((group) => (
        <div key={group.audienceId} className="mt-5">
          <p className="font-serif text-3xl leading-tight tracking-tight text-ink">
            {group.audienceName}
          </p>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            {REACH_SLOTS.map(({ slot, label }) => {
              const items = group[slot];
              return (
                <div
                  key={String(slot)}
                  className={`card p-4 ${SLOT_FILLS[slot] ?? "bg-paper"} ${slot === "places" ? "sm:col-span-2" : ""}`}
                >
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
                            their #{item.rank}
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

export function FlowResultView({
  result,
  orangeVerdict = false,
}: {
  result: FlowResult;
  orangeVerdict?: boolean;
}) {
  return (
    <div>
      <VerdictHeadline result={result} orange={orangeVerdict} />
      <Bars result={result} />
      <ReachBlock result={result} />
    </div>
  );
}
