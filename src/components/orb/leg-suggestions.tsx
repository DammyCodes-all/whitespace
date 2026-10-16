"use client";

/**
 * Entity-seeded title suggestions: titles related to the ones typed.
 * Rendered inside the titles leg and standalone on the aggregate leg
 * (where the titles input itself does not repeat).
 */

import { parseSimilarTitles } from "@/lib/flow/similar-titles";

export function TitleSuggestions({
  similarTitles,
  onAddSuggested,
  suggestions,
  suggestBusy,
  suggestDone,
  inputAbove,
}: {
  similarTitles: string;
  onAddSuggested: (title: string) => void;
  suggestions: string[];
  suggestBusy: boolean;
  suggestDone: boolean;
  /** True when the titles input sits above this block. */
  inputAbove: boolean;
}) {
  const parsed = parseSimilarTitles(similarTitles);

  if (suggestBusy) {
    return (
      <p className="mt-6 font-mono text-xs text-ink-3">
        Finding titles like yours…
      </p>
    );
  }
  if (suggestions.length > 0) {
    return (
      <section aria-label="Similar to your idea" className="mt-6">
        <h2 className="text-lg tracking-tight text-ink">
          Similar to your idea?
        </h2>
        <p className="mt-1 max-w-prose text-body text-ink-2">
          From the taste database: titles related to the ones you typed. Tap
          to add; each is verified at the run.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((title) => {
            const added = parsed.some(
              (t) => t.toLowerCase() === title.trim().toLowerCase(),
            );
            if (added) return null;
            return (
              <li key={title}>
                <button
                  type="button"
                  onClick={() => onAddSuggested(title)}
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
      {inputAbove
        ? "Nothing related this time. Type your own titles above; Check verifies each."
        : "Nothing related this time."}
    </p>
  );
}
