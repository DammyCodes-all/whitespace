"use client";

/**
 * The tags under review — shown on the tags leg (confirm) and the
 * aggregate leg (review before scoring), never on titles: that leg is
 * the titles section alone. Pitch tags and title gifts share one row;
 * a Check's gift verdict, its preview note and any cut gifts render
 * beneath.
 */

import type { TitleGift } from "@/components/orb/types";
import { TagChips } from "@/components/tag-chips";
import type { FlowTag } from "@/lib/flow/contract";

export interface LegTagsProps {
  tags: FlowTag[];
  onTagsChange: (tags: FlowTag[]) => void;
  titleTags: TitleGift[];
  onRemoveTitleTag: (qlooId: string) => void;
  titleTagsBusy: boolean;
  titleTagsDone: boolean;
  /** Titles the last explicit Check resolved; null before the first. */
  checkedCount: number | null;
  previewNote: string | null;
  cutGifts: TitleGift[];
  showCutGifts: boolean;
  onToggleCutGifts: () => void;
  onRestoreGift: (gift: TitleGift) => void;
}

export function LegTags({
  tags,
  onTagsChange,
  titleTags,
  onRemoveTitleTag,
  titleTagsBusy,
  titleTagsDone,
  checkedCount,
  previewNote,
  cutGifts,
  showCutGifts,
  onToggleCutGifts,
  onRestoreGift,
}: LegTagsProps) {
  return (
    <section
      aria-label="Tags under review"
      className="leg-in mx-auto mt-4 max-w-3xl"
    >
      <TagChips
        tags={tags}
        onChange={onTagsChange}
        loading={false}
        extraMatched={titleTags.length}
        extraChips={titleTags.map((t) => ({
          key: t.qlooId,
          label: t.label,
          badge: t.sourceTitleName ?? "title",
          onRemove: () => onRemoveTitleTag(t.qlooId),
        }))}
      />
      {titleTagsBusy && (
        <p className="mt-3 font-mono text-xs text-ink-3">
          Reading the titles' tags…
        </p>
      )}
      {!titleTagsBusy &&
        titleTagsDone &&
        checkedCount !== null &&
        checkedCount > 0 &&
        titleTags.length === 0 &&
        cutGifts.length === 0 && (
          <p className="mt-4 max-w-prose text-body text-ink-2">
            {previewNote === "no-tastes" &&
              "Qloo has no taste data for these titles. Only your pitch words will score."}
            {previewNote === "all-generic" &&
              "These titles' top tastes were all generic (half the controls hold them too). Only your sharper pitch words will score."}
            {previewNote === "rate-limited" &&
              "Qloo is rate-limiting requests right now. Only your pitch words will score. Try again in a moment."}
            {previewNote === "exhausted" &&
              "This preview used its Qloo call budget. Only your pitch words will score. Try again or use the sample."}
            {previewNote === "preview-failed" &&
              "Couldn't read the titles' tastes. Only pitch words will score. Check again to retry."}
            {(previewNote === null ||
              previewNote === "ok" ||
              previewNote === "unresolved") &&
              "The checked titles added no tags. Only pitch words will score; the run still needs one similar title."}
          </p>
        )}
      {!titleTagsBusy && titleTagsDone && cutGifts.length > 0 && (
        <div className="mt-4">
          <p className="max-w-prose text-body text-ink-2">
            We cut{" "}
            {cutGifts.length === 1 ? "one tag" : `${cutGifts.length} tags`} that
            didn&apos;t seem to fit your pitch. Put back any that should count.
          </p>
          <button
            type="button"
            onClick={onToggleCutGifts}
            className="btn-secondary mt-2 px-4 py-2 text-sm"
          >
            {showCutGifts ? "Hide cut tags" : "Show cut tags"}
          </button>
          {showCutGifts && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {cutGifts.map((gift) => (
                <li key={gift.qlooId}>
                  <button
                    type="button"
                    onClick={() => onRestoreGift(gift)}
                    className="btn-secondary px-4 py-2 text-sm"
                  >
                    + {gift.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
