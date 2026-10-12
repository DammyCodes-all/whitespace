"use client";

/**
 * Package C step 2: editable tag chips with live match status. Owned by U.
 *
 * Matched chips are solid and editable; unmatched chips wear the
 * not-found treatment (clay text, dashed outline) and can never be
 * scored. Removing, adding and editing all live here; the run button
 * stays disabled below the matched gate.
 *
 * design-direction.md §1 (absence stays visible), §3 (clay is
 * "not found in Qloo" only).
 */

import { useState } from "react";
import { MIN_MATCHED_TAGS } from "@/lib/config";
import type { FlowTag } from "@/lib/flow/contract";

export interface TagChipsProps {
  tags: FlowTag[];
  onChange: (tags: FlowTag[]) => void;
  loading?: boolean;
}

export function TagChips({ tags, onChange, loading = false }: TagChipsProps) {
  const [draft, setDraft] = useState("");
  const matched = tags.filter((t) => t.status === "matched").length;
  const canRun = matched >= MIN_MATCHED_TAGS;

  function remove(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  function addDraft() {
    const label = draft.trim().toLowerCase().replace(/\s+/g, " ");
    if (label === "") return;
    onChange([...tags, { label, status: "not_found" }]);
    setDraft("");
  }

  return (
    <section aria-label="Pitch tags" className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg tracking-tight text-ink">Confirm the tags</h2>
        <p data-numeric className="tnum font-mono text-sm text-ink-2">
          {matched} matched
          {tags.length - matched > 0 && (
            <span className="text-clay">
              {" "}
              · {tags.length - matched} not found
            </span>
          )}
        </p>
      </div>
      <p className="mt-1 max-w-prose text-body text-ink-2">
        Matched tags are real Qloo tags and they carry the score. Not-found
        words never score — remove them or edit them, then run.
      </p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {tags.map((tag, index) => {
          const isMatched = tag.status === "matched";
          return (
            <li
              key={`${tag.label}-${index}`}
              className={
                isMatched
                  ? "inline-flex items-center gap-1.5 border-2 border-outline bg-strong px-3 py-1.5 text-sm text-ink"
                  : "nodata inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-clay"
              }
            >
              <span>{tag.label}</span>
              {isMatched ? null : (
                <span className="font-mono text-xs">not found in Qloo</span>
              )}
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove ${tag.label}`}
                className="ml-1 font-mono text-xs text-ink-2 underline underline-offset-2 hover:text-ink"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder="Add a word from your pitch"
          aria-label="Add a tag"
          disabled={loading}
          className="min-w-0 flex-1 border border-rule bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-3"
        />
        <button
          type="button"
          onClick={addDraft}
          disabled={loading || draft.trim() === ""}
          className="btn-secondary px-5 py-2.5 text-sm"
        >
          Add word
        </button>
      </div>
      <p
        role={canRun ? undefined : "status"}
        className={
          canRun
            ? "mt-3 font-mono text-xs text-ink-3"
            : "mt-3 font-mono text-xs text-clay"
        }
      >
        {canRun
          ? `${matched} matched tags score the run.`
          : `Below the ${MIN_MATCHED_TAGS}-tag gate: the run would be Inconclusive and would not score.`}
      </p>
    </section>
  );
}
