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
import type { FlowBarRow, FlowResult, ReachSlot } from "@/lib/flow/contract";
import { barRows, isCloseCall } from "@/lib/flow/contract";
import { resolveReachSections } from "@/lib/flow/reach-copy";
import { segmentReachProse } from "@/lib/flow/reach-highlight";
import {
  FIT_INDEX_NOTE,
  fitIndex,
  fitIndexLabel,
} from "@/lib/scoring/fit-index";

/**
 * What a slot's items are called, singular and plural — the count on
 * the heading row is measured, so it says what was counted.
 */
const SLOT_NOUN: Record<ReachSlot, [string, string]> = {
  interests: ["taste", "tastes"],
  people: ["name", "names"],
  podcasts: ["show", "shows"],
  brands: ["brand", "brands"],
  places: ["place", "places"],
};

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
  const index = fitIndex(top.score);
  if (result.surprise)
    return `${top.name} has a fit index of ${index} — and fits the titles you named too.`;
  if (result.verdict === "weak") {
    return `The closest, ${top.name}, has a fit index of ${index}.`;
  }
  if (top.role === "named") {
    return `The fans of the titles you named have a fit index of ${index}.`;
  }
  return `What they like has a fit index of ${index}.`;
}

function barFill(index: number): string {
  if (index === 0) return "bg-strong";
  if (index === 1) return "bg-split";
  return "bg-weak";
}

/**
 * The reach prose with the measured names inside it picked out. The
 * names are the run's own items — Qloo's entities, in Qloo's order —
 * so the emphasis can never introduce a fact the run did not measure
 * (§6.8, §7). It stays prose, not a list.
 */
function ReachProse({ text, names }: { text: string; names: string[] }) {
  return (
    <>
      {segmentReachProse(text, names).map((segment) =>
        segment.strong ? (
          <strong key={segment.id} className="font-medium text-ink">
            {segment.text}
          </strong>
        ) : (
          <span key={segment.id}>{segment.text}</span>
        ),
      )}
    </>
  );
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
      className={`card px-6 py-5 ${
        orange ? "bg-surprise" : VERDICT_FILLS[result.verdict]
      }`}
    >
      <p className="font-mono text-xs tracking-tight text-ink">
        {VERDICT_WORDS[result.verdict]}
      </p>
      <h2
        data-verdict-heading
        tabIndex={-1}
        className="mt-1 font-serif text-2xl tracking-tight text-ink"
      >
        {result.surprise
          ? "Your best fit is not the audience you named."
          : verdictSentence(result)}
      </h2>
      {top !== undefined && (
        <p className="mt-2 max-w-prose text-body text-ink">
          {scoreLine(result, top)}
        </p>
      )}
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-2">
        {FIT_INDEX_NOTE}
      </p>
      {isCloseCall(result) && (
        <p className="mt-2 max-w-prose text-body text-ink">
          Close call — this one sits only just above the comparison line. A
          re-run may read differently. Adjust the words and run again.
        </p>
      )}
      <p className="mt-2 max-w-prose text-body text-ink">
        {result.ceiling === null
          ? "No comparison audience could be measured, so there is nothing to compare this against."
          : `The comparison line sits at fit index ${fitIndex(result.ceiling)}.`}
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
      <h3 className="text-base tracking-tight text-ink">Who fits best</h3>
      <p className="mt-1 max-w-prose text-sm text-ink-2">
        One bar per audience, best first.{" "}
        {ceiling === null
          ? "No comparison audience could be measured, so there is no line to compare against."
          : `The ink line marks the comparison line: fit index ${fitIndex(ceiling)}. It is the strangers baseline when measured; otherwise the best eligible other-genre control.`}
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
                    {fitIndexLabel(row.score)}
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
                comparison line {fitIndexLabel(ceiling ?? 0)}
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
          No audience scored above the comparison line, so there is nowhere to
          point you. The app says so instead of inventing one.
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
          This audience scored above the comparison line, but nothing they love
          was measured.
        </p>
      </section>
    );
  }
  return (
    <section aria-label="Where to find them" className="mt-8">
      <h3 className="text-base tracking-tight text-ink">Where to find them</h3>
      <p className="mt-1 max-w-prose text-sm text-ink-3">
        Not a list. What their taste already points to.
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
            <h4 className="font-serif text-3xl leading-tight tracking-tight text-ink">
              {group.audienceName}
            </h4>
            {/* Balanced columns, not a grid of pairs: a fixed two-column
                grid leaves a hole under the shortest section, and the
                hole is what makes the card read as a half-filled form.
                Multi-column balances the two sides, and a magazine
                column is read top-to-bottom then across — the same
                order the DOM is in. */}
            <div className="mt-6 columns-1 gap-12 lg:columns-2">
              {visibleSlots.map(({ slot, label }) => {
                const text = sections[slot];
                const items = group[slot];
                const count = items.length;
                return (
                  <section
                    key={slot}
                    className="mb-7 break-inside-avoid border-t border-rule pt-3"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <h5 className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-ink">
                        {label}
                      </h5>
                      {count > 0 ? (
                        <span className="shrink-0 font-mono text-[11px] text-ink-3">
                          {count === 1
                            ? `${count} ${SLOT_NOUN[slot][0]}`
                            : `${count} ${SLOT_NOUN[slot][1]}`}
                        </span>
                      ) : null}
                    </div>
                    {text === null || text.trim() === "" ? (
                      <p className="nodata mt-3 inline-block px-2 py-1 font-mono text-xs text-ink-2">
                        not measured
                      </p>
                    ) : (
                      <p className="mt-2.5 text-[15px] leading-[1.65] text-ink-2">
                        <ReachProse
                          text={text}
                          names={items.map((item) => item.name)}
                        />
                      </p>
                    )}
                  </section>
                );
              })}
            </div>
          </article>
        );
      })}
    </section>
  );
}

/**
 * §6.3: the agent's re-plan, said out loud. When the pitch's own words
 * came back empty from the graph, the run asked again from the titles
 * the user named — a different question, not the same one again. The
 * result says so, because a run that quietly changed its plan is a run
 * you cannot check. It promises nothing about the answer: the second
 * search can come back empty too.
 */
function ReplanNote({ result }: { result: FlowResult }) {
  if (result.rivalDiscovery?.rePlanned !== true) return null;
  return (
    <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-3">
      The pitch&apos;s own words came back empty in Qloo, so the run asked again
      from the titles you named.
    </p>
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
      <ReplanNote result={result} />
      <Bars result={result} />
      <ReachBlock result={result} />
    </div>
  );
}
