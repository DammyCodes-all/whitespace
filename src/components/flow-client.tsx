"use client";

/**
 * Package C: the flow, orchestrated here, rendered in step modules.
 *
 * State lives in useFlowState; markup lives in src/components/flow/*.
 * Heading/ID contracts: flow-input-heading, flow-tags-heading,
 * flow-titles-heading, flow-suggest-heading, flow-run-heading,
 * flow-results-heading, flow-idea-heading.
 *
 * Spec: §6.1, §6.2, §6.5, §6.7, §6.8, §6.11, §6.12 (copy/behavior unchanged).
 */

import { useEffect, useRef } from "react";
import { FlowInputStep } from "@/components/flow/flow-input-step";
import { FlowResultsStep } from "@/components/flow/flow-results-step";
import {
  extractTagsAction,
  runAnalysisAction,
} from "@/components/flow/flow-run-actions";
import { FlowRunningStep } from "@/components/flow/flow-running-step";
import {
  addSuggestedTitle,
  checkSimilarTitlesAction,
  removeSimilarTitle,
  resetTitleDerived,
} from "@/components/flow/flow-tag-actions";
import { FlowTagsPhase } from "@/components/flow/flow-tags-phase";
import { useFlowEffects } from "@/components/flow/use-flow-effects";
import { useFlowState } from "@/components/flow/use-flow-state";

export function FlowClient({
  initialPitch = "",
  autoStart = false,
}: {
  initialPitch?: string;
  autoStart?: boolean;
}) {
  const s = useFlowState(initialPitch);
  const phaseRef = useRef(s.phase);
  const titleSetters = {
    setCheckResult: s.setCheckResult,
    setTitleTags: s.setTitleTags,
    setCutGifts: s.setCutGifts,
    setShowCutGifts: s.setShowCutGifts,
    setPreviewNote: s.setPreviewNote,
    setTitleTagsDone: s.setTitleTagsDone,
    setSimilarTitles: s.setSimilarTitles,
  };

  useFlowEffects({ autoStart, initialPitch, s });

  // Move focus with the phase, not just the pixels. The result view owns
  // its own focus target (the visible verdict heading); the earlier
  // phases focus their h1 so a screen reader hears the new step.
  useEffect(() => {
    if (phaseRef.current === s.phase) return;
    phaseRef.current = s.phase;
    if (s.phase === "done") return;
    const id =
      s.phase === "input"
        ? "flow-input-heading"
        : s.phase === "tags"
          ? "flow-tags-heading"
          : "flow-run-heading";
    document.getElementById(id)?.focus({ preventScroll: true });
  }, [s.phase]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-8">
      {s.phase === "input" && (
        <FlowInputStep
          pitchText={s.pitchText}
          similarTitles={s.similarTitles}
          busy={s.busy}
          error={s.error}
          onPitchChange={s.setPitchText}
          onSimilarChange={s.setSimilarTitles}
          onExtract={() =>
            void extractTagsAction(s.pitchText, s.workType, {
              setBusy: s.setBusy,
              setError: s.setError,
              setTags: s.setTags,
              setWorkType: s.setWorkType,
              setPhase: s.setPhase,
            })
          }
        />
      )}

      {s.phase === "tags" && (
        <FlowTagsPhase
          tags={s.tags}
          workType={s.workType}
          titleTags={s.titleTags}
          cutGifts={s.cutGifts}
          showCutGifts={s.showCutGifts}
          titleTagsBusy={s.titleTagsBusy}
          titleTagsDone={s.titleTagsDone}
          checkResult={s.checkResult}
          previewNote={s.previewNote}
          busy={s.busy}
          similarTitles={s.similarTitles}
          parsedSimilar={s.parsedSimilar}
          matched={s.matched}
          checkBusy={s.checkBusy}
          checkError={s.checkError}
          suggestDone={s.suggestDone}
          suggestBusy={s.suggestBusy}
          suggestions={s.qlooSuggestions}
          error={s.error}
          onTagsChange={s.setTags}
          onRemoveTitleTag={(qlooId) =>
            s.setTitleTags((prev) => prev.filter((t) => t.qlooId !== qlooId))
          }
          onToggleCutGifts={() => s.setShowCutGifts((v) => !v)}
          onRestoreGift={(gift) => {
            s.setTitleTags((prev) =>
              prev.some((t) => t.qlooId === gift.qlooId)
                ? prev
                : [...prev, gift],
            );
            s.setCutGifts((prev) =>
              prev.filter((t) => t.qlooId !== gift.qlooId),
            );
          }}
          onSimilarChange={(v) => {
            s.setSimilarTitles(v);
            resetTitleDerived(titleSetters);
          }}
          onCheck={() =>
            void checkSimilarTitlesAction(
              {
                similarTitles: s.similarTitles,
                workType: s.workType,
                pitchText: s.pitchText,
                checkBusy: s.checkBusy,
              },
              {
                ...titleSetters,
                setCheckBusy: s.setCheckBusy,
                setCheckError: s.setCheckError,
                setQlooSuggestions: s.setQlooSuggestions,
                setSuggestBusy: s.setSuggestBusy,
                setSuggestDone: s.setSuggestDone,
                setTitleTagsBusy: s.setTitleTagsBusy,
              },
            )
          }
          onRemoveSimilar={(title) =>
            removeSimilarTitle(title, s.similarTitles, titleSetters)
          }
          onAddSuggested={(title) =>
            addSuggestedTitle(title, s.similarTitles, titleSetters)
          }
          onRun={() =>
            void runAnalysisAction(
              {
                pitchText: s.pitchText,
                workType: s.workType,
                tags: s.tags,
                similarTitles: s.similarTitles,
                titleTags: s.titleTags,
              },
              {
                setBusy: s.setBusy,
                setError: s.setError,
                setSteps: s.setSteps,
                setPhase: s.setPhase,
                setResult: s.setResult,
                setChatbot: s.setChatbot,
                setChatbotError: s.setChatbotError,
                setCompareCalls: s.setCompareCalls,
                setCompareLoaded: s.setCompareLoaded,
              },
            )
          }
          onEditPitch={() => s.setPhase("input")}
        />
      )}

      {s.phase === "running" && <FlowRunningStep steps={s.steps} />}

      {s.phase === "done" && s.result !== null && (
        <FlowResultsStep
          result={s.result}
          similarList={s.parsedSimilar}
          steps={s.steps}
          chatbot={s.chatbot}
          chatbotError={s.chatbotError}
          compareLoaded={s.compareLoaded}
          compareCalls={s.compareCalls}
        />
      )}
    </div>
  );
}
