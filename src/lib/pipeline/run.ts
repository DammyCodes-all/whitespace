/**
 * Day 6 S: pipeline seam. Owned by S.
 *
 * Wires the frozen pieces end to end: Day 6 Q seam (`@/lib/qloo/index`)
 * to scoring (`scoreAll`, exclusion subtract) to verdict, plus the §8
 * grounding check. Q owns the fetches, S owns the order and the honesty
 * gates. The AI's proposals (similar titles, candidate words, rival
 * readings) arrive via `PipelineInput`: U passes the confirmed form
 * data, and `demoPipelineInput` covers the mock pitch until the agent
 * proposes them live. Tag resolve runs after tastes so it can prefer
 * the namespace variant audiences actually hold (§6.5, §6.6). The scope
 * gate (§3) refuses tool/app pitches before any Qloo call; the concept
 * audience (§6.6) scores "who loves these tags" next to the movie-fan
 * audiences so the idea itself gets tested.
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

import type { RivalProposal } from "@/lib/qloo/index";
import type { AudienceTastes } from "@/lib/scoring/fit";
import type {
  Audience,
  PipelineResult,
  PitchInput,
  PitchTag,
  QlooCall,
  RunStep,
} from "@/lib/types";
import { checkGrounding } from "../policy/grounding.ts";
import { checkScope } from "../policy/scope.ts";
import { decideVerdict } from "../policy/verdict.ts";
import {
  buildControls,
  buildRivals,
  CONTROL_COUNT,
  fetchAllAudienceTastes,
  fetchConceptTastes,
  resetQuota,
  resolvePitchTags,
  resolveTitles,
} from "../qloo/index.ts";
import { subtractExclusionFromAll } from "../scoring/exclusion.ts";
import {
  EXPANSION_TOP_TASTES,
  selectExpansions,
} from "../scoring/expansion.ts";
import { MIN_TASTES_FOR_JUDGEMENT, scoreAllWeighted } from "../scoring/fit.ts";

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
  /** Subset of candidateWords the user pinned; counts double (§6.6). */
  pinnedWords?: string[];
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
  candidateWords: ["science-fiction", "space", "drama", "future"],
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
  const {
    similarTitles,
    candidateWords,
    pinnedWords = [],
    rivalProposals,
    ...pitch
  } = input;
  // Fresh quota + cache per run: the client counts network fetches in
  // module state, so without this run N inherits run 1's usage and a
  // second full run trips the per-run cap (§11). Reach/change/chatbot
  // marks after the pipeline share this run's remaining budget.
  resetQuota();
  const calls: QlooCall[] = [];
  const steps: RunStep[] = [];

  // Scope gate (§3, §6.7): tool/app pitches unite users by a behavior,
  // not a taste, and Qloo holds no app entities to ground them. Scoring
  // them anyway manufactures fake Weak runs, so refuse before spending
  // quota: Inconclusive with reason "scope", no Qloo calls.
  const scope = checkScope(input.pitchText);
  if (!scope.inScope) {
    steps.push(
      doneStep(
        "scope",
        "Scope check",
        scope.trigger
          ? `tool/app pitch (saw "${scope.trigger}") — taste data cannot judge tools`
          : "tool/app pitch — taste data cannot judge tools",
      ),
    );
    const hypothesis: Audience = {
      id: "hyp",
      kind: "hypothesis",
      name: `Hypothesis (${input.workType})`,
      titles: [],
      notFoundTitles: [],
    };
    return {
      input: pitch,
      hypothesis,
      rivals: [],
      controls: [],
      tags: [],
      coverage: 0,
      scores: [],
      verdict: {
        verdict: "Inconclusive",
        topAudienceId: null,
        marginTopVsSecond: 0,
        marginTopVsControl: 0,
        clearsControl: false,
        surprise: false,
        inconclusiveReason: "scope",
      },
      grounding: { ok: true, ungroundedTitles: [], ungroundedTags: [] },
      calls,
      steps,
    };
  }

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
  const { all, calls: tasteCalls } = await fetchAllAudienceTastes(
    audiences,
    input.workType,
  );
  calls.push(...tasteCalls);
  steps.push(
    doneStep(
      "tastes",
      "Audience tastes",
      `${all.length} audiences`,
      tasteCalls[0]?.id,
    ),
  );

  // Tags resolve after tastes: a word living in several Qloo namespaces
  // resolves to the variant audiences actually hold, so scoring can meet
  // it (§6.5, §6.6). The exclusion audience stays out of the preference
  // set — preferring an id the subtract then removes would score nothing.
  const tasteUniverse = new Set(
    all.filter((t) => t.audienceId !== exclusion.id).flatMap((t) => t.tagIds),
  );
  const tagRes = await resolvePitchTags(
    candidateWords,
    input.workType,
    tasteUniverse,
  );
  calls.push(...tagRes.calls);
  // §6.6: pinned must-haves count double. resolvePitchTags returns
  // pinned:false; the UI's pinnedWords list is applied here (S-owned).
  // Local mirror of Q's normalizeKey (kept here per file ownership):
  // "slow-burn" and "slow burn" are the same word for pinning.
  const normalizeWord = (value: string): string =>
    value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const pinnedSet = new Set(pinnedWords.map(normalizeWord).filter(Boolean));
  const pitchTags = tagRes.tags.map((tag) =>
    pinnedSet.has(normalizeWord(tag.tag)) ? { ...tag, pinned: true } : tag,
  );
  const suggested = tagRes.tags.length + tagRes.notFoundWords.length;
  steps.push(
    doneStep(
      "tags",
      "Pitch tags",
      `coverage ${tagRes.tags.length} of ${suggested}`,
      tagRes.calls[0]?.id,
    ),
  );

  // Concept audience (§6.6, §7): the hypothesis describes film fandom,
  // not the idea. Ask Qloo the complementary question — "who loves THESE
  // TAGS?" via signal.interests.tags — and score it as a contender next
  // to the movie-fan audiences. One extra call; a miss degrades to
  // no-data like any other audience (§8). Renders inside `rivals` with
  // kind "rival" so no frozen type changes.
  const conceptAudience: Audience = {
    id: "concept",
    kind: "rival",
    name: "Concept (from your words)",
    reason: "Built from your pitch tags, not movie fandoms.",
    titles: [],
    notFoundTitles: [],
  };
  const { tastes: conceptTastes, call: conceptCall } = await fetchConceptTastes(
    pitchTags.map((t) => t.qlooTagId),
    input.workType,
  );
  if (conceptCall !== null) calls.push(conceptCall);
  steps.push(
    doneStep(
      "concept",
      "Concept audience",
      conceptTastes.failed === true
        ? "no concept signal"
        : `${conceptTastes.tagIds.length} tastes from your words`,
      conceptCall?.id,
    ),
  );
  const allWithConcept = [...all, conceptTastes];

  const exclusionTastes: AudienceTastes = all.find(
    (t) => t.audienceId === exclusion.id,
  ) ?? { audienceId: exclusion.id, tagIds: [], failed: true };
  const adjusted = subtractExclusionFromAll(allWithConcept, exclusionTastes);
  const tasteById = new Map(adjusted.map((t) => [t.audienceId, t]));
  const missingTastes = (id: string): AudienceTastes => ({
    audienceId: id,
    tagIds: [],
    failed: true,
  });
  const contenderTastes = [
    hypothesis.id,
    conceptAudience.id,
    ...rivalRes.rivals.map((r) => r.id),
  ].map((id) => tasteById.get(id) ?? missingTastes(id));
  const controlTastes = controlRes.controls.map(
    (c) => tasteById.get(c.id) ?? missingTastes(c.id),
  );

  // Expansion retry (§6.5, §6.6): pitch tags held by no audience taste
  // list get one silent second chance against the hypothesis top tastes.
  // Borrowed ids come from fetched tastes, so §8 grounding holds; they
  // score at half weight and render `word→Tag Name`. No extra Qloo calls:
  // both sides already arrived. Skipped when the hypothesis itself is
  // unjudgeable: nothing honest to borrow from.
  const heldIds = new Set(
    [...contenderTastes, ...controlTastes].flatMap((t) => t.tagIds),
  );
  const unmatchedWords = pitchTags
    .filter((t) => !heldIds.has(t.qlooTagId))
    .map((t) => t.tag);
  const hypAdjusted = tasteById.get(hypothesis.id);
  const hypLends =
    hypAdjusted !== undefined &&
    hypAdjusted.failed !== true &&
    hypAdjusted.tagIds.length >= MIN_TASTES_FOR_JUDGEMENT;
  const expansionTags: PitchTag[] = [];
  const expansionLabels = new Map<string, string>();
  if (unmatchedWords.length > 0 && hypLends && hypAdjusted !== undefined) {
    const hypTop = hypAdjusted.tagIds
      .slice(0, EXPANSION_TOP_TASTES)
      .map((id, index) => ({ id, name: hypAdjusted.tagNames?.[index] ?? "" }));
    const expansions = selectExpansions(
      unmatchedWords,
      hypTop,
      new Set(pitchTags.map((t) => t.qlooTagId)),
    );
    for (const e of expansions) {
      expansionTags.push({
        tag: e.word,
        qlooTagId: e.qlooTagId,
        pinned: false,
      });
      expansionLabels.set(e.qlooTagId, `${e.word}→${e.name}`);
    }
  }
  const weightedTags = [
    ...pitchTags.map((tag) => ({ tag, weight: tag.pinned ? 2 : 1 })),
    ...expansionTags.map((tag) => ({
      tag,
      weight: 0.5,
      label: expansionLabels.get(tag.qlooTagId) ?? tag.tag,
    })),
  ];
  const contenderScores = scoreAllWeighted(contenderTastes, weightedTags);
  const controlScores = scoreAllWeighted(controlTastes, weightedTags);
  steps.push(
    doneStep(
      "score",
      "Fit scores",
      expansionTags.length > 0
        ? `rank-normalized 0 to 1, +${expansionTags.length} expanded`
        : "rank-normalized 0 to 1",
    ),
  );

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
    ...pitchTags.map((t) => t.qlooTagId),
    ...expansionTags.map((t) => t.qlooTagId),
    ...all.flatMap((t) => t.tagIds),
    ...conceptTastes.tagIds,
  ];
  const grounding = checkGrounding(
    [hypothesis, ...rivalRes.rivals].flatMap((a) =>
      a.titles.map((t) => t.qlooId),
    ),
    [...pitchTags, ...expansionTags].map((t) => t.qlooTagId),
    knownTitleIds,
    knownTagIds,
  );

  return {
    input: pitch,
    hypothesis,
    rivals: [...rivalRes.rivals, conceptAudience],
    controls: controlRes.controls,
    tags: pitchTags,
    coverage: tagRes.coverage,
    scores: [...contenderScores, ...controlScores],
    verdict,
    grounding,
    calls,
    steps,
  };
}
