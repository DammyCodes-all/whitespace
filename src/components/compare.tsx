import type { ChatbotView } from "@/components/chatbot-preview";
import type { Audience, FitScore, VerdictResult } from "@/lib/types";

function ChatbotTitles({ chatbot }: { chatbot: ChatbotView }) {
  return (
    <ul className="mt-4 divide-y divide-rule border-y border-rule">
      {chatbot.found.map((title) => (
        <li
          key={title.qlooId}
          className="flex items-baseline justify-between gap-4 py-2"
        >
          <span className="text-sm text-ink">{title.name}</span>
          <span className="shrink-0 font-mono text-xs text-ink-2">
            in Qloo&apos;s catalog
          </span>
        </li>
      ))}
      {chatbot.notFoundTitles.map((query) => (
        <li
          key={query}
          className="flex items-baseline justify-between gap-4 py-2"
        >
          <span className="text-sm text-ink-3">{query}</span>
          <span className="shrink-0 font-mono text-xs text-clay">
            Qloo doesn&apos;t know it
          </span>
        </li>
      ))}
    </ul>
  );
}

function verdictBand(verdict: VerdictResult["verdict"]): string | null {
  if (verdict === "Strong") return "bg-strong";
  if (verdict === "Mixed") return "bg-split";
  return null;
}

/**
 * §6.7 in plain words. The bar was a metaphor nobody could decode, the old
 * sentence used the term before defining it, and it made the reader
 * subtract. The panel now states each score outright: the audience, the
 * unrelated level, the runner-up. No pronouns, no differences.
 */
function unrelatedLevel(topScore: number, marginTopVsControl: number): number {
  return Math.round((topScore - marginTopVsControl) * 100);
}

export function CompareView({
  chatbot,
  error,
  audiences,
  scores,
  verdict,
}: {
  chatbot: ChatbotView | null;
  error: string | null;
  audiences: Audience[];
  scores: FitScore[];
  verdict: VerdictResult;
}) {
  const top = audiences.find(
    (audience) => audience.id === verdict.topAudienceId,
  );
  const topScore = scores.find((score) => score.audienceId === top?.id);
  const ranked = scores
    .filter((score) =>
      audiences.some((audience) => audience.id === score.audienceId),
    )
    .sort((a, b) => b.score - a.score);
  const runnerUp = ranked.find((score) => score.audienceId !== top?.id);
  const runnerUpAudience = runnerUp
    ? audiences.find((audience) => audience.id === runnerUp.audienceId)
    : undefined;
  const secondName =
    top === undefined ? "second" : (runnerUpAudience?.name ?? "second");
  // Each score stated outright. No differences, no subtraction: the panel
  // shows the audience's number, the unrelated level, and the runner-up's.
  const topPct = topScore === undefined ? 0 : Math.round(topScore.score * 100);
  const barPct =
    topScore === undefined
      ? 0
      : unrelatedLevel(topScore.score, verdict.marginTopVsControl);
  const runnerUpPct =
    runnerUp === undefined ? 0 : Math.round(runnerUp.score * 100);
  const foundCount = chatbot?.found.length ?? 0;
  const totalCount = foundCount + (chatbot?.notFoundTitles.length ?? 0);
  const emptyMessage =
    error?.startsWith("not measured") === true
      ? error
      : `not measured: ${error ?? "Chatbot comparison unavailable."}`;
  const verdictLabel =
    verdict.verdict === "Strong"
      ? "Strong fit"
      : verdict.verdict === "Weak"
        ? "Weak fit"
        : verdict.verdict === "Mixed"
          ? "Mixed fit"
          : verdict.verdict;
  const band = verdictBand(verdict.verdict);
  const takeaway =
    verdict.verdict === "Inconclusive"
      ? "Not enough Qloo data to judge. Both sides are withheld."
      : verdict.clearsControl
        ? "Our answer is measured against Qloo. The chatbot's is a guess."
        : "Neither answer can be trusted here. Ours ran low, and the chatbot's was never measured.";

  return (
    <section aria-label="Chatbot comparison" className="mt-12">
      <h2 className="text-lg tracking-tight text-ink">
        Two answers to the same pitch
      </h2>
      <p className="mt-2 max-w-prose text-sm font-medium leading-relaxed text-ink">
        {takeaway}
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-12">
        <div className="card p-5 sm:p-6 md:col-span-7">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
            Whitespace · Qloo-backed
          </p>
          {band !== null ? (
            <p className="mt-4">
              <span
                className={`inline-block rounded-full border-2 border-outline px-4 py-1 font-serif text-2xl text-ink ${band}`}
              >
                {verdictLabel}
              </span>
            </p>
          ) : (
            <p className="mt-4 font-serif text-2xl text-ink">{verdictLabel}</p>
          )}
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            <span className="font-serif text-base text-ink">
              {top === undefined
                ? "No audience could be judged"
                : `Best fit: ${top.name}`}
            </span>
          </p>
          {topScore === undefined ? (
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              No audience could be judged on this run.
            </p>
          ) : verdict.verdict === "Inconclusive" ? (
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Not enough Qloo data to judge this audience. The numbers are
              withheld rather than guessed.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                {verdict.clearsControl
                  ? `Their taste matches your idea ${topPct}%.`
                  : `The closest, ${top?.name}, matches your idea ${topPct}%.`}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                An unrelated group matches it {barPct}%.
              </p>
              {runnerUp !== undefined && (
                <p className="mt-2 text-sm leading-relaxed text-ink-2">
                  {secondName === "second"
                    ? `The next best audience matches it ${runnerUpPct}%.`
                    : `The next best, ${secondName}, matches it ${runnerUpPct}%.`}
                </p>
              )}
            </>
          )}
          {top !== undefined && top.titles.length > 0 && (
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Based on: {top.titles.map((title) => title.name).join(", ")}
              {top.notFoundTitles.length > 0 && (
                <span className="font-mono text-xs text-ink-3">
                  {" "}
                  · {top.notFoundTitles.length} not found in Qloo
                </span>
              )}
            </p>
          )}
        </div>
        <div className="rounded-2xl border-2 border-dashed border-ink-3 bg-paper p-5 shadow-[4px_4px_0_var(--outline)] sm:p-6 md:col-span-5">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
            Plain chatbot · no Qloo
          </p>
          {chatbot === null ? (
            <>
              <p className="nodata mt-4 px-2 py-2 font-mono text-xs text-ink-3">
                {emptyMessage}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-3">
                Would answer the same pitch with no Qloo tools, then check each
                title in Qloo.
              </p>
            </>
          ) : totalCount === 0 ? (
            <p className="nodata mt-4 px-2 py-2 font-mono text-xs text-ink-3">
              not measured: no titles to check
            </p>
          ) : (
            <>
              <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-2">
                {chatbot.answer}
              </p>
              <p className="mt-4 text-sm font-medium leading-relaxed text-ink">
                These are guesses. Nothing here was checked.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                {foundCount} of the {totalCount} titles it named are real. Its
                advice about who to reach is not checked.
              </p>
              <ChatbotTitles chatbot={chatbot} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
