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
import { FieldRow } from "@/components/orb/field-row";
import { MIN_MATCHED_TAGS } from "@/lib/config";
import type { FlowTag } from "@/lib/flow/contract";

export interface TagChipsProps {
  tags: FlowTag[];
  onChange: (tags: FlowTag[]) => void;
  loading?: boolean;
  /**
   * Title-gift chips sharing the same row: confirmed Qloo tastes from
   * the named titles, each badged with its title. Removal unpicks the
   * gift (it leaves `pickedTagIds` on the run).
   */
  extraChips?: ExtraChip[];
  /** Confirmed title gifts, counted beside pitch matches for the gate. */
  extraMatched?: number;
}

export interface ExtraChip {
  key: string;
  label: string;
  /** Source badge: the title name behind this gift. */
  badge: string;
  onRemove: () => void;
}

export function TagChips({
  tags,
  onChange,
  loading = false,
  extraChips = [],
  extraMatched = 0,
}: TagChipsProps) {
  const [draft, setDraft] = useState("");
  const pitchMatched = tags.filter((t) => t.status === "matched").length;
  const notFound = tags.length - pitchMatched;
  const matched = pitchMatched + extraMatched;
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
          {matched} found
          {notFound > 0 && (
            <span className="text-clay"> · {notFound} not found</span>
          )}
        </p>
      </div>
      <p className="mt-1 max-w-prose text-body text-ink-2">
        Review your tags below: green ones count, hatched ones don&apos;t, so
        fix the wording or take them off.
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
              {tag.qlooName !== undefined && (
                <span className="text-ink-2">
                  <span aria-hidden="true"> → </span>
                  <span className="sr-only">, matched in Qloo as </span>
                  {tag.qlooName}
                </span>
              )}
              <span className="font-mono text-[10px] text-ink">[pitch]</span>
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
        {extraChips.map((chip) => (
          <li
            key={chip.key}
            className="inline-flex items-center gap-1.5 border-2 border-outline bg-split px-3 py-1.5 text-sm text-ink"
          >
            <span>{chip.label}</span>
            <span className="font-mono text-[10px] text-ink-2">
              [{chip.badge}]
            </span>
            <button
              type="button"
              onClick={chip.onRemove}
              aria-label={`Remove ${chip.label}`}
              className="ml-1 font-mono text-xs text-ink-2 underline underline-offset-2 hover:text-ink"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <FieldRow
          value={draft}
          onChange={setDraft}
          placeholder="Add a word describing your pitch"
          ariaLabel="Add a tag"
          inputDisabled={loading}
          onEnter={addDraft}
          actionLabel="Add word"
          onAction={addDraft}
          actionDisabled={loading || draft.trim() === ""}
        />
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
          ? `${matched} found tags carry the score.`
          : `Under ${MIN_MATCHED_TAGS} found tags, the run comes back Inconclusive. Add sharper words.`}
      </p>
    </section>
  );
}
