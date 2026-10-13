import type { ChatbotView } from "@/components/chatbot-preview";
import type { Verdict } from "@/lib/types";

/**
 * Shared by the v1 (`compare.tsx`) and flow (`flow-compare.tsx`) §6.11
 * panels so the two readings cannot drift apart. Presentational only:
 * each panel keeps its own takeaway logic.
 */

export function ChatbotTitles({ chatbot }: { chatbot: ChatbotView }) {
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

export function verdictBand(verdict: Verdict): string | null {
  if (verdict === "Strong") return "bg-strong";
  if (verdict === "Mixed") return "bg-split";
  return null;
}
