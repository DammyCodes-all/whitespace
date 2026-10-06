/**
 * Day 6 S: pipeline seam. Owned by S.
 *
 * Wires the frozen pieces end to end: Day 6 Q seam (`@/lib/qloo/index`)
 * to scoring (`scoreAll`, exclusion subtract) to verdict, plus the §8
 * grounding check. Q owns the fetches, S owns the order and the honesty
 * gates. The AI's proposals (similar titles, candidate words, rival
 * readings) arrive via `PipelineInput`: U passes the confirmed form
 * data, and `demoPipelineInput` covers the mock pitch until the agent
 * proposes them live.
 *
 * Fixtures first: without a key every Q call takes the mock path, so
 * tastes fail, coverage is 0, and the verdict is honestly Inconclusive
 * (§6.7) with grounding still ok. A live key upgrades every phase with
 * no code change. One miss never throws (§8): all Q wrappers degrade to
 * not-found/failed, and the pipeline always resolves.
 *
 * Spec ref: §5.4 (steps), §6.2/§6.3/§6.4 (audiences), §6.5 (coverage),
 * §6.6 (tastes, exclusion, scoring), §6.7 (verdict), §7 (our code
 * ranks), §8 (grounding), §6.12 (every call traced), §10 #7
 * (deterministic: same input, same verdict).
 */

import { checkGrounding } from "@/lib/policy/grounding";
import { decideVerdict } from "@/lib/policy/verdict";
import type { RivalProposal } from "@/lib/qloo/index";
import {
  buildControls,
  buildRivals,
  CONTROL_COUNT,
  fetchAllAudienceTastes,
  resolvePitchTags,
  resolveTitles,
} from "@/lib/qloo/index";
import { subtractExclusionFromAll } from "@/lib/scoring/exclusion";
import type { AudienceTastes } from "@/lib/scoring/fit";
import { scoreAll } from "@/lib/scoring/fit";
import type {
  Audience,
  PipelineResult,
  PitchInput,
  QlooCall,
  RunStep,
} from "@/lib/types";

/**
 * What the pipeline needs beyond the frozen `PitchInput`. Titles, words,
 * and rival readings are the AI's proposals (§7); U collects or generates
 * them and passes them in. `types.ts` stays frozen.
 */
export interface PipelineInput extends PitchInput {
  /** Confirmed "similar to" titles (§6.2). */
  similarTitles: string[];
  /** Suggested descriptive words to check against Qloo tags (§6.5). */
  candidateWords: string[];
  /** AI's alternative readings (§6.3); grounded by `buildRivals`. */
  rivalProposals: RivalProposal[];
}

export interface PipelineOptions {
  /** Overrides the §6.4 default of 20 controls (fast dev runs). */
  controlCount?: number;
}

/** The mock pitch, wired end to end for Day 6 U and tests. */
export const demoPipelineInput: PipelineInput = {
  pitchText:
    "A quiet science-fiction film about a lonely worker on a space station.",
  workType: "film",
  nothingLike: ["Fast franchise action"],
  similarTitles: ["Moon", "Arrival", "Dune"],
  candidateWords: ["slow-burn", "solitude", "quiet", "space"],
  rivalProposals: [
    {
      id: "rival-lit",
      name: "Literary fiction about isolation",
      reason: "Reads the station as solitude, not spectacle.",
      titles: [
        "Never Let Me Go",
        "Klara and the Sun",
        "Station Eleven",
        "Remains of the Day",
      ],
    },
    {
      id: "rival-amb",
      name: "Ambient music listeners",
      reason: "Reads the quiet as the point, not the setting.",
      titles: ["Brian Eno", "Stars of the Lid", "Tim Hecker"],
    },
  ],
};

function doneStep(
  id: string,
  label: string,
  detail: string,
  callId?: string,
): RunStep {
  return { id, label, status: "done", detail, callId };
}

/**
 * Run the full pipeline: resolve, fetch tastes, subtract exclusion,
 * score, verdict, grounding. Never throws on Qloo failure (§8).
 */
export async function runPipeline(
  input: PipelineInput,
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  if (typeof window !== "undefined") {
    throw new Error(
      "runPipeline is server-only and cannot run in the browser.",
    );
  }
  const { similarTitles, candidateWords, rivalProposals, ...pitch } = input;
  const calls: QlooCall[] = [];
  const steps: RunStep[] = [];

  const titleRes = await resolveTitles(similarTitles, input.workType);
  calls.push(...titleRes.calls);
  const hypothesis: Audience = {
    id: "hyp",
    kind: "hypothesis",
    name: `Hypothesis (${input.workType})`,
    titles: titleRes.resolved,
    notFoundTitles: titleRes.notFoundTitles,
  };
  steps.push(
    doneStep(
      "hypothesis",
      "Hypothesis audience",
      `${similarTitles.length} checked, ${titleRes.resolved.length} found, ${titleRes.notFoundTitles.length} not found`,
      titleRes.calls[0]?.id,
    ),
  );

  const tagRes = await resolvePitchTags(candidateWords);
  calls.push(...tagRes.calls);
  const suggested = tagRes.tags.length + tagRes.notFoundWords.length;
  steps.push(
    doneStep(
      "tags",
      "Pitch tags",
      `coverage ${tagRes.tags.length} of ${suggested}`,
      tagRes.calls[0]?.id,
    ),
  );

  const rivalRes = await buildRivals(
    hypothesis,
    rivalProposals,
    input.workType,
  );
  calls.push(...rivalRes.calls);
  const replaced = rivalRes.dropped.length + rivalRes.emptyRivals.length;
  steps.push(
    doneStep(
      "rivals",
      "Rival readings",
      rivalRes.hasEnoughRivals
        ? `${rivalRes.rivals.length} kept, ${replaced} replaced`
        : `${rivalRes.rivals.length} kept, continues with what exists`,
      rivalRes.calls[0]?.id,
    ),
  );

  const controlRes = await buildControls(
    input.workType,
    options.controlCount ?? CONTROL_COUNT,
  );
  calls.push(...controlRes.calls);
  steps.push(
    doneStep(
      "controls",
      "Control audiences",
      `${controlRes.controls.length} built, ${controlRes.droppedControls.length} dropped`,
      controlRes.calls[0]?.id,
    ),
  );

  const exclRes = await resolveTitles(input.nothingLike, input.workType);
  calls.push(...exclRes.calls);
  const exclusion: Audience = {
    id: "exclusion",
    kind: "exclusion",
    name: "Nothing like",
    titles: exclRes.resolved,
    notFoundTitles: exclRes.notFoundTitles,
  };

  const audiences = [
    hypothesis,
    ...rivalRes.rivals,
    ...controlRes.controls,
    exclusion,
  ];
  const { all, calls: tasteCalls } = await fetchAllAudienceTastes(audiences);
  calls.push(...tasteCalls);
  steps.push(
    doneStep(
      "tastes",
      "Audience tastes",
      `${all.length} audiences`,
      tasteCalls[0]?.id,
    ),
  );

  const exclusionTastes: AudienceTastes = all.find(
    (t) => t.audienceId === exclusion.id,
  ) ?? { audienceId: exclusion.id, tagIds: [], failed: true };
  const adjusted = subtractExclusionFromAll(all, exclusionTastes);
  const tasteById = new Map(adjusted.map((t) => [t.audienceId, t]));
  const missingTastes = (id: string): AudienceTastes => ({
    audienceId: id,
    tagIds: [],
    failed: true,
  });
  const contenderTastes = [
    hypothesis.id,
    ...rivalRes.rivals.map((r) => r.id),
  ].map((id) => tasteById.get(id) ?? missingTastes(id));
  const controlTastes = controlRes.controls.map(
    (c) => tasteById.get(c.id) ?? missingTastes(c.id),
  );
  const contenderScores = scoreAll(contenderTastes, tagRes.tags);
  const controlScores = scoreAll(controlTastes, tagRes.tags);
  steps.push(doneStep("score", "Fit scores", "rank-normalized 0 to 1"));

  const verdict = decideVerdict({
    hypothesisId: hypothesis.id,
    scores: contenderScores,
    controlScores,
    coverage: tagRes.coverage,
  });
  steps.push(
    doneStep(
      "verdict",
      "Control test and verdict",
      `${verdict.verdict}, top ${verdict.topAudienceId ?? "none"}`,
    ),
  );

  const knownTitleIds = audiences.flatMap((a) => a.titles.map((t) => t.qlooId));
  const knownTagIds = [
    ...tagRes.tags.map((t) => t.qlooTagId),
    ...all.flatMap((t) => t.tagIds),
  ];
  const grounding = checkGrounding(
    [hypothesis, ...rivalRes.rivals].flatMap((a) =>
      a.titles.map((t) => t.qlooId),
    ),
    tagRes.tags.map((t) => t.qlooTagId),
    knownTitleIds,
    knownTagIds,
  );

  return {
    input: pitch,
    hypothesis,
    rivals: rivalRes.rivals,
    controls: controlRes.controls,
    tags: tagRes.tags,
    coverage: tagRes.coverage,
    scores: [...contenderScores, ...controlScores],
    verdict,
    grounding,
    calls,
    steps,
  };
}
