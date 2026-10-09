/**
 * Day 8 S: change proposal orchestration. Owned by S.
 *
 * Records the bar, asks a proposal mechanism for a changed pitch, then
 * rescores and judges. The proposal function receives the constraint
 * and the gaps — never the bar — so no implementation can grade its
 * own homework (§6.9). Tests inject a fixed rewritten pitch; production
 * wires the real mechanism (deterministic edit now, LLM upgrade later)
 * with no change here.
 *
 * Server-only: resolves tags and refetches tastes through Qloo calls.
 * Never throws on Qloo failure: fetch/taste misses resolve to a
 * withheld change, and only programming errors propagate.
 */

import { TAG_LABELS } from "../fixtures/tag-labels.ts";
import type { ChangeBar, ChangeCheck } from "../policy/change.ts";
import { checkChange, MIN_RISE } from "../policy/change.ts";
import { reportCoverage } from "../policy/grounding.ts";
import { CONTROL_MARGIN } from "../policy/verdict.ts";
import { resolvePitchTags } from "../qloo/resolve-tags.ts";
import { fetchAllAudienceTastes } from "../qloo/tastes.ts";
import type { AudienceTastes } from "../scoring/fit.ts";
import { scoreAll } from "../scoring/fit.ts";
import type { GapItem } from "../scoring/gaps.ts";
import { findGaps, labelsForTastes } from "../scoring/gaps.ts";
import type {
  Audience,
  FitScore,
  PipelineResult,
  PitchTag,
  QlooCall,
  WorkType,
} from "../types.ts";

/**
 * Changed-pitch proposer. Receives the constraint and the research
 * leads — never the bar. Return the full rewritten pitch text.
 */
export type ProposeFn = (
  constraint: string,
  gaps: GapItem[],
) => Promise<string>;

export interface ChangeDeps {
  fetchTastes?: (audiences: Audience[]) => Promise<{ all: AudienceTastes[] }>;
  resolveTags?: (
    words: string[],
    workType?: WorkType,
  ) => Promise<{
    tags: PitchTag[];
    notFoundWords: string[];
    calls: QlooCall[];
  }>;
}

export interface ChangedRun {
  constraint: string;
  proposedPitch: string;
  /** Gap labels the proposal actually used. */
  usedGapLabels: string[];
  bar: ChangeBar;
  check: ChangeCheck;
  /** Null when unrunnable: no judged top means no baseline to rise from. */
  after: FitScore | null;
  coverageAfter: number;
  calls: QlooCall[];
}

/** Gap labels the proposal text actually mentions (case-insensitive).
 * Coarse by design: substring matching can over-match ("space" inside
 * unrelated prose). Harmless here because the grounding check resolves
 * every claimed word through real tag lookup — a false positive adds a
 * real, measured tag, never a fake score. The LLM upgrade must replace
 * this with proper attribution, not a smarter substring.
 */
function usedGaps(proposed: string, gaps: GapItem[]): GapItem[] {
  const text = proposed.toLowerCase();
  return gaps.filter((g) => text.includes(g.label.toLowerCase()));
}

function mergeTags(current: PitchTag[], fresh: PitchTag[]): PitchTag[] {
  const seen = new Set(current.map((t) => t.qlooTagId));
  const merged = [...current];
  for (const tag of fresh) {
    if (!seen.has(tag.qlooTagId)) {
      seen.add(tag.qlooTagId);
      merged.push(tag);
    }
  }
  return merged;
}

/**
 * Propose a constrained rewrite and judge it. Records the bar before
 * `propose` runs; withholds (with the named reason) on any failed
 * condition, on an unrunnable baseline, or on any Qloo miss along the
 * way. Programming errors propagate.
 */
export async function proposeChange(
  result: PipelineResult,
  constraint: string,
  propose: ProposeFn,
  deps: ChangeDeps = {},
  originalNotFoundWords: string[] = [],
): Promise<ChangedRun> {
  if (typeof window !== "undefined") {
    throw new Error(
      "proposeChange is server-only and cannot run in the browser.",
    );
  }
  const bar: ChangeBar = { minRise: MIN_RISE, requireControl: true };
  const calls: QlooCall[] = [];
  const unrunnable = (
    proposedPitch: string,
    usedGapLabels: string[],
  ): ChangedRun => ({
    constraint,
    proposedPitch,
    usedGapLabels,
    bar,
    check: { accepted: false, failedCondition: "rise", before: 0, after: 0 },
    after: null,
    coverageAfter: result.coverage,
    calls,
  });

  const top = [result.hypothesis, ...result.rivals].find(
    (a) => a.id === result.verdict.topAudienceId,
  );
  const before =
    result.scores.find((s) => s.audienceId === result.verdict.topAudienceId) ??
    null;
  if (!top || !before || result.verdict.verdict === "Inconclusive") {
    return unrunnable("", []);
  }

  const fetchTastes = deps.fetchTastes ?? fetchAllAudienceTastes;
  const tasted = await fetchTastes([top]);
  const tastes = tasted.all.find((t) => t.audienceId === top.id) ?? null;
  const labels = tastes ? labelsForTastes(tastes, TAG_LABELS) : TAG_LABELS;
  const gaps = tastes ? findGaps(tastes, result.tags, labels) : [];

  const proposedPitch = await propose(constraint, gaps);
  const used = usedGaps(proposedPitch, gaps);
  const usedGapLabels = used.map((g) => g.label);

  const resolveTags = deps.resolveTags ?? resolvePitchTags;
  const tagRes = await resolveTags(usedGapLabels, result.input.workType);
  calls.push(...tagRes.calls);
  const isGrounded = tagRes.notFoundWords.length === 0;

  const afterTags = mergeTags(result.tags, tagRes.tags);
  const coverageReport = reportCoverage(
    afterTags.map((t) => t.tag),
    [...originalNotFoundWords, ...tagRes.notFoundWords],
  );
  const coverageAfter = coverageReport.coverage;

  const after =
    tastes === null ? null : (scoreAll([tastes], afterTags)[0] ?? null);
  if (!tastes || !after) {
    return unrunnable(proposedPitch, usedGapLabels);
  }

  const controlIds = new Set(result.controls.map((c) => c.id));
  const controlBest = result.scores
    .filter((s) => controlIds.has(s.audienceId))
    .reduce((best, s) => Math.max(best, s.score), 0);
  const clearsControl =
    controlIds.size === 0 ? false : after.score - controlBest >= CONTROL_MARGIN;

  return {
    constraint,
    proposedPitch,
    usedGapLabels,
    bar,
    check: checkChange(
      bar,
      before,
      after,
      result.coverage,
      coverageAfter,
      isGrounded,
      clearsControl,
    ),
    after,
    coverageAfter,
    calls,
  };
}
