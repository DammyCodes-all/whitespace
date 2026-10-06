"use client";

/**
 * Similar-to list confirm. Owned by U.
 *
 * Section of `./pitch-form.tsx` (§6.2). Renders the fixture-checked
 * suggestions with found / not-found marks, removal and manual adds.
 */

import type { Suggestion } from "@/components/pitch-form-utils";

export function SimilarToConfirm({
  suggestions,
  draft,
  onDraftChange,
  onAddDraft,
  onRemove,
}: {
  suggestions: Suggestion[];
  draft: string;
  onDraftChange: (value: string) => void;
  onAddDraft: () => void;
  onRemove: (key: string) => void;
}) {
  return (
    <div>
      <h3 className="mt-8 text-lg tracking-tight text-ink">
        Similar to — confirm the list
      </h3>
      <p className="mt-1 font-mono text-xs text-ink-3">
        AI-proposed or fixture titles; every title is checked against Qloo at
        run time.
      </p>
      <ul className="mt-3 border-t border-rule">
        {suggestions.map((s) => (
          <li
            key={s.key}
            className="flex items-baseline justify-between gap-4 border-b border-rule py-2"
          >
            <p className="text-[15px] text-ink">
              {s.name}{" "}
              <span
                className={
                  s.proposed === true
                    ? "font-mono text-xs text-ink-3"
                    : s.found
                      ? "font-mono text-xs text-measured"
                      : "font-mono text-xs text-clay"
                }
              >
                {s.proposed === true
                  ? "proposed · check at run"
                  : s.found
                    ? "found"
                    : "not found in Qloo"}
              </span>
            </p>
            <button
              type="button"
              onClick={() => onRemove(s.key)}
              aria-label={`Remove ${s.name}`}
              className="shrink-0 font-mono text-xs text-ink-3 underline underline-offset-4 hover:text-ink"
            >
              remove
            </button>
          </li>
        ))}
        {suggestions.length === 0 && (
          <li className="border-b border-rule py-2 font-mono text-xs text-ink-3">
            List is empty — add titles below or confirm with none.
          </li>
        )}
      </ul>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Add a similar title"
          aria-label="Add a similar title"
          className="min-w-0 flex-1 border border-rule bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-3"
        />
        <button
          type="button"
          onClick={onAddDraft}
          className="shrink-0 border border-rule px-3 py-1.5 text-sm text-ink"
        >
          Add
        </button>
      </div>
    </div>
  );
}
