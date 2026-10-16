"use client";

/**
 * The titles leg: type titles your idea sits beside, Check them in
 * Qloo (an explicit action, never as-you-type), then pick from the
 * entity-seeded suggestions. Nothing here calls Qloo on its own — the
 * orb's Check leg does, and every fetched title arrives already
 * verified.
 */

import type { CheckResult } from "@/components/orb/types";
import { parseSimilarTitles } from "@/lib/flow/similar-titles";

export interface LegTitlesProps {
  similarTitles: string;
  onSimilarTitlesChange: (value: string) => void;
  onRemoveSimilar: (title: string) => void;
  onAddSuggested: (title: string) => void;
  onCheck: () => void;
  checkBusy: boolean;
  checkError: string | null;
  checkResult: CheckResult | null;
  titleTagsDone: boolean;
  suggestions: string[];
  suggestBusy: boolean;
  suggestDone: boolean;
}

export function LegTitles({
  similarTitles,
  onSimilarTitlesChange,
  onRemoveSimilar,
  onAddSuggested,
  onCheck,
  checkBusy,
  checkError,
  checkResult,
  titleTagsDone,
  suggestions,
  suggestBusy,
  suggestDone,
}: LegTitlesProps) {
  const parsed = parseSimilarTitles(similarTitles);

  return (
    <section aria-label="Similar-to titles" className="leg-in mx-auto mt-4 max-w-3xl">
      <h2 className="text-lg tracking-tight text-ink">Similar-to titles</h2>
      <p className="mt-1 max-w-prose text-body text-ink-2">
        Put your idea next to a few titles it sits beside. Qloo reads what those
        audiences already like and adds those tastes to your tags, and the tags
        are what the score runs on. One title is enough to start.
      </p>
      <label
        htmlFor="orb-similar"
        className="mt-3 block font-mono text-xs text-ink-3"
      >
        Separate with commas
      </label>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <input
          id="orb-similar"
          value={similarTitles}
          onChange={(e) => onSimilarTitlesChange(e.target.value)}
          placeholder="Moon, Arrival"
          className="min-w-0 flex-1 border-2 border-outline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3"
        />
        <button
          type="button"
          onClick={onCheck}
          disabled={parsed.length === 0 || checkBusy}
          className="btn-secondary shrink-0 px-5 py-2 text-sm"
        >
          {checkBusy ? "Checking & refreshing…" : "Check titles & refresh tags"}
        </button>
      </div>
      {checkResult === null &&
        !checkBusy &&
        parsed.length > 0 &&
        (titleTagsDone || suggestDone) && (
          <p className="mt-3 max-w-prose text-body text-ink-2">
            Titles changed. Check again to refresh the tags and suggestions.
          </p>
        )}
      {parsed.length > 0 && (
        <ul aria-label="Titles to check" className="mt-3 flex flex-wrap gap-2">
          {[...new Set(parsed)].map((title) => (
            <li
              key={title}
              className="flex items-center gap-2 border-2 border-outline bg-paper px-3 py-1 font-mono text-xs text-ink-2"
            >
              <span>{title}</span>
              <button
                type="button"
                onClick={() => onRemoveSimilar(title)}
                aria-label={`Remove ${title}`}
                className="text-ink-3 hover:text-ink"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {checkError !== null && (
        <p role="alert" className="mt-3 text-sm text-ink-2">
          {checkError}
        </p>
      )}
      {checkResult !== null && (
        <div className="mt-3 space-y-2">
          {checkResult.resolved.length > 0 && (
            <ul aria-label="Found in Qloo" className="flex flex-wrap gap-2">
              {checkResult.resolved.map((hit) => (
                <li
                  key={hit.qlooId}
                  className="border-2 border-outline bg-strong px-3 py-1 font-mono text-xs text-ink"
                >
                  ✓ {hit.name}
                </li>
              ))}
            </ul>
          )}
          {checkResult.notFound.length > 0 && (
            <ul aria-label="Not found in Qloo" className="flex flex-wrap gap-2">
              {checkResult.notFound.map((title) => (
                <li
                  key={title}
                  className="border-2 border-outline bg-weak px-3 py-1 font-mono text-xs text-ink"
                >
                  ✕ {title} — not in Qloo
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {suggestBusy ? (
        <p className="mt-6 font-mono text-xs text-ink-3">
          Finding titles like yours…
        </p>
      ) : suggestions.length > 0 ? (
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
      ) : (
        suggestDone && (
          <p className="mt-6 max-w-prose text-body text-ink-2">
            Nothing related this time. Type your own titles above; Check
            verifies each.
          </p>
        )
      )}
    </section>
  );
}
