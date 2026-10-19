"use client";

import type { CheckResult, TitleGift } from "@/components/flow/flow-types";
import { TagChips } from "@/components/tag-chips";
import LoadingState from "@/components/ui/loading-state";
import type { FlowResult } from "@/lib/flow/contract";

/**
 * Tags phase: chips + title-gift preview + cut gifts.
 * Heading contract: h1#flow-tags-heading (sr-only) labels the phase;
 * TagChips keeps its own h2. Spec: §6.5 (copy unchanged).
 */
export function FlowTagsStep({
  tags,
  workType,
  titleTags,
  cutGifts,
  showCutGifts,
  titleTagsBusy,
  titleTagsDone,
  checkResult,
  previewNote,
  busy,
  onTagsChange,
  onRemoveTitleTag,
  onToggleCutGifts,
  onRestoreGift,
}: {
  tags: FlowResult["tags"];
  workType: string;
  titleTags: TitleGift[];
  cutGifts: TitleGift[];
  showCutGifts: boolean;
  titleTagsBusy: boolean;
  titleTagsDone: boolean;
  checkResult: CheckResult | null;
  previewNote: string | null;
  busy: boolean;
  onTagsChange: (t: FlowResult["tags"]) => void;
  onRemoveTitleTag: (qlooId: string) => void;
  onToggleCutGifts: () => void;
  onRestoreGift: (gift: TitleGift) => void;
}) {
  return (
    <>
      <h1 id="flow-tags-heading" className="sr-only">
        Confirm tags and titles
      </h1>
      <p className="font-mono text-xs text-ink-3">Read as {workType}</p>
      <TagChips
        tags={tags}
        onChange={onTagsChange}
        loading={busy}
        extraMatched={titleTags.length}
        extraChips={titleTags.map((t) => ({
          key: t.qlooId,
          label: t.label,
          badge: t.sourceTitleName ?? "title",
          onRemove: () => onRemoveTitleTag(t.qlooId),
        }))}
      />
      {titleTagsBusy && (
        <output aria-live="polite" className="mt-4 block">
          <LoadingState label="Reading the titles' tags" variant="Dots" />
        </output>
      )}
      {!titleTagsBusy &&
        titleTagsDone &&
        checkResult !== null &&
        checkResult.resolved.length > 0 &&
        titleTags.length === 0 &&
        cutGifts.length === 0 && (
          <p className="mt-4 max-w-prose text-body text-ink-2">
            {previewNote === "no-tastes" &&
              "Qloo holds no taste data for these titles — only pitch words will score."}
            {previewNote === "all-generic" &&
              "These titles' top tastes were all generic (half the controls hold them) — only your sharper pitch words will score."}
            {previewNote === "rate-limited" &&
              "Qloo is rate-limiting requests right now — only your pitch words will score. Try again in a moment."}
            {previewNote === "exhausted" &&
              "This preview used its Qloo call budget — only your pitch words will score. Try again or use the sample."}
            {previewNote === "preview-failed" &&
              "Couldn't read the titles' tastes — only pitch words will score. Check again to retry."}
            {(previewNote === null ||
              previewNote === "ok" ||
              previewNote === "unresolved") &&
              "The checked titles added no tags — only pitch words will score. The run still needs at least 1 similar title."}
          </p>
        )}
      {!titleTagsBusy && titleTagsDone && cutGifts.length > 0 && (
        <div className="mt-4">
          <p className="max-w-prose text-body text-ink-2">
            {cutGifts.length} gift{cutGifts.length === 1 ? "" : "s"} cut as
            unfitting your pitch — restore any that should score.
          </p>
          <button
            type="button"
            onClick={onToggleCutGifts}
            className="btn-secondary mt-2 px-4 py-2 text-sm"
          >
            {showCutGifts ? "Hide cut gifts" : "Show cut gifts"}
          </button>
          {showCutGifts && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {cutGifts.map((gift) => (
                <li key={gift.qlooId}>
                  <button
                    type="button"
                    onClick={() => onRestoreGift(gift)}
                    disabled={busy}
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
    </>
  );
}
