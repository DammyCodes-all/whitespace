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
import { resolveReachSections } from "@/lib/flow/reach-copy";

const VERDICT_FILLS: Record<FlowResult["verdict"], string> = {
  strong: "bg-strong",
  mixed: "bg-split",
  weak: "bg-weak",
  inconclusive: "bg-paper",
};

/**
 * §6.6 in one sentence, rivals-first: the winning audience leads, and
 * the named titles sit behind it as the benchmark — a rival winner
 * "matches the titles you named too", a named winner means the fans of
 * those titles agree. The surprise headline logic above is untouched.
 * Show the numbers, never the gap.
 */
function scoreLine(result: FlowResult, top: FlowBarRow): string {
  const percent = Math.round(top.score * 100);
  if (result.surprise)
    return `${top.name} matches your idea ${percent}% — and matches the titles you named too.`;
  if (result.verdict === "weak") {
    return `The closest, ${top.name}, matches your idea ${percent}%.`;
  }
  if (top.role === "named") {
    return `The fans of the titles you named match your idea ${percent}%.`;
  }
  return `What they like matches your idea ${percent}%.`;
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
        orange ? { backgroundColor: "#f76743", color: "#17151F" } : undefined
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
          Close call — this one sits only just above the other-genre line. A
          re-run may read differently. Adjust the words and run again.
        </p>
      )}
      <p className="mt-2 max-w-prose text-body text-ink">
        {result.ceiling === null
          ? "No other-genre audience could be measured, so there is nothing to compare this against."
          : `The strongest other-genre comparison matches it ${Math.round(result.ceiling * 100)}%.`}
      </p>
      {controlTestLine(result) !== null && (
        <p className="mt-2 max-w-prose text-body text-ink">
          {controlTestLine(result)}
        </p>
      )}
      {selfFitLine(result) !== null && (
        <p className="mt-2 max-w-prose text-body text-ink">
          {selfFitLine(result)}
        </p>
      )}
    </div>
  );
}

/**
 * §6.7 (fix 2): say the field result in words — how many measured
 * comparison audiences the winner beat. Silent when the field was
 * unusable, because then nothing was beaten.
 */
function controlTestLine(result: FlowResult): string | null {
  const test = result.controlTest;
  if (test === null || test.total === 0) return null;
  const noun = test.total === 1 ? "audience" : "audiences";
  return `It beats ${test.beaten} of the ${test.total} other-genre ${noun} measured.`;
}

/**
 * §6.7 (fix 1): the winner's lead re-checked with the tags that came
 * from its own titles removed. `leans` means the fit is unconfirmed;
 * `confirmed` means it held up without them. Never shown when the check
 * did not apply (a rival won, or no Strong was on the table).
 */
function selfFitLine(result: FlowResult): string | null {
  if (result.selfFit === "leans") {
    return "This audience leans on the titles you named: without their own tags it stops leading. Treat the fit as unconfirmed — add a few descriptive words and run again.";
  }
  if (result.selfFit === "confirmed") {
    return "It also leads without the tags from your own titles, so the fit is not just your titles agreeing with themselves.";
  }
  return null;
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
      <h3 className="text-base tracking-tight text-ink">Who fits best</h3>
      <p className="mt-1 max-w-prose text-sm text-ink-2">
        One bar per audience, best first.{" "}
        {ceiling === null
          ? "No other-genre audience could be measured, so there is no line to compare against."
          : `The ink line marks the strongest other-genre comparison: ${Math.round(ceiling * 100)}%.`}
      </p>
      <div className="mt-4">
        {rows.length === 0 ? (
          <p className="nodata px-3 py-2 font-mono text-xs text-ink-2">
            not measured
          </p>
        ) : (
          rows.map((row, index) => {
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
              <span className="control-pill">
                other-genre line {Math.round((ceiling ?? 0) * 100)}%
              </span>
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
        <h3 className="text-base tracking-tight text-ink">
          Where to find them
        </h3>
        <p className="mt-2 text-body text-ink-2">
          No audience scored above the other-genre comparison, so there is no
          list of where to find them. The app says so instead of inventing one.
        </p>
      </section>
    );
  }
  if (reach.length === 0) {
    return (
      <section aria-label="Where to find them" className="mt-8">
        <h3 className="text-base tracking-tight text-ink">
          Where to find them
        </h3>
        <p className="mt-2 text-body text-ink-2">
          This audience scored above the other-genre comparison, but nothing
          they love was measured.
        </p>
      </section>
    );
  }
  return (
    <section aria-label="Where to find them" className="mt-8">
      <h3 className="text-base tracking-tight text-ink">Where to find them</h3>
      <p className="mt-1 max-w-prose text-sm text-ink-3">
        Not a list. The places their taste already points to.
      </p>
      {reach.map((group) => {
        const gapGroup =
          result.gaps.find((gap) => gap.audienceId === group.audienceId) ??
          null;
        const sections = resolveReachSections(group, gapGroup);
        const visibleSlots = REACH_SLOTS.filter(
          ({ slot }) => slot !== "places" || group.places.length > 0,
        );
        return (
          <article key={group.audienceId} className="card mt-5 p-5 sm:p-7">
            <p className="font-serif text-3xl leading-tight tracking-tight text-ink">
              {group.audienceName}
            </p>
            <div className="mt-6 space-y-7">
              {visibleSlots.map(({ slot, label }) => {
                const text = sections[slot];
                return (
                  <div key={slot}>
                    <h4 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
                      {label}
                    </h4>
                    {text === null || text.trim() === "" ? (
                      <p className="nodata mt-2 inline-block px-2 py-1 font-mono text-xs text-ink-2">
                        not measured
                      </p>
                    ) : (
                      <p className="mt-2 max-w-prose text-[15px] leading-[1.65] text-ink-2">
                        {text}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
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
