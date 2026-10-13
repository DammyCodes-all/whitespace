import type { ChatbotView } from "@/components/chatbot-preview";
import { ChatbotTitles, verdictBand } from "@/components/compare-shared";
import type { Audience, FitScore, VerdictResult } from "@/lib/types";
import { buildCopy } from "@/lib/compare/copy";

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
  const foundCount = chatbot?.found.length ?? 0;
  const totalCount = foundCount + (chatbot?.notFoundTitles.length ?? 0);
  const emptyMessage =
    error?.startsWith("not measured") === true
      ? error
      : `not measured: ${error ?? "Chatbot comparison unavailable."}`;
  const band = verdictBand(verdict.verdict);
  const copy = buildCopy({
    verdict: verdict.verdict,
    best:
      top !== undefined && topScore !== undefined
        ? { label: top.name, score: topScore.score }
        : null,
    controlScore:
      topScore === undefined
        ? null
        : topScore.score - verdict.marginTopVsControl,
    runnerUp:
      runnerUp === undefined
        ? null
        : {
            label:
              top === undefined
                ? "second"
                : (runnerUpAudience?.name ?? "second"),
            score: runnerUp.score,
          },
    titles: top?.titles.map((title) => title.name) ?? [],
  });
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
                {copy.badge}
              </span>
            </p>
          ) : (
            <p className="mt-4 font-serif text-2xl text-ink">{copy.badge}</p>
          )}
          {copy.body.map((line) => (
            <p
              key={line}
              className="mt-2 text-sm leading-relaxed text-ink-2"
            >
              {line}
            </p>
          ))}
          {copy.source !== null && top !== undefined && (
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              {copy.source}
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
