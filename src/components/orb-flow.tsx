"use client";

/**
 * The run. One blank stage from pitch to verdict: a flat orb pulses
 * while each leg works and stills when its receipt lands, with one
 * honest line beneath it — tags, similar titles, the aggregated set,
 * then the scored run. Entry lives on the landing page; ?pitch=
 * autostarts the first leg on mount. Backend calls are the same routes
 * the stepped flow uses; only the presentation changed.
 *
 * This file is the host: the run's state and leg work live in
 * `use-orb-run`, the handoff in `use-orb-flight`, and the leg UI in
 * `components/orb/*`. The orb owns the page centre on working legs
 * and moves up only when input UI appears below it (see
 * `use-stage-glide`).
 *
 * Spec ref: §5 (the run reports itself as it goes).
 */

import { useEffect, useRef } from "react";
import { ScoreCta, TagsCtas, TitlesCta } from "@/components/orb/leg-ctas";
import { LegResults } from "@/components/orb/leg-results";
import { LegTags } from "@/components/orb/leg-tags";
import { LegTitles } from "@/components/orb/leg-titles";
import { OrbFlightClone } from "@/components/orb/orb-flight-clone";
import { useOrbFlight } from "@/components/orb/use-orb-flight";
import { useOrbRun } from "@/components/orb/use-orb-run";
import { returnWaitMs, useStageGlide } from "@/components/orb/use-stage-glide";
import MorphOrb, {
  type OrbHandle,
} from "@/components/ui/ai-thinking-orb-and-input";

export function OrbFlow({
  homeHref = "/",
  speed = 1,
}: {
  homeHref?: string;
  /** Orb pace multiplier (1 = live). Demo passes < 1 to slow the
   *  morph→think→resolve beats for review; the real run stays at 1. */
  speed?: number;
}) {
  const orbRef = useRef<OrbHandle | null>(null);
  const run = useOrbRun({ orbRef, homeHref });
  const flight = useOrbFlight({ orbRef, arm: run.armEntry });

  const poolVisible = run.leg === "tags" || run.leg === "aggregate";
  /** Titles input lives on the titles leg only; aggregate keeps the
   *  pool, the suggestions and the score action — never the input. */
  /** Working legs show the orb alone; input legs show UI below it —
   *  held back until the orb settles (see use-stage-glide). Between
   *  legs the old UI is gone and the orb returns to centre first. */
  const centered = run.leg === "entry" || run.returning;
  const uiReady = useStageGlide(flight.stageRef, centered);
  /** Leg UI shows only once the orb has settled on its leg — never
   *  during the between-leg return to centre. */
  const uiVisible = uiReady && !run.returning;

  // Settle the parked leg advance once the orb has rested at centre:
  // the wait is glide + hold (nothing under reduced motion).
  // biome-ignore lint/correctness/useExhaustiveDependencies: settle on the returning edge
  useEffect(() => {
    if (!run.returning) return;
    const t = window.setTimeout(() => run.settleAdvance(), returnWaitMs());
    return () => window.clearTimeout(t);
  }, [run.returning]);

  return (
    <div
      className={`mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 pt-6 sm:px-8 ${centered ? "" : "pb-12"}`}
    >
      <div
        ref={flight.stageRef}
        className={`flex flex-col justify-center ${centered ? "flex-1" : "min-h-[240px]"}`}
      >
        <div>
          <MorphOrb
            orbRef={orbRef}
            onPhaseChange={run.handlePhase}
            onSubmit={run.entrySubmit}
            minThinkMs={1500}
            speed={speed}
            workingLabel={run.workLabel ?? undefined}
          />
        </div>
      </div>
      {flight.flight !== null && (
        <OrbFlightClone
          flight={flight.flight}
          cloneInnerRef={flight.cloneInnerRef}
          cloneTextRef={flight.cloneTextRef}
        />
      )}

      {/* Errors only — the work line lives under the orb, and leg
          instructions live with the leg's own UI below. */}
      {(run.error !== null || run.interrupted) && (
        <output
          aria-live="polite"
          className="mx-auto mt-2 block max-w-prose text-center text-sm leading-relaxed text-ink-2"
        >
          {run.error ?? run.status}
        </output>
      )}
      {run.error !== null && (
        <p role="alert" className="mt-2 text-center text-sm text-ink-2">
          {run.error}
        </p>
      )}
      {(run.error !== null || run.interrupted) && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={run.retry}
            className="btn-secondary px-5 py-2 text-sm"
          >
            Retry this step
          </button>
        </div>
      )}

      {poolVisible && uiVisible && (
        <LegTags
          tags={run.tags}
          onTagsChange={run.setTags}
          titleTags={run.titleTags}
          onRemoveTitleTag={run.onRemoveTitleTag}
          titleTagsBusy={run.titleTagsBusy}
          titleTagsDone={run.titleTagsDone}
          checkedCount={run.checkedCount}
          previewNote={run.previewNote}
          cutGifts={run.cutGifts}
          showCutGifts={run.showCutGifts}
          onToggleCutGifts={run.onToggleCutGifts}
          onRestoreGift={run.onRestoreGift}
        />
      )}

      {run.leg === "tags" && uiVisible && (
        <TagsCtas
          onContinue={run.onContinueToTitles}
          onEditPitch={run.onEditPitch}
        />
      )}

      {run.leg === "titles" && uiVisible && (
        <LegTitles
          similarTitles={run.similarTitles}
          onSimilarTitlesChange={run.onSimilarTitlesChange}
          onRemoveSimilar={run.onRemoveSimilar}
          onAddSuggested={run.onAddSuggested}
          onCheck={run.onCheck}
          checkBusy={run.checkBusy}
          checkError={run.checkError}
          checkResult={run.checkResult}
          titleTagsDone={run.titleTagsDone}
          suggestions={run.suggestions}
          suggestBusy={run.suggestBusy}
          suggestDone={run.suggestDone}
        />
      )}

      {run.leg === "titles" && uiVisible && (
        <TitlesCta
          checked={run.checkResult !== null}
          named={run.similar.length > 0}
          onReview={run.onReviewFullSet}
        />
      )}

      {run.leg === "aggregate" && uiVisible && (
        <ScoreCta
          canRun={run.canContinue}
          similarCount={run.similar.length}
          onRun={run.onRun}
        />
      )}

      {run.leg === "done" && run.result !== null && uiVisible && (
        <LegResults
          result={run.result}
          similarTitles={run.similarTitles}
          steps={run.steps}
          chatbot={run.chatbot}
          chatbotError={run.chatbotError}
          compareLoaded={run.compareLoaded}
          compareCalls={run.compareCalls}
          changed={run.changed}
          changeBusy={run.changeBusy}
          changeError={run.changeError}
          constraint={run.constraint}
          onConstraintChange={run.setConstraint}
          onCheckChange={run.checkChange}
        />
      )}
    </div>
  );
}
