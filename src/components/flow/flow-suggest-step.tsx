"use client";

import LoadingState from "@/components/ui/loading-state";

/**
 * Entity-seeded title suggestions.
 * Heading contract: h2#flow-suggest-heading. Spec: §6.1 (copy unchanged).
 */
export function FlowSuggestStep({
  similarTitles,
  suggestions,
  suggestBusy,
  suggestDone,
  busy,
  onAddSuggested,
}: {
  similarTitles: string;
  suggestions: string[];
  suggestBusy: boolean;
  suggestDone: boolean;
  busy: boolean;
  onAddSuggested: (title: string) => void;
}) {
  if (suggestBusy) {
    return (
      <output aria-live="polite" className="mt-6 block">
        <LoadingState label="Finding titles like yours" variant="Dots" />
      </output>
    );
  }
  if (suggestions.length > 0) {
    return (
      <section aria-labelledby="flow-suggest-heading" className="mt-6">
        <h2
          id="flow-suggest-heading"
          className="text-lg tracking-tight text-ink"
        >
          Similar to your idea?
        </h2>
        <p className="mt-1 max-w-prose text-body text-ink-2">
          From the taste database — titles related to the ones you typed. Tap to
          add; each is verified at the run.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((title) => {
            const added = similarTitles
              .split(",")
              .map((s) => s.trim().toLowerCase())
              .includes(title.trim().toLowerCase());
            if (added) return null;
            return (
              <li key={title}>
                <button
                  type="button"
                  onClick={() => onAddSuggested(title)}
                  disabled={busy}
                  className="btn-secondary px-4 py-2 text-sm"
                >
                  + {title}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }
  if (!suggestDone) return null;
  return (
    <p className="mt-6 max-w-prose text-body text-ink-2">
      No suggestions this time — the database had nothing related to your
      titles. Type your own above; Check verifies each.
    </p>
  );
}
