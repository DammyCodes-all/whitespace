"use client";

import { useId } from "react";
import type { CheckResult } from "@/components/flow/flow-types";

/**
 * Similar-to titles check block.
 * Heading contract: h2#flow-titles-heading.
 * Spec: §6.1, §6.2 (copy unchanged).
 */
export function FlowTitlesStep({
  similarTitles,
  parsedSimilar,
  checkBusy,
  checkError,
  checkResult,
  titleTagsDone,
  suggestDone,
  busy,
  onSimilarChange,
  onCheck,
  onRemoveSimilar,
}: {
  similarTitles: string;
  parsedSimilar: string[];
  checkBusy: boolean;
  checkError: string | null;
  checkResult: CheckResult | null;
  titleTagsDone: boolean;
  suggestDone: boolean;
  busy: boolean;
  onSimilarChange: (v: string) => void;
  onCheck: () => void;
  onRemoveSimilar: (title: string) => void;
}) {
  const inputId = useId();
  const staleHintId = useId();
  const showStale =
    checkResult === null &&
    !checkBusy &&
    parsedSimilar.length > 0 &&
    (titleTagsDone || suggestDone);
  return (
    <section aria-labelledby="flow-titles-heading" className="mt-6">
      <h2 id="flow-titles-heading" className="text-lg tracking-tight text-ink">
        Similar-to titles
      </h2>
      <p className="mt-1 max-w-prose text-body text-ink-2">
        What the run will resolve against Qloo. Name at least 1 — its tastes
        ground the tags. Check now for an early look — the run re-checks
        everything, so this never decides anything.
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
          aria-describedby={showStale ? staleHintId : undefined}
          className="min-w-0 flex-1 border-2 border-outline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3"
        />
        <button
          type="button"
          onClick={onCheck}
          disabled={parsedSimilar.length === 0 || checkBusy}
          className="btn-secondary shrink-0 px-5 py-2 text-sm"
        >
          {checkBusy ? "Checking & refreshing…" : "Check titles & refresh tags"}
        </button>
      </div>
      {showStale && (
        <p id={staleHintId} className="mt-3 max-w-prose text-body text-ink-2">
          Titles changed — check again to refresh tags and suggestions.
        </p>
      )}
      {parsedSimilar.length > 0 && (
        <ul aria-label="Titles to check" className="mt-3 flex flex-wrap gap-2">
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
    </section>
  );
}
