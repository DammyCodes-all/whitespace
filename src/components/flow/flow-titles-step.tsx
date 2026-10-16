"use client";

import { useId } from "react";
import LoadingState from "@/components/ui/loading-state";
import { MIN_MATCHED_TAGS } from "@/lib/config";
import type { CheckResult } from "@/components/flow/flow-types";

/**
 * Similar-to titles + suggestions + run gate.
 * Heading contracts: h2#flow-titles-heading, h2#flow-suggest-heading.
 * Spec: §6.1, §6.2 (copy unchanged).
 */
export function FlowTitlesStep({
  similarTitles,
  parsedSimilar,
  matched,
  titleTagCount,
  checkBusy,
  checkError,
  checkResult,
  titleTagsDone,
  suggestDone,
  suggestBusy,
  suggestions,
  busy,
  error,
  onSimilarChange,
  onCheck,
  onRemoveSimilar,
  onAddSuggested,
  onRun,
  onEditPitch,
}: {
  similarTitles: string;
  parsedSimilar: string[];
  matched: number;
  titleTagCount: number;
  checkBusy: boolean;
  checkError: string | null;
  checkResult: CheckResult | null;
  titleTagsDone: boolean;
  suggestDone: boolean;
  suggestBusy: boolean;
  suggestions: string[];
  busy: boolean;
  error: string | null;
  onSimilarChange: (v: string) => void;
  onCheck: () => void;
  onRemoveSimilar: (title: string) => void;
  onAddSuggested: (title: string) => void;
  onRun: () => void;
  onEditPitch: () => void;
}) {
  const inputId = useId();
  const staleHintId = useId();
  return (
    <>
      <section aria-labelledby="flow-titles-heading" className="mt-6">
        <h2 id="flow-titles-heading" className="text-lg tracking-tight text-ink">
          Similar-to titles
        </h2>
        <p className="mt-1 max-w-prose text-body text-ink-2">
          What the run will resolve against Qloo. Name at least 1 — its
          tastes ground the tags. Check now for an early look — the run
          re-checks everything, so this never decides anything.
        </p>
        <label
          htmlFor={inputId}
          className="mt-3 block font-mono text-xs text-ink-3"
        >
          Comma separated
        </label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            id={inputId}
            value={similarTitles}
            onChange={(e) => onSimilarChange(e.target.value)}
            placeholder="Moon, Arrival"
            aria-describedby={
              checkResult === null &&
              !checkBusy &&
              parsedSimilar.length > 0 &&
              (titleTagsDone || suggestDone)
                ? staleHintId
                : undefined
            }
            className="min-w-0 flex-1 border-2 border-outline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3"
          />
          <button
            type="button"
            onClick={onCheck}
            disabled={parsedSimilar.length === 0 || checkBusy}
            className="btn-secondary shrink-0 px-5 py-2 text-sm"
          >
            {checkBusy
              ? "Checking & refreshing…"
              : "Check titles & refresh tags"}
          </button>
        </div>
        {checkResult === null &&
          !checkBusy &&
          parsedSimilar.length > 0 &&
          (titleTagsDone || suggestDone) && (
            <p
              id={staleHintId}
              className="mt-3 max-w-prose text-body text-ink-2"
            >
              Titles changed — check again to refresh tags and suggestions.
            </p>
          )}
        {parsedSimilar.length > 0 && (
          <ul
            aria-label="Titles to check"
            className="mt-3 flex flex-wrap gap-2"
          >
            {[...new Set(parsedSimilar)].map((title) => (
              <li
                key={title}
                className="flex items-center gap-2 border-2 border-outline bg-paper px-3 py-1 font-mono text-xs text-ink-2"
              >
                <span>{title}</span>
                <button
                  type="button"
                  onClick={() => onRemoveSimilar(title)}
                  disabled={busy}
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
              <ul
                aria-label="Found in Qloo"
                className="flex flex-wrap gap-2"
              >
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
              <ul
                aria-label="Not found in Qloo"
                className="flex flex-wrap gap-2"
              >
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
      </section>
      {suggestBusy ? (
        <output aria-live="polite" className="mt-6 block">
          <LoadingState label="Finding titles like yours" variant="Dots" />
        </output>
      ) : suggestions.length > 0 ? (
        <section aria-labelledby="flow-suggest-heading" className="mt-6">
          <h2 id="flow-suggest-heading" className="text-lg tracking-tight text-ink">
            Similar to your idea?
          </h2>
          <p className="mt-1 max-w-prose text-body text-ink-2">
            From the taste database — titles related to the ones you typed.
            Tap to add; each is verified at the run.
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
      ) : (
        suggestDone && (
          <p className="mt-6 max-w-prose text-body text-ink-2">
            No suggestions this time — the database had nothing related to
            your titles. Type your own above; Check verifies each.
          </p>
        )
      )}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        {busy ? (
          <output aria-live="polite" className="block py-1">
            <LoadingState label="Running pitch" variant="Dots" />
          </output>
        ) : (
          <button
            type="button"
            onClick={onRun}
            disabled={
              matched + titleTagCount < MIN_MATCHED_TAGS ||
              parsedSimilar.length < 1
            }
            className="btn-primary px-6 py-3 text-sm"
          >
            Run the analysis
          </button>
        )}
        <button
          type="button"
          onClick={onEditPitch}
          className="btn-secondary px-5 py-3 text-sm"
        >
          Edit the pitch
        </button>
      </div>
      {parsedSimilar.length < 1 && (
        <output className="mt-3 block font-mono text-xs text-clay">
          Add at least 1 similar title — the run grounds its tags in it, and
          the pool gate still applies.
        </output>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-ink-2">
          {error}
        </p>
      )}
    </>
  );
}
