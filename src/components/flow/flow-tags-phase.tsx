"use client";

import { FlowRunGate } from "@/components/flow/flow-run-gate";
import { FlowSuggestStep } from "@/components/flow/flow-suggest-step";
import { FlowTagsStep } from "@/components/flow/flow-tags-step";
import { FlowTitlesStep } from "@/components/flow/flow-titles-step";
import type {
  CheckResult,
  FlowResult,
  TitleGift,
} from "@/components/flow/flow-types";

/**
 * Tags phase composition: chips + titles + suggestions + run gate.
 * Keeps the orchestrator small. Heading contract lives in the steps.
 * Spec: §6.1, §6.2, §6.5 (copy unchanged).
 */
export function FlowTagsPhase({
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
  similarTitles,
  parsedSimilar,
  matched,
  checkBusy,
  checkError,
  suggestDone,
  suggestBusy,
  suggestions,
  error,
  onTagsChange,
  onRemoveTitleTag,
  onToggleCutGifts,
  onRestoreGift,
  onSimilarChange,
  onCheck,
  onRemoveSimilar,
  onAddSuggested,
  onRun,
  onEditPitch,
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
  similarTitles: string;
  parsedSimilar: string[];
  matched: number;
  checkBusy: boolean;
  checkError: string | null;
  suggestDone: boolean;
  suggestBusy: boolean;
  suggestions: string[];
  error: string | null;
  onTagsChange: (t: FlowResult["tags"]) => void;
  onRemoveTitleTag: (qlooId: string) => void;
  onToggleCutGifts: () => void;
  onRestoreGift: (gift: TitleGift) => void;
  onSimilarChange: (v: string) => void;
  onCheck: () => void;
  onRemoveSimilar: (title: string) => void;
  onAddSuggested: (title: string) => void;
  onRun: () => void;
  onEditPitch: () => void;
}) {
  return (
    <section aria-labelledby="flow-tags-heading">
      <FlowTagsStep
        tags={tags}
        workType={workType}
        titleTags={titleTags}
        cutGifts={cutGifts}
        showCutGifts={showCutGifts}
        titleTagsBusy={titleTagsBusy}
        titleTagsDone={titleTagsDone}
        checkResult={checkResult}
        previewNote={previewNote}
        busy={busy}
        onTagsChange={onTagsChange}
        onRemoveTitleTag={onRemoveTitleTag}
        onToggleCutGifts={onToggleCutGifts}
        onRestoreGift={onRestoreGift}
      />
      <FlowTitlesStep
        similarTitles={similarTitles}
        parsedSimilar={parsedSimilar}
        checkBusy={checkBusy}
        checkError={checkError}
        checkResult={checkResult}
        titleTagsDone={titleTagsDone}
        suggestDone={suggestDone}
        busy={busy}
        onSimilarChange={onSimilarChange}
        onCheck={onCheck}
        onRemoveSimilar={onRemoveSimilar}
      />
      <FlowSuggestStep
        similarTitles={similarTitles}
        suggestions={suggestions}
        suggestBusy={suggestBusy}
        suggestDone={suggestDone}
        busy={busy}
        onAddSuggested={onAddSuggested}
      />
      <FlowRunGate
        matched={matched}
        titleTagCount={titleTags.length}
        parsedCount={parsedSimilar.length}
        busy={busy}
        error={error}
        onRun={onRun}
        onEditPitch={onEditPitch}
      />
    </section>
  );
}
