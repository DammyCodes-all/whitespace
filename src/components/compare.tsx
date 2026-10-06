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
    <ul className="mt-4 border-t border-rule">
      {chatbot.found.map((title) => (
        <li
          key={title.qlooId}
          className="flex items-baseline justify-between gap-4 border-b border-rule py-1.5"
        >
          <span className="text-[15px] text-ink">{title.name}</span>
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
          className="flex items-baseline justify-between gap-4 border-b border-rule py-1.5"
        >
          <span className="text-[15px] text-ink-3">{query}</span>
          {callId === undefined ? (
            <span className="shrink-0 font-mono text-xs text-ink-3">
              not found
            </span>
          ) : (
            <a
              href={`#${callId}`}
              className="cite shrink-0 font-mono text-xs text-ink-3"
            >
              not found [e]
            </a>
          )}
        </li>
      ))}
    </ul>
  );
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

  return (
    <section aria-label="Chatbot comparison" className="mt-12">
      <h2 className="text-lg tracking-tight text-ink">Compare the readings</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">
        Same pitch, two methods: Whitespace uses Qloo taste evidence; the
        chatbot receives no Qloo tools.
      </p>
      <div className="mt-4 grid gap-px border border-rule bg-rule md:grid-cols-2">
        <div className="bg-surface p-5">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
            Whitespace · Qloo-backed
          </p>
          <p className="mt-4 font-serif text-xl text-ink">
            {verdict.verdict}
            {topCallId !== undefined && (
              <a href={`#${topCallId}`} className="cite ml-2 font-mono text-xs">
                [e]
              </a>
            )}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            {top?.name ?? "No audience could be judged"}
            {topScore === undefined ? "" : ` · ${topScore.score.toFixed(2)}`}
          </p>
          <p className="mt-3 font-mono text-xs text-ink-3">
            {verdict.clearsControl
              ? "Clears the control ceiling."
              : "Does not clear the control ceiling."}
            {chatbotCallId !== undefined && (
              <a href={`#${chatbotCallId}`} className="cite ml-2">
                [e]
              </a>
            )}
          </p>
        </div>
        <div className="bg-paper p-5">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-3">
            Plain chatbot · no Qloo
          </p>
          {chatbot === null ? (
            <p className="nodata mt-4 px-2 py-2 font-mono text-xs text-ink-3">
              {error ?? "Chatbot comparison unavailable."}
            </p>
          ) : (
            <>
              <p className="mt-4 text-[15px] leading-relaxed text-ink">
                {chatbot.answer}
              </p>
              <ChatbotTitles chatbot={chatbot} callId={chatbotCallId} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
