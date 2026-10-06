import type { ResolvedTitle } from "@/lib/types";

/**
 * Day 9 U: minimal chatbot preview on the run page. Owned by U.
 *
 * Server Component: the same pitch answered with no Qloo tools (§6.11),
 * beside the Whitespace result. Titles carry their found/not-found
 * marks from Q's helper — the measurement, not a claim. The polished
 * side-by-side compare view is Day 10 (`compare.tsx`); this is the
 * fixture that proves the data flows.
 */

export interface ChatbotView {
  answer: string;
  found: ResolvedTitle[];
  notFoundTitles: string[];
}

export function ChatbotPreview({
  chatbot,
  error,
}: {
  chatbot: ChatbotView | null;
  error: string | null;
}) {
  return (
    <section aria-label="Chatbot comparison" className="mt-12">
      <h2 className="text-lg tracking-tight text-ink">
        Chatbot comparison{" "}
        <span className="font-mono text-xs text-ink-3">no Qloo</span>
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">
        Same pitch, same model, no taste data. Every title checked in Qloo.
      </p>
      {chatbot === null ? (
        <p className="nodata mt-4 px-2 py-2 font-mono text-xs text-ink-2">
          not measured: {error ?? "Chatbot comparison unavailable."}
        </p>
      ) : (
        <div className="mt-4">
          <p className="max-w-prose text-[15px] leading-relaxed text-ink">
            {chatbot.answer}
          </p>
          <ul className="mt-4 border-t border-rule">
            {chatbot.found.map((title) => (
              <li
                key={title.qlooId}
                className="flex items-baseline justify-between gap-4 border-b border-rule py-1.5"
              >
                <p className="text-[15px] tracking-tight text-ink">
                  {title.name}
                </p>
                <p className="shrink-0 font-mono text-xs text-ink-2">
                  found in Qloo
                </p>
              </li>
            ))}
            {chatbot.notFoundTitles.map((query) => (
              <li
                key={query}
                className="flex items-baseline justify-between gap-4 border-b border-rule py-1.5"
              >
                <p className="text-[15px] tracking-tight text-ink-3">{query}</p>
                <p className="shrink-0 font-mono text-xs text-ink-3">
                  not found
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
