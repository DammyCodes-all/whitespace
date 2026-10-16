"use client";

/**
 * The titles leg: type titles your idea sits beside, Check them in
 * Qloo (an explicit action, never as-you-type), then pick from the
 * entity-seeded suggestions. Nothing here calls Qloo on its own — the
 * orb's Check leg does, and every fetched title arrives already
 * verified.
 */

import { FieldRow } from "@/components/orb/field-row";
import { TitleSuggestions } from "@/components/orb/leg-suggestions";
import type { CheckResult } from "@/components/orb/types";
import { parseSimilarTitles, titleVerdictKey } from "@/lib/flow/similar-titles";

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
      <div className="mt-1">
        <FieldRow
          id="orb-similar"
          value={similarTitles}
          onChange={onSimilarTitlesChange}
          placeholder="Moon, Arrival"
          ariaLabel="Similar titles, separated with commas"
          actionLabel={
            checkBusy ? "Checking & refreshing…" : "Check titles & refresh tags"
          }
          onAction={onCheck}
          actionDisabled={parsed.length === 0 || checkBusy}
        />
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
        <ul aria-label="Your titles" className="mt-3 flex flex-wrap gap-2">
          {[...new Set(parsed)].map((title) => {
            const key = titleVerdictKey(title);
            const hit =
              checkResult?.resolved.find(
                (r) =>
                  typeof r.query === "string" &&
                  titleVerdictKey(r.query) === key,
              ) ?? null;
            const missing =
              checkResult?.notFound.some((n) => titleVerdictKey(n) === key) ??
              false;
            return (
              <li
                key={title}
                className={
                  hit !== null
                    ? "flex items-center gap-2 border-2 border-outline bg-strong px-3 py-1 font-mono text-xs text-ink"
                    : missing
                      ? "flex items-center gap-2 border-2 border-outline bg-weak px-3 py-1 font-mono text-xs text-ink"
                      : "flex items-center gap-2 border-2 border-outline bg-paper px-3 py-1 font-mono text-xs text-ink-2"
                }
              >
                {hit !== null ? (
                  <span title="Verified in Qloo">{title}</span>
                ) : missing ? (
                  <span>{title} — not in Qloo</span>
                ) : (
                  <span>{title}</span>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveSimilar(title)}
                  aria-label={`Remove ${title}`}
                  className="text-ink-3 hover:text-ink"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {checkError !== null && (
        <p role="alert" className="mt-3 text-sm text-ink-2">
          {checkError}
        </p>
      )}
      <TitleSuggestions
        similarTitles={similarTitles}
        onAddSuggested={onAddSuggested}
        suggestions={suggestions}
        suggestBusy={suggestBusy}
        suggestDone={suggestDone}
        inputAbove
      />
    </section>
  );
}
