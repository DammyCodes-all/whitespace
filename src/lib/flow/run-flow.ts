/**
 * Package B: the shipped flow orchestrator. Owned by S.
 *
 * Implements the brief's flow and nothing else. Chatbot comparison
 * lives in its own route (`/api/compare`).
 *
 * Scoring uses the existing scorer (`scoreAllWeighted`, equal weights
 * when bridgeless) — one scorer in the shipped path, per the brief. The brief
 * asks for a plain equal-weight membership fraction; the shipped
 * scorer is rank-based (`rankStrength`, §6.6), which is a spec
 * deviation recorded in `docs/build-tracker.md` rather than a second
 * scorer. It breaks no non-negotiable: it never invents a value
 * (unjudgeable fits stay null), never lets the LLM score, and every
 * number still comes from Qloo (§7).
 *
 * Candidate audiences: 3 to 5. One is "named", built from the user's
 * optional similar-to titles; the rest are rivals discovered from Qloo
 * data as alternative readings — a rival with no resolvable title is
 * dropped, never kept on its name. Control audiences come from the
 * Package A cache: the same cached tag sets every pitch, scored fresh
 * per run.
 *
 * Spec ref: §6.2 (titles), §6.3 (rivals), §6.4 (controls), §6.5
 * (tags), §6.6 (scoring), §6.7 (verdict), §6.8 (reach), §6.12
 * (evidence), §7 (our code ranks).
 */

import {
  availableFromTastes,
  namesById,
  proposeBridges,
  usableBridges,
} from "../agent/bridge.ts";
import { namedAudienceLabel } from "../audience-words.ts";
import {
  BRIDGES_ENABLED,
  CANDIDATES,
  CONTROL_COUNT,
  MAX_TITLES_PER_AUDIENCE,
  MIN_MATCHED_TAGS,
} from "../config.ts";
import { checkGrounding } from "../policy/grounding.ts";
import { checkScope } from "../policy/scope.ts";
import { applyFragilityCap, decideVerdict } from "../policy/verdict.ts";
import {
  discoverRivals,
  fetchAllAudienceTastes,
  fetchRelated,
  interestsFromTastes,
  loadControlTastes,
  resetQuota,
  resolveTitles,
  shouldReplanWithEntities,
} from "../qloo/index.ts";
import type { RelatedResult } from "../qloo/related.ts";
import { buildTitleTagPool, namedTasteAudiences } from "../qloo/title-tags.ts";
import {
  type AudienceTastes,
  isUnjudgeable,
  scoreAllWeighted,
  type WeightedTag,
} from "../scoring/fit.ts";
import { assessFragility, type HoldOutRound } from "../scoring/fragility.ts";
import { eligibleControls } from "../scoring/overlap.ts";
import {
  bridgesToWeightedTags,
  selectLeftoverWords,
} from "../scoring/semantic.ts";
import type {
  Audience,
  FitScore,
  PipelineResult,
  PitchInput,
  PitchTag,
  QlooCall,
  RunStep,
} from "../types.ts";
import type { FlowReachInput, FlowTagSource } from "./contract.ts";
import { toFlowResult } from "./contract.ts";
import {
  audienceTitleIds,
  groundAudiences,
  groundRelated,
  groundTags,
  mergeGrounding,
  relatedEntityIds,
  tasteTagIds,
} from "./grounding-run.ts";
import { reachTargets } from "./reach-plan.ts";

export interface FlowInput extends PitchInput {
  /** Optional "similar to" titles; build the named audience (§6.2). */
  similarTitles: string[];
  /**
   * Confirmed pitch tags from the chip step (step 2 of the flow).
   * Only `matched` tags reach scoring; `not_found` are reported.
   */
  tags: FlowTagInput[];
  /**
   * Title-tag ids the user confirmed in the tags phase. Empty (or
   * absent) keeps the whole title-grounded pool; a non-empty list
   * narrows it to exactly these ids.
   */
  pickedTagIds?: string[];
}

/**
 * Flow-local pooled tag. `PitchTag` is frozen, so provenance rides
 * beside it here and reaches the UI as `FlowTag.source` — never by
 * extending the frozen type.
 */
export interface FlowPoolTag {
  tag: PitchTag;
  source: FlowTagSource;
}

function tagSourcesOf(
  pool: readonly FlowPoolTag[],
): Record<string, FlowTagSource> {
  const out: Record<string, FlowTagSource> = {};
  for (const entry of pool) out[entry.tag.qlooTagId] = entry.source;
  return out;
}

export interface FlowTagInput {
  label: string;
  qlooId?: string;
  status: "matched" | "not_found";
}

export interface FlowRunResult {
  /** Adapter output: the only shape the UI reads. */
  result: ReturnType<typeof toFlowResult>;
  /** Steps with real counts, for the run stream (§5.4). */
  steps: RunStep[];
  /** True when the run stopped before scoring (gate or scope). */
  stopped: boolean;
}

function doneStep(
  id: string,
  label: string,
  detail: string,
  callId?: string,
): RunStep {
  return { id, label, status: "done", detail, callId };
}

/**
 * The rivals step, worded for what actually happened. An empty answer
 * is only "nothing related" when a request really ran: with no Qloo
 * key every call is a placeholder, and the honest line is that nothing
 * was searched (§8, §10 #4).
 */
function rivalDetail(found: number, calls: QlooCall[]): string {
  if (calls.length === 0) return "not searched";
  if (calls.every((call) => call.mock === true)) {
    return "not searched, no Qloo key";
  }
  const statuses = new Set(calls.map((call) => call.status)).size;
  // Every call answered with an error: the graph never got to answer,
  // so "nothing related" would be a claim it never made.
  if (calls.every((call) => call.status !== 200)) {
    return `Qloo did not answer (${statuses} status), ${calls.length} calls`;
  }
  return found > 0
    ? `${found} from Qloo data (${statuses} status), ${calls.length} calls`
    : `nothing related to the pitch words (${statuses} status), ${calls.length} calls`;
}

/** The v1 result shape the adapter consumes, minus the unwired phases. */
function emptyPipeline(
  input: PitchInput,
  calls: QlooCall[],
  steps: RunStep[],
  hypothesis: Audience,
  tags: PitchTag[] = [],
  knownTagIds: readonly string[] = [],
): PipelineResult {
  // Early exits still run the real check on whatever they are about to
  // display (the thin-pool exit passes its pooled tags). No known ids
  // and no output is vacuously grounded, never an asserted `true`.
  const knownTags = new Set(knownTagIds);
  const keptTags = tags.filter((tag) => knownTags.has(tag.qlooTagId));
  return {
    input,
    hypothesis,
    rivals: [],
    controls: [],
    tags: keptTags,
    coverage: 0,
    scores: [],
    verdict: {
      verdict: "Inconclusive",
      topAudienceId: null,
      marginTopVsSecond: 0,
      marginTopVsControl: 0,
      clearsControl: false,
      surprise: false,
      inconclusiveReason: "empty",
    },
    grounding: checkGrounding(
      [],
      keptTags.map((tag) => tag.qlooTagId),
      [],
      [...knownTagIds],
    ),
    calls,
    steps,
  };
}

/**
 * Run the brief's flow. Never throws on Qloo failure: every wrapper
 * degrades to not-found/failed, so the result is always an honest
 * verdict plus traces (§8).
 */
export async function runFlowPitch(
  input: FlowInput,
  options: { controlCount?: number; bridgesEnabled?: boolean } = {},
): Promise<FlowRunResult> {
  if (typeof window !== "undefined") {
    throw new Error("runFlowPitch is server-only.");
  }
  resetQuota();
  const { similarTitles, tags: tagInput, ...pitch } = input;
  const calls: QlooCall[] = [];
  const steps: RunStep[] = [];

  const matchedTags: PitchTag[] = tagInput
    .filter((t) => t.status === "matched" && t.qlooId !== undefined)
    .map((t) => ({
      tag: t.label,
      qlooTagId: t.qlooId as string,
    }));
  const notFoundWords = tagInput
    .filter((t) => t.status === "not_found")
    .map((t) => t.label);
  const suggested = matchedTags.length + notFoundWords.length;
  const coverage = suggested === 0 ? 0 : matchedTags.length / suggested;

  // §8 grounding ledger: everything Qloo returned during THIS run. The
  // confirmed chip tags were resolved by /v2/tags in step 2, so they are
  // the pre-run half of the tag set; every fetch below adds to it.
  const knownTitleIds = new Set<string>();
  const knownTagIds = new Set<string>(matchedTags.map((tag) => tag.qlooTagId));
  // Tags stripped before scoring (pool, bridges): folded into the final
  // GroundingResult so a removed id is never silently forgotten.
  const strippedTagIds: string[] = [];

  const baseInput: PitchInput = {
    pitchText: pitch.pitchText,
    workType: pitch.workType,
  };
  const idleHypothesis: Audience = {
    id: "hyp",
    kind: "hypothesis",
    name: namedAudienceLabel(input.workType),
    titles: [],
    notFoundTitles: [],
  };

  // Scope gate (§3): a tool/app pitch cannot be judged by taste data.
  // Same rule the v1 pipeline enforces, kept so the flow never shows a
  // fake Weak verdict. Costs zero Qloo calls.
  const scope = checkScope(pitch.pitchText);
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
    const result = emptyPipeline(baseInput, calls, steps, idleHypothesis);
    return {
      result: toFlowResult(result),
      steps,
      stopped: true,
    };
  }

  // Cheap empty-check (zero Qloo calls): no titles to ground tags
  // in and too few pitch tags to score on their own. Anything else
  // proceeds — title gifts may still fill the pool, and the real gate
  // on the pooled set runs after tastes load below.
  if (similarTitles.length === 0 && matchedTags.length < MIN_MATCHED_TAGS) {
    steps.push(
      doneStep(
        "tags",
        "Words from your description",
        `${matchedTags.length} matched, ${notFoundWords.length} not found — no titles and below the ${MIN_MATCHED_TAGS}-tag gate`,
      ),
    );
    steps.push(
      doneStep("verdict", "The verdict", "Inconclusive, too few matched tags"),
    );
    const result = emptyPipeline(baseInput, calls, steps, idleHypothesis);
    return {
      result: toFlowResult(result),
      steps,
      stopped: true,
    };
  }

  // Named audience (step 3): the user's similar-to titles. No similar
  // titles means no named audience — the hypothesis row is omitted and
  // the run is rival-led, never invented.
  let hypothesis: Audience | null = null;
  if (similarTitles.length > 0) {
    const titleRes = await resolveTitles(similarTitles, input.workType);
    calls.push(...titleRes.calls);
    hypothesis = {
      id: "hyp",
      kind: "hypothesis",
      name: namedAudienceLabel(input.workType),
      titles: titleRes.resolved,
      notFoundTitles: titleRes.notFoundTitles,
    };
    for (const id of audienceTitleIds([hypothesis])) knownTitleIds.add(id);
    steps.push(
      doneStep(
        "hypothesis",
        namedAudienceLabel(input.workType),
        `${similarTitles.length} checked, ${titleRes.resolved.length} found, ${titleRes.notFoundTitles.length} not found`,
        titleRes.calls[0]?.id,
      ),
    );
  }

  // Rivals (step 3): suggested by Qloo data alone, never by a model —
  // the brief lets the LLM extract tags and word the verdict, nothing
  // else. A rival is a real Qloo entity's fan base, named after that
  // entity, so the name is a fact.
  //
  // The first attempt asks the graph with the pitch's own matched
  // words. That is the sharper question when it works, but it is an
  // intersection across every matched word, and a niche pitch can come
  // back empty — not a missing catalog, a too-narrow question. So when
  // it comes back empty and the user named titles, the agent re-asks
  // the same graph from those titles instead ("what is related to Moon
  // and Aftersun?"). One extra attempt, then an honest "no rivals".
  const wantedRivals = Math.max(
    0,
    CANDIDATES.min + 1 - (hypothesis === null ? 0 : 1),
  );
  const seedTagIds = matchedTags.map((t) => t.qlooTagId);
  const seedEntityIds = hypothesis?.titles.map((t) => t.qlooId) ?? [];
  const firstAttempt = await discoverRivals({
    tagIds: seedTagIds,
    entityIds: seedEntityIds,
    workType: input.workType,
    count: wantedRivals,
    seed: "tags",
  });
  calls.push(...firstAttempt.calls);

  let discovered = firstAttempt.rivals;
  let farCandidate = firstAttempt.farCandidate;
  let replan: {
    rivals: number;
    calls: number;
    callId: string | undefined;
  } | null = null;

  if (
    shouldReplanWithEntities({
      rivalsFound: firstAttempt.rivals.length,
      seedUsed: firstAttempt.seedUsed,
      entityCount: seedEntityIds.length,
      firstAttemptAnswered: firstAttempt.answered,
    })
  ) {
    const secondAttempt = await discoverRivals({
      tagIds: seedTagIds,
      entityIds: seedEntityIds,
      workType: input.workType,
      count: wantedRivals,
      seed: "entities",
    });
    calls.push(...secondAttempt.calls);
    replan = {
      rivals: secondAttempt.rivals.length,
      calls: secondAttempt.calls.length,
      // Prefer a call that answered: this id also backs the rivals'
      // citation (§6.12), and a failed domain would open an error.
      callId:
        secondAttempt.calls.find((call) => call.status === 200)?.id ??
        secondAttempt.calls[0]?.id,
    };
    // The second answer replaces the first wholesale: its rivals and
    // its leftovers come from the same ranking, so the strangers
    // baseline still matches the contenders it was cut from.
    if (secondAttempt.rivals.length > 0) {
      discovered = secondAttempt.rivals;
      farCandidate = secondAttempt.farCandidate;
    }
  }

  for (const id of audienceTitleIds(discovered)) knownTitleIds.add(id);
  if (farCandidate !== null) {
    knownTitleIds.add(farCandidate.id);
    if (farCandidate.member !== null) {
      knownTitleIds.add(farCandidate.member.id);
    }
  }
  steps.push(
    doneStep(
      "rivals",
      "Rival readings",
      rivalDetail(firstAttempt.rivals.length, firstAttempt.calls),
      firstAttempt.calls[0]?.id,
    ),
  );
  if (replan !== null) {
    steps.push(
      doneStep(
        "rivals-replan",
        "Rival readings, re-tried",
        `the pitch words came back empty; searched again from the titles you named — ${replan.rivals} rivals, ${replan.calls} calls`,
        replan.callId,
      ),
    );
  }

  const contenders: Audience[] = [
    ...(hypothesis === null ? [] : [hypothesis]),
    ...discovered,
  ];
  // Vacuous-run guard: no named audience and no rivals means nothing
  // could be scored. Stop BEFORE controls/tastes/reach so the run
  // spends ~3 calls, not ~90 — and say the cause, not just the verdict.
  if (contenders.length === 0) {
    steps.push(
      doneStep(
        "verdict",
        "The verdict",
        "Inconclusive, nothing to judge: no similar titles and no rivals discovered",
      ),
    );
    const result = emptyPipeline(baseInput, calls, steps, idleHypothesis);
    return { result: toFlowResult(result), steps, stopped: true };
  }

  // Controls (step 4): cached tag sets keyed by pitch type, scored
  // fresh per pitch. The comparison field is decided after scoring (the
  // strangers baseline needs its score first), so the controls step
  // is pushed after the score step below.
  const controlCached = await loadControlTastes(
    input.workType,
    options.controlCount ?? CONTROL_COUNT,
  );
  calls.push(...controlCached.calls);
  for (const id of audienceTitleIds(controlCached.controls)) {
    knownTitleIds.add(id);
  }

  // Strangers baseline: a far audience from the discovery ranking's
  // leftovers — the last bottom entities no rival uses. Same domain,
  // far territory: one more comparison the verdict has to beat.
  const farAudience: Audience | null =
    farCandidate === null
      ? null
      : {
          id: "far",
          kind: "control",
          name: "Strangers to this idea",
          titles: [
            {
              query: farCandidate.name,
              qlooId: farCandidate.id,
              name: farCandidate.name,
              type: farCandidate.type,
            },
            ...(farCandidate.member === null
              ? []
              : [
                  {
                    query: farCandidate.member.name,
                    qlooId: farCandidate.member.id,
                    name: farCandidate.member.name,
                    type: farCandidate.member.type,
                  },
                ]),
          ],
          notFoundTitles: [],
        };

  const { all: freshTastes, calls: tasteCalls } = await fetchAllAudienceTastes(
    contenders,
    input.workType,
  );
  calls.push(...tasteCalls);
  // Strangers tastes: one extra call on the same path (same take and
  // scope) when the ranking left a far candidate.
  let farTastes: AudienceTastes[] = [];
  if (farAudience !== null) {
    const farRes = await fetchAllAudienceTastes([farAudience], input.workType);
    farTastes = farRes.all;
    calls.push(...farRes.calls);
  }
  const tasteById = new Map<string, AudienceTastes>(
    [...freshTastes, ...controlCached.tastes].map((t) => [t.audienceId, t]),
  );
  steps.push(
    doneStep(
      "tastes",
      "What each audience likes",
      `${freshTastes.length + farTastes.length} fetched, ${controlCached.tastes.length} from cache`,
      tasteCalls[0]?.id,
    ),
  );

  const scoredContenders: AudienceTastes[] = contenders.map(
    (a) =>
      tasteById.get(a.id) ?? {
        audienceId: a.id,
        tagIds: [],
        failed: true,
      },
  );
  const scoredControls: AudienceTastes[] = controlCached.controls.map(
    (c) =>
      tasteById.get(c.id) ?? {
        audienceId: c.id,
        tagIds: [],
        failed: true,
      },
  );
  // Title-grounded pool (step 5): one taste list per resolved title
  // (same joined-signal titles, first MAX_TITLES_PER_AUDIENCE — the
  // taste fetch itself caps entities per audience there too), merged
  // with the pitch's matched tags and cut against controls. The real
  // gate runs on the pooled size: title gifts may rescue a thin pitch,
  // and a thin pool stops here as Inconclusive.
  const poolTitles = (hypothesis?.titles ?? []).slice(
    0,
    MAX_TITLES_PER_AUDIENCE,
  );
  const namedTargets = namedTasteAudiences(poolTitles);
  const { all: namedTastes, calls: namedTasteCalls } =
    await fetchAllAudienceTastes(namedTargets, input.workType);
  calls.push(...namedTasteCalls);
  // Every taste list fetched this run is a grounding source. The named
  // and audience fetches overlap by design; the set dedupes.
  for (const id of tasteTagIds([
    freshTastes,
    farTastes,
    controlCached.tastes,
    namedTastes,
  ])) {
    knownTagIds.add(id);
  }
  const knownTagSet = new Set(knownTagIds);
  const pool = buildTitleTagPool({
    namedTastes: poolTitles.map((title, index) => ({
      tastes: namedTastes[index] ?? {
        audienceId: `title:${title.qlooId}`,
        tagIds: [],
        failed: true,
      },
      titleId: title.qlooId,
      titleName: title.name,
    })),
    pitchMatchedTags: matchedTags.map((tag) => ({
      qlooTagId: tag.qlooTagId,
      label: tag.tag,
    })),
    controlTastes: controlCached.tastes,
    pickedIds: input.pickedTagIds ?? [],
  });
  let poolTags: FlowPoolTag[] = pool.map((candidate) => ({
    tag: {
      tag: candidate.label,
      qlooTagId: candidate.qlooTagId,
    },
    source:
      candidate.source === "pitch"
        ? "pitch"
        : {
            titleId: candidate.source.titleId,
            titleName: candidate.sourceTitleName ?? candidate.source.titleId,
          },
  }));
  // §8: strip before scoring. Doing it later would leave scores built
  // from a tag the output no longer shows.
  const groundedPool = groundTags(
    poolTags,
    (entry) => entry.tag.qlooTagId,
    knownTagSet,
  );
  poolTags = groundedPool.kept;
  strippedTagIds.push(...groundedPool.removed);
  const poolFromTitles = poolTags.filter((p) => p.source !== "pitch").length;
  const poolGiftTitles = new Set(
    poolTags.flatMap((p) => (p.source === "pitch" ? [] : [p.source.titleId])),
  ).size;
  if (poolTags.length < MIN_MATCHED_TAGS) {
    if (strippedTagIds.length > 0) {
      steps.push(
        doneStep(
          "grounding",
          "Grounding check",
          `${strippedTagIds.length} tag(s) had no Qloo result; removed before scoring`,
        ),
      );
    }
    steps.push(
      doneStep(
        "tags",
        "Your words, plus tags from your titles",
        `${poolTags.length} pooled (${poolFromTitles} from titles, ${poolTags.length - poolFromTitles} from pitch) — below the ${MIN_MATCHED_TAGS}-tag gate`,
      ),
    );
    steps.push(
      doneStep("verdict", "The verdict", "Inconclusive, too few pooled tags"),
    );
    const result = emptyPipeline(
      baseInput,
      calls,
      steps,
      idleHypothesis,
      poolTags.map((p) => p.tag),
      [...knownTagIds],
    );
    return {
      result: toFlowResult(result, {}, tagSourcesOf(poolTags)),
      steps,
      stopped: true,
    };
  }
  steps.push(
    doneStep(
      "tags",
      "Title-grounded tags",
      `${poolTags.length} pooled (${poolFromTitles} from ${poolGiftTitles} title(s), ${poolTags.length - poolFromTitles} from pitch)`,
      namedTasteCalls[0]?.id,
    ),
  );
  // AI word-bridge (bonus, never a dependency, behind
  // BRIDGES_ENABLED — off by default): leftover matched words scoring
  // zero everywhere get one narrow LLM call pointing each at an
  // already-fetched taste id + bucket (max 4). Any failure falls back
  // to the exact-match run; verdict and controls logic are untouched.
  let bridgeWtags: WeightedTag[] = [];
  let bridgeNote = "";
  let bridgeCallId: string | undefined;
  const bridgesOn = options.bridgesEnabled ?? BRIDGES_ENABLED;
  if (!bridgesOn) {
    bridgeNote = ", bridges off, exact matches scored";
  } else {
    const heldIds = new Set(
      [...scoredContenders, ...scoredControls].flatMap((t) => t.tagIds),
    );
    const leftoverWords = selectLeftoverWords(matchedTags, heldIds);
    if (leftoverWords.length > 0) {
      try {
        // A tag already in the scored pool cannot be a bridge target:
        // it would count the same signal twice.
        const poolIds = new Set(poolTags.map((entry) => entry.tag.qlooTagId));
        const available = availableFromTastes([
          ...scoredContenders,
          ...scoredControls,
        ]).filter((candidate) => !poolIds.has(candidate.id));
        const bridges = await proposeBridges({
          words: leftoverWords,
          available,
        });
        const proposed = bridgesToWeightedTags(bridges, namesById(available));
        // A weighted bridge no contender holds can only dilute the
        // weighted mean: every audience's denominator grows, no
        // numerator does. Distance (weight 0) bridges stay — they score
        // nothing and remain visible as "considered, not counted".
        const contenderIds = new Set(
          scoredContenders.flatMap((tastes) => tastes.tagIds),
        );
        const usable = usableBridges(proposed, contenderIds);
        bridgeWtags.push(...usable);
        // §8/§10 #1: a bridge target is only grounded when the id came
        // back in this run's fetched tastes. `toBridges` already gates
        // on that set; this keeps the ledger honest if that changes.
        const groundedBridges = groundTags(
          bridgeWtags,
          (entry) => entry.tag.qlooTagId,
          knownTagSet,
        );
        bridgeWtags = groundedBridges.kept;
        strippedTagIds.push(...groundedBridges.removed);
        const dropped =
          proposed.length - usable.length + groundedBridges.removed.length;
        if (bridgeWtags.length > 0) {
          bridgeNote = `, +${bridgeWtags.length} AI bridge${bridgeWtags.length === 1 ? "" : "s"} (${bridgeWtags.map((w) => w.label).join("; ")})`;
          if (dropped > 0) {
            bridgeNote += `, ${dropped} dropped (held by no contender)`;
          }
          bridgeCallId = tasteCalls[0]?.id ?? controlCached.calls[0]?.id;
        } else if (dropped > 0) {
          bridgeNote =
            ", AI bridges held by no contender here, exact matches scored";
        } else {
          bridgeNote = ", bridges unavailable, exact matches scored";
        }
      } catch {
        bridgeNote = ", bridges unavailable, exact matches scored";
      }
    }
  }
  const flowWeightedTags: WeightedTag[] = [
    ...poolTags.map((entry) => ({ tag: entry.tag, weight: 1 })),
    ...bridgeWtags,
  ];
  const contenderScores = scoreAllWeighted(scoredContenders, flowWeightedTags);
  const controlScores = scoreAllWeighted(scoredControls, flowWeightedTags);
  steps.push(
    doneStep(
      "score",
      "Scoring every audience",
      `0 to 1 across ${poolTags.length} pooled tags${bridgeNote}`,
      bridgeCallId,
    ),
  );

  // Hold-out rounds: the full set scored above, plus one round per
  // source title dropping its gifts. Every audience (contenders,
  // controls, far) is rescored on the SAME reduced set per round
  // (shared-set — never giver-only), so a round measures the pool's
  // dependence on that title, not the title's own fit. Zero Qloo
  // calls: pure rescoring. Each round lands as a step carrying the
  // named delta.
  const giftTitleIds: string[] = [];
  for (const entry of poolTags) {
    if (entry.source === "pitch") continue;
    if (!giftTitleIds.includes(entry.source.titleId)) {
      giftTitleIds.push(entry.source.titleId);
    }
  }
  const titleNameOf = (titleId: string): string => {
    const giver = poolTags.find(
      (entry) => entry.source !== "pitch" && entry.source.titleId === titleId,
    );
    return giver !== undefined && giver.source !== "pitch"
      ? giver.source.titleName
      : titleId;
  };
  const fmtFit = (fit: FitScore | null): string =>
    fit === null
      ? "n/a"
      : isUnjudgeable(fit)
        ? "not measured"
        : fit.score.toFixed(2);
  /** A score the guard can read; no data is null, never a zero (§6.6). */
  const judgedScore = (fit: FitScore | null): number | null =>
    fit === null || isUnjudgeable(fit) ? null : fit.score;
  const hypFull = contenderScores.find((s) => s.audienceId === "hyp") ?? null;
  const topFull =
    [...contenderScores].sort((a, b) => b.score - a.score)[0] ?? null;
  // §6.6: the same rounds are read twice — once for the deltas the
  // ledger shows, once as the fragility test. No extra call, no extra
  // scoring: the numbers below are the ones the rounds already made.
  const holdOutRounds: HoldOutRound[] = [];
  giftTitleIds.forEach((titleId, index) => {
    const titleName = titleNameOf(titleId);
    const dropped = poolTags.filter(
      (entry) => entry.source !== "pitch" && entry.source.titleId === titleId,
    ).length;
    const reducedWeighted: WeightedTag[] = [
      ...poolTags
        .filter(
          (entry) =>
            entry.source === "pitch" || entry.source.titleId !== titleId,
        )
        .map((entry) => ({ tag: entry.tag, weight: 1 })),
      ...bridgeWtags,
    ];
    // Shared-set: every audience rescores on the same reduced list.
    // Only the named and top deltas display, but the reduced set is
    // the same one for contenders, controls and far alike.
    const redContenders = scoreAllWeighted(scoredContenders, reducedWeighted);
    scoreAllWeighted(scoredControls, reducedWeighted);
    if (farTastes.length > 0) scoreAllWeighted(farTastes, reducedWeighted);
    const hypRed = redContenders.find((s) => s.audienceId === "hyp") ?? null;
    const topRed =
      [...redContenders].sort((a, b) => b.score - a.score)[0] ?? null;
    const deltaOf = (full: FitScore | null, red: FitScore | null): string => {
      if (
        full === null ||
        red === null ||
        isUnjudgeable(full) ||
        isUnjudgeable(red)
      ) {
        return "";
      }
      const delta = red.score - full.score;
      return ` (Δ ${(delta >= 0 ? "+" : "") + delta.toFixed(2)})`;
    };
    steps.push(
      doneStep(
        `holdout-${index + 1}`,
        `Hold-out: ${titleName}`,
        `without ${titleName}'s ${dropped} tag(s): named ${fmtFit(hypFull)} → ${fmtFit(hypRed)}${deltaOf(hypFull, hypRed)}, top ${fmtFit(topFull)} → ${fmtFit(topRed)}${deltaOf(topFull, topRed)}`,
      ),
    );
    // The round as the fragility test reads it: the named audience and
    // the field's best, full set against the same reduced set.
    holdOutRounds.push({
      titleName,
      droppedTags: dropped,
      namedFull: judgedScore(hypFull),
      namedReduced: judgedScore(hypRed),
      fieldFull: judgedScore(topFull),
      fieldReduced: judgedScore(topRed),
    });
  });

  // Pitch-aware comparison field, decided once scores exist. The title
  // filter (same overlap rule as rivals) still applies to the hardcoded
  // controls; no named audience means nothing to compare against, so
  // all stay eligible. Never lets the field vanish: when every control
  // is too close, the full set comes back.
  const controlEligibility =
    hypothesis === null
      ? {
          eligible: controlCached.controls,
          excluded: [],
          filtered: false,
          fellBack: false,
        }
      : eligibleControls(hypothesis, controlCached.controls);
  const farScore: FitScore | null =
    farTastes.length === 0
      ? null
      : scoreAllWeighted(farTastes, flowWeightedTags)[0];
  const farMeasured = farScore !== null && !isUnjudgeable(farScore);
  const lineSource = farMeasured
    ? "line from strangers baseline"
    : "strangers unmeasured, other-genre ceiling";
  const flowControlsBase = controlCached.fromCache
    ? `${controlCached.controls.length} from cache, 0 Qloo calls`
    : `${controlCached.controls.length} built, ${controlCached.droppedControls.length} dropped`;
  const flowControlsDetail = controlEligibility.filtered
    ? `${flowControlsBase}, ${controlEligibility.excluded.length} excluded as too close (shared titles), ${lineSource}`
    : controlEligibility.fellBack
      ? `${flowControlsBase}, overlap filter fell back (all too close to hypothesis), ${lineSource}`
      : `${flowControlsBase}, ${lineSource}`;
  steps.push(
    doneStep(
      "controls",
      "Other-genre comparison field",
      flowControlsDetail,
      controlCached.calls[0]?.id,
    ),
  );

  const eligibleControlIds = new Set(
    controlEligibility.eligible.map((c) => c.id),
  );
  const verdictControlScores =
    farMeasured && farScore !== null
      ? [farScore]
      : controlEligibility.filtered
        ? controlScores.filter((s) => eligibleControlIds.has(s.audienceId))
        : controlScores;
  const verdict = decideVerdict({
    hypothesisId: "hyp",
    scores: contenderScores,
    controlScores: verdictControlScores,
    coverage,
  });
  // §6.6/§6.7: the fragility guard reads the hold-out rounds above.
  // A fragile named audience cannot read Strong fit, so the verdict is
  // capped at Mixed fit — with the reason (which title, what it did)
  // in the ledger, the brief and the result card. The ranking, the
  // scores and the reach plan stay as measured.
  const fragility = assessFragility({
    rounds: holdOutRounds,
    verdict,
    hypothesisId: "hyp",
  });
  const cappedVerdict = applyFragilityCap(verdict, fragility);
  if (fragility.fragile) {
    steps.push(doneStep("fragility", "Fragility guard", fragility.note));
  }
  steps.push(
    doneStep(
      "verdict",
      "The verdict",
      `${cappedVerdict.verdict}, top ${cappedVerdict.topAudienceId ?? "none"} (${lineSource})`,
    ),
  );

  // §8: the check runs on the assembled output, never a literal. This
  // first pass covers the chart rows and every scoring tag; the final
  // pass after reach folds in the card's entity ids.
  const preReachTitleIds = audienceTitleIds([
    hypothesis ?? idleHypothesis,
    ...discovered,
    ...controlCached.controls,
  ]);
  const preReachTagIds = [
    ...poolTags.map((entry) => entry.tag.qlooTagId),
    ...bridgeWtags.map((entry) => entry.tag.qlooTagId),
  ];
  const preReachGrounding = mergeGrounding(
    checkGrounding(
      preReachTitleIds,
      preReachTagIds,
      [...knownTitleIds],
      [...knownTagIds],
    ),
    [],
    strippedTagIds,
  );

  const result: PipelineResult = {
    input: baseInput,
    hypothesis: hypothesis ?? idleHypothesis,
    rivals: discovered,
    controls: controlCached.controls,
    tags: poolTags.map((entry) => entry.tag),
    notFoundWords,
    coverage,
    scores: [
      ...contenderScores,
      ...controlScores,
      ...(farScore === null ? [] : [farScore]),
    ],
    verdict: cappedVerdict,
    grounding: preReachGrounding,
    calls,
    steps,
    // The displayed ceiling follows the same set as the verdict: the
    // strangers baseline when measured, else the title-eligible
    // controls — never an excluded control.
    ceilingControlIds:
      farMeasured && farScore !== null
        ? [farScore.audienceId]
        : controlEligibility.eligible.map((c) => c.id),
  };

  // Reach (step 7): only when something beats the ceiling. Interests
  // come from already-fetched taste tags (zero calls, Package A2); the
  // other four slots use the existing related fetch.
  let reachInput: FlowReachInput = {};
  if (cappedVerdict.clearsControl) {
    const relatedByAudienceId: Record<
      string,
      Awaited<ReturnType<typeof fetchRelated>>
    > = {};
    // §6.8: only an audience that clears the line gets a plan. A
    // capped verdict (fragility) is Mixed by fiat, so its runner-up —
    // which never cleared the line — gets none and the run spends no
    // extra call on it.
    const judgeableLine = verdictControlScores.filter(
      (score) => !isUnjudgeable(score),
    );
    const verdictCeiling =
      judgeableLine.length === 0
        ? null
        : judgeableLine.reduce((best, score) => Math.max(best, score.score), 0);
    const targets = reachTargets(
      cappedVerdict,
      result.scores,
      contenders,
      verdictCeiling,
    );
    const tastesByAudienceId: Record<string, AudienceTastes | undefined> = {};
    const tastesCallIdsByAudienceId: Record<string, string | undefined> = {};
    const reachCalls: QlooCall[] = [];
    const excludeIds = contenders.flatMap((a) => a.titles.map((t) => t.qlooId));
    const relatedLists = await Promise.all(
      targets.map((audience) => fetchRelated(audience, excludeIds)),
    );
    targets.forEach((audience, index) => {
      relatedByAudienceId[audience.id] = relatedLists[index] ?? [];
      for (const group of relatedLists[index] ?? []) {
        if (group.call !== null) reachCalls.push(group.call);
      }
      tastesByAudienceId[audience.id] = tasteById.get(audience.id);
      tastesCallIdsByAudienceId[audience.id] =
        (relatedLists[index] ?? []).find((g: RelatedResult) => g.call !== null)
          ?.call?.id ?? tasteCalls[0]?.id;
    });
    calls.push(...reachCalls);
    steps.push(
      doneStep(
        "reach",
        "Where to find them",
        `${targets.length} audience(s), interests from cached taste tags`,
        reachCalls[0]?.id,
      ),
    );
    result.calls = calls;
    reachInput = {
      relatedByAudienceId,
      tastesByAudienceId,
      tastesCallIdsByAudienceId,
      reachCalls,
    };
  }

  // §8/§10 #1: the check covers the reach card too. Related entities came
  // straight from /v2/insights, so they join the known set; the output
  // set is what the assembled result will actually display.
  for (const id of relatedEntityIds(reachInput.relatedByAudienceId)) {
    knownTitleIds.add(id);
  }
  const finalTitleIds = [
    ...new Set([
      ...audienceTitleIds([
        result.hypothesis,
        ...result.rivals,
        ...result.controls,
      ]),
      ...relatedEntityIds(reachInput.relatedByAudienceId),
    ]),
  ];
  const finalTagIds = [
    ...new Set([
      ...result.tags.map((tag) => tag.qlooTagId),
      ...bridgeWtags.map((entry) => entry.tag.qlooTagId),
      // Reach interests are displayed tag names, so their ids belong in
      // the checked set too. They come from the same fetched tastes, so
      // this is a no-op today and a guard if the card ever gains ids.
      ...Object.values(reachInput.tastesByAudienceId ?? {}).flatMap((tastes) =>
        tastes === undefined
          ? []
          : interestsFromTastes(tastes).map((item) => item.tagId),
      ),
    ]),
  ];
  const knownTitleSet = new Set(knownTitleIds);
  const grounding = mergeGrounding(
    checkGrounding(
      finalTitleIds,
      finalTagIds,
      [...knownTitleIds],
      [...knownTagIds],
    ),
    [],
    strippedTagIds,
  );

  // A failed check never leaves the id on screen: strip ungrounded
  // titles from every row and names from the reach card. Tags were
  // already stripped before scoring, so scores stay consistent.
  if (!grounding.ok) {
    const groundedHypothesis = groundAudiences(
      [result.hypothesis],
      knownTitleSet,
    );
    result.hypothesis = groundedHypothesis.kept[0] ?? result.hypothesis;
    result.rivals = groundAudiences(result.rivals, knownTitleSet).kept;
    result.controls = groundAudiences(result.controls, knownTitleSet).kept;
    result.tags = result.tags.filter((tag) => knownTagSet.has(tag.qlooTagId));
    const groundedReach = groundRelated(
      reachInput.relatedByAudienceId,
      knownTitleSet,
    );
    reachInput = {
      ...reachInput,
      relatedByAudienceId: groundedReach.byAudienceId,
    };
  }
  result.grounding = grounding;

  const removedIds = [
    ...grounding.ungroundedTitles,
    ...grounding.ungroundedTags,
  ];
  const shown = removedIds.slice(0, 3).join(", ");
  steps.push(
    doneStep(
      "grounding",
      "Grounding check",
      removedIds.length === 0
        ? `${finalTitleIds.length} title/entity ids, ${finalTagIds.length} tags, all from this run's Qloo results`
        : `${removedIds.length} ungrounded id(s) removed — ${shown}${removedIds.length > 3 ? ` +${removedIds.length - 3} more` : ""}`,
    ),
  );

  return {
    result: toFlowResult(result, reachInput, tagSourcesOf(poolTags), fragility),
    steps,
    stopped: false,
  };
}
