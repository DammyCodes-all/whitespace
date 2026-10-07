import type { ChatbotView } from "@/components/chatbot-preview";
import type { Audience, FitScore, VerdictResult } from "@/lib/types";

function ChatbotTitles({
  chatbot,
  callId,
}: {
  chatbot: ChatbotView;
  callId?: string;
}) {
  return (
    <ul className="mt-4 divide-y divide-rule border-y border-rule">
      {chatbot.found.map((title) => (
        <li
          key={title.qlooId}
          className="flex items-baseline justify-between gap-4 py-2"
        >
          <span className="text-sm text-ink">{title.name}</span>
          {callId === undefined ? (
            <span className="shrink-0 font-mono text-xs text-ink-2">
              found in Qloo
            </span>
          ) : (
            <a
              href={`#${callId}`}
              className="cite shrink-0 font-mono text-xs text-ink-2"
            >
              found in Qloo [e]
            </a>
          )}
        </li>
      ))}
      {chatbot.notFoundTitles.map((query) => (
        <li
          key={query}
          className="flex items-baseline justify-between gap-4 py-2"
        >
          <span className="text-sm text-ink-3">{query}</span>
          {callId === undefined ? (
            <span className="shrink-0 font-mono text-xs text-clay">
              not found
            </span>
          ) : (
            <a
              href={`#${callId}`}
              className="cite shrink-0 font-mono text-xs text-clay"
            >
              not found [e]
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function verdictColor(verdict: VerdictResult["verdict"]): string {
  if (verdict === "Strong") return "text-measured";
  if (verdict === "Split") return "text-split";
  return "text-ink-3";
}

export function CompareView({
  chatbot,
  error,
  audiences,
  scores,
  verdict,
  topCallId,
  chatbotCallId,
}: {
  chatbot: ChatbotView | null;
  error: string | null;
  audiences: Audience[];
  scores: FitScore[];
  verdict: VerdictResult;
  topCallId?: string;
  chatbotCallId?: string;
}) {
  const top = audiences.find(
    (audience) => audience.id === verdict.topAudienceId,
  );
  const topScore = scores.find((score) => score.audienceId === top?.id);
  const foundCount = chatbot?.found.length ?? 0;
  const notFoundCount = chatbot?.notFoundTitles.length ?? 0;
  const totalCount = foundCount + notFoundCount;
  const groundingPct =
    chatbot !== null && totalCount > 0
      ? Math.round((foundCount / totalCount) * 100)
      : null;
  const emptyMessage =
    error?.startsWith("not measured") === true
      ? error
      : `not measured: ${error ?? "Chatbot comparison unavailable."}`;

  return (
    <section aria-label="Chatbot comparison" className="mt-12">
      <h2 className="text-lg tracking-tight text-ink">Compare the readings</h2>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-2">
        Same pitch, two methods: Whitespace uses Qloo taste evidence; the
        chatbot receives no Qloo tools.
      </p>
      {chatbot !== null && totalCount > 0 ? (
        <p className="mt-2 font-mono text-xs text-ink-2">
          <span data-numeric className="tnum">
            chatbot titles: {totalCount} checked · {foundCount} found ·{" "}
            {notFoundCount} not found
          </span>
          {groundingPct !== null && (
            <span data-numeric className="tnum">
              {" "}
              · grounding {groundingPct}%
            </span>
          )}
          {chatbotCallId !== undefined && (
            <a
              href={`#${chatbotCallId}`}
              className="cite ml-1"
              aria-label="Evidence for chatbot title checks"
            >
              [e]
            </a>
          )}
        </p>
      ) : null}
      <div className="mt-4 grid gap-px border border-rule bg-rule md:grid-cols-12">
        <div className="bg-surface p-5 sm:p-6 md:col-span-7">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
            Whitespace · Qloo-backed
          </p>
          <p
            className={`mt-4 font-serif text-2xl ${verdictColor(verdict.verdict)}`}
          >
            {verdict.verdict}
            {topCallId !== undefined && (
              <a
                href={`#${topCallId}`}
                className="cite ml-2 font-mono text-xs"
                aria-label="Evidence for Whitespace verdict"
              >
                [e]
              </a>
            )}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            <span className="font-serif text-base text-ink">
              {top?.name ?? "No audience could be judged"}
            </span>
            {topScore !== undefined && (
              <span
                data-numeric
                className="tnum ml-2 font-mono text-sm text-ink"
              >
                {topScore.score.toFixed(2)}
              </span>
            )}
          </p>
          <p className="mt-3 font-mono text-xs text-ink-3">
            {verdict.clearsControl
              ? "Clears the control ceiling."
              : "Does not clear the control ceiling."}
          </p>
        </div>
        <div className="bg-paper p-5 sm:p-6 md:col-span-5">
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
          ) : (
            <>
              <p className="mt-4 font-mono text-[13px] leading-relaxed text-ink-2">
                {chatbot.answer}
              </p>
              <ChatbotTitles chatbot={chatbot} callId={chatbotCallId} />
              {groundingPct !== null && (
                <p className="mt-3 font-mono text-xs text-ink-3">
                  <span data-numeric className="tnum">
                    grounding {foundCount}/{totalCount} = {groundingPct}%
                  </span>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
