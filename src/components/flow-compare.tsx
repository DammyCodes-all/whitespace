import type { ChatbotView } from "@/components/chatbot-preview";
import { ChatbotTitles, verdictBand } from "@/components/compare-shared";
import { buildCopy } from "@/lib/compare/copy";
import type { FlowResult } from "@/lib/flow/contract";
import { barRows } from "@/lib/flow/contract";
import type { Verdict } from "@/lib/types";

/**
 * §6.11 on the flow path: the same pitch answered with no Qloo tools,
 * beside the measured result. Built from `FlowResult` directly — no v1
 * adapter, no invented titles. The left card's copy comes from
 * `buildCopy` so text can never disagree with the numbers; the right
 * card's title marks come from Qloo, never from the chatbot.
 */

function flowVerdict(result: FlowResult): Verdict {
  switch (result.verdict) {
    case "strong":
      return "Strong";
    case "mixed":
      return "Mixed";
    case "weak":
      return "Weak";
    default:
      return "Inconclusive";
  }
}

export function FlowCompareView({
  result,
  similarTitles,
  chatbot,
  error,
}: {
  result: FlowResult;
  /** The user's own similar-to titles, for the source line. */
  similarTitles: string[];
  chatbot: ChatbotView | null;
  error: string | null;
}) {
  const verdict = flowVerdict(result);
  const rows = barRows(result);
  const top = rows[0];
  const runnerUp = rows[1];
  const foundCount = chatbot?.found.length ?? 0;
  const totalCount = foundCount + (chatbot?.notFoundTitles.length ?? 0);
  const emptyMessage =
    error?.startsWith("not measured") === true
      ? error
      : `not measured: ${error ?? "Chatbot comparison unavailable."}`;
  const band = verdictBand(verdict);
  const copy = buildCopy({
    verdict,
    best:
      top !== undefined
        ? { label: top.name, score: top.score, role: top.role }
        : null,
    controlScore: result.ceiling,
    runnerUp:
      runnerUp === undefined
        ? null
        : { label: runnerUp.name, score: runnerUp.score, role: runnerUp.role },
    titles: similarTitles,
  });
  const takeaway =
    verdict === "Inconclusive"
      ? "Not enough Qloo data to judge. Both sides are withheld."
      : result.reach !== null
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
            <p key={line} className="mt-2 text-sm leading-relaxed text-ink-2">
              {line}
            </p>
          ))}
          {copy.source !== null && (
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              {copy.source}
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
