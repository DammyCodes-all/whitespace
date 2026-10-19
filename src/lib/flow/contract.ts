/**
 * Package A: adapter from the frozen `PipelineResult` to the new flow
 * contract. UI reads these types only — never `FitScore.score` directly,
 * so a placeholder 0 can never reach a bar or a reach list.
 *
 * Contract deltas vs the brief (proposed in writing, 2026-10-10):
 * - `verdict` is lowercase (`strong`…); the pipeline's `Strong`… is
 *   mapped, not changed.
 * - `reach` is an ARRAY (`FlowReach[] | null`): step 7 wants both
 *   audiences on a mixed verdict. `null` means nothing beats the ceiling (say
 *   so, show no reach plan); `[]` means something beats it but no reach
 *   data was supplied yet.
 * - `evidenceId` and `score` are nullable: no call / no data is its own
 *   state, never a zero or a dangling id.
 * - `titles` ride on each audience (resolved entities for re-checks).
 * - `gaps` carry the §6.8 gap groups for the reach targets, computed
 *   from already-fetched taste tags (zero new calls).
 * - `evidence` entries carry `status` + `fromCache` beside request and
 *   response, so cached and failed calls render honestly.
 * - `qlooCalls` usage totals (Package A4) ride along for the run header.
 * - `interests` derive from already-fetched taste tags (zero extra
 *   calls); other slots map from `RelatedResult`s passed in.
 *
 * Spec ref: §6.5 (matched vs not-found tags), §6.6/§10 #4 (not-measured
 * is a state, never zero), §6.7 (verdict + ceiling), §6.8 (reach only
 * past the ceiling), §6.12 (evidence per claim), §11 (ranks only).
 */

import { CLOSE_CALL_GAP } from "../config.ts";
import { selectReachTargets } from "../demo/reach-targets.ts";
import { interestsFromTastes } from "../qloo/interests.ts";
import type { RelatedResult } from "../qloo/related.ts";
import type { AudienceTastes } from "../scoring/fit.ts";
import { isUnjudgeable } from "../scoring/fit.ts";
import type { GapItem } from "../scoring/gaps.ts";
import { countUnlabeled, findGaps, labelsForTastes } from "../scoring/gaps.ts";
import type {
  Audience,
  FitScore,
  GroundingResult,
  PipelineResult,
  QlooCall,
  WorkType,
} from "../types.ts";

export interface FlowTag {
  label: string;
  qlooId?: string;
  status: "matched" | "not_found";
  /**
   * Where the tag came from: pitch words or one named title's tastes.
   * Absent on older runs, which were pitch-only and read as pitch.
   */
  source?: FlowTagSource;
  /**
   * Qloo's own display name when it differs from `label`, so a
   * semantic match stays legible (`lonely` scored as `Loneliness`).
   * Absent means the names agree — which is also how older saved runs
   * read, and was correct for them. `label` is never replaced.
   */
  qlooName?: string;
}

/**
 * Pool provenance for one tag. Pitch tags carry the word the user
 * confirmed; title tags carry the Qloo entity behind the tastes they
 * came from, so chips badge `[pitch]` vs `[Title name]` and hold-out
 * rounds can drop one title's gifts.
 */
export type FlowTagSource = "pitch" | { titleId: string; titleName: string };

export type FlowRole = "named" | "rival" | "control";

export interface FlowAudienceScore {
  id: string;
  name: string;
  role: FlowRole;
  /** Null when Qloo returned too little to judge. Never a placeholder. */
  score: number | null;
  tagHits: string[];
  /** Null when no Qloo call produced this value. */
  evidenceId: string | null;
  /** Resolved title entities behind this audience (for re-checks). */
  titles: Array<{ qlooId: string; name: string }>;
}

/**
 * §6.8 gaps: what a winning audience loves that the pitch does not
 * mention yet. Computed from already-fetched taste tags — zero new
 * Qloo calls. `hasTastes` false means unknown loves, never zero gaps.
 */
export interface FlowGapGroup {
  audienceId: string;
  audienceName: string;
  gaps: GapItem[];
  unlabeledCount: number;
  hasTastes: boolean;
}

export type FlowVerdict = "strong" | "mixed" | "weak" | "inconclusive";

export interface FlowReachItem {
  name: string;
  /** Qloo's English short description, or null when it supplied none. */
  description?: string | null;
  /** 1-based Qloo affinity rank. Ranks only (§11). */
  rank: number;
  evidenceId: string | null;
}

/** The four fixed headings, plus places only when measured. */
export type ReachSlot =
  | "interests"
  | "people"
  | "podcasts"
  | "brands"
  | "places";

/**
 * Conversational copy for one audience. The AI writes it from the
 * measured items and gaps; a deterministic draft fills any section the
 * model cannot ground. Null means no items, never empty prose.
 */
export type ReachSections = Record<ReachSlot, string | null>;

export interface FlowReach {
  audienceId: string;
  audienceName: string;
  interests: FlowReachItem[];
  people: FlowReachItem[];
  podcasts: FlowReachItem[];
  brands: FlowReachItem[];
  places: FlowReachItem[];
  /** Attached by the run route; absent on older saved results. */
  prose?: ReachSections;
}

export interface FlowEvidence {
  request: { endpoint: string; params: Record<string, string> };
  /** Real response bytes (possibly a marked prefix) or the summary. */
  response: string;
  truncated: boolean;
  status: number;
  fromCache: boolean;
  /** True when no request ran (no Qloo key): a placeholder, never data. */
  mock?: boolean;
}

export interface FlowQlooUsage {
  network: number;
  cached: number;
  total: number;
  /** Placeholder traces (no key): counted in `total`, never `network`. */
  mock?: number;
}

export interface FlowResult {
  pitch: string;
  type: WorkType;
  tags: FlowTag[];
  audiences: FlowAudienceScore[];
  /**
   * Strongest judgeable comparison audience (other-genre field plus
   * strangers). Null when no comparison could be judged.
   */
  ceiling: number | null;
  verdict: FlowVerdict;
  surprise: boolean;
  reach: FlowReach[] | null;
  /** Gap groups for the reach targets; [] when nothing beat the ceiling. */
  gaps: FlowGapGroup[];
  evidence: Record<string, FlowEvidence>;
  qlooCalls: FlowQlooUsage;
  /**
   * §8 grounding result for this run. Absent on older saved runs, which
   * predate the runtime check. `ok: false` means ids were found outside
   * Qloo's results and stripped before display.
   */
  grounding?: GroundingResult;
}

/** Reach data fetched outside the pipeline, keyed by audience id. */
export interface FlowReachInput {
  relatedByAudienceId?: Record<string, RelatedResult[]>;
  tastesByAudienceId?: Record<string, AudienceTastes | undefined>;
  /** Call ids of per-audience taste refetches (reach assembly). */
  tastesCallIdsByAudienceId?: Record<string, string | undefined>;
  reachCalls?: QlooCall[];
}

function roleFor(audience: Audience): FlowRole {
  if (audience.kind === "hypothesis") return "named";
  if (audience.kind === "control") return "control";
  return "rival";
}

function verdictFor(
  verdict: PipelineResult["verdict"]["verdict"],
): FlowVerdict {
  switch (verdict) {
    case "Strong":
      return "strong";
    case "Mixed":
      return "mixed";
    case "Weak":
      return "weak";
    default:
      return "inconclusive";
  }
}

function evidenceOf(call: QlooCall): FlowEvidence {
  return {
    request: { endpoint: call.endpoint, params: { ...call.params } },
    response: call.responseBody ?? call.responseSummary ?? "not captured",
    truncated: call.responseTruncated ?? call.responseBody === undefined,
    status: call.status,
    fromCache: call.fromCache,
    mock: call.mock === true,
  };
}

function relatedSlot(
  related: RelatedResult[] | undefined,
  kind: RelatedResult["kind"],
): FlowReachItem[] {
  const group = related?.find((r) => r.kind === kind);
  if (!group || group.call === null) return [];
  return group.items.map((item) => ({
    name: item.name,
    description: item.description,
    rank: item.affinityRank,
    evidenceId: group.call?.id ?? null,
  }));
}

/** The only scorer-to-bar path. Unjudgeable fits become null, never 0. */
export function scoreForBar(fit: FitScore): number | null {
  return isUnjudgeable(fit) ? null : fit.score;
}

/**
 * Guard used by the results view and asserted by
 * `flow-screen.test.ts`: no placeholder 0 reaches a bar or a reach
 * list. The discriminated null in `FlowAudienceScore` is the signal:
 * a row that survives `score !== null` was judged, so its zero is
 * honest data rather than a stand-in for missing data.
 */
export function reachableScores(result: FlowResult): FlowAudienceScore[] {
  return result.audiences.filter((a) => a.score !== null);
}

/** True when the audience was never judged, so its 0 is a placeholder. */
export function isPlaceholderScore(audience: FlowAudienceScore): boolean {
  return audience.score === null;
}

/**
 * Bar rows for the ranked chart: measured audiences only, best first.
 * The control ceiling is NOT a row — it renders as the solid ink line.
 */
export interface FlowBarRow {
  id: string;
  name: string;
  role: FlowRole;
  score: number;
  tagHits: string[];
  evidenceId: string | null;
}

export function barRows(result: FlowResult): FlowBarRow[] {
  return result.audiences
    .filter((a) => a.score !== null && a.role !== "control")
    .map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      score: a.score as number,
      tagHits: a.tagHits,
      evidenceId: a.evidenceId,
    }))
    .sort((x, y) => y.score - x.score);
}

/**
 * Display-only close-call flag (§6.7): a judged Strong/Weak verdict
 * whose top score sits within CLOSE_CALL_GAP of the control line.
 * Mixed already says "close pair", Inconclusive says nothing decisive,
 * and a null ceiling has no line to be near — all three are never
 * close calls. The verdict itself never changes here.
 */
export function isCloseCall(result: FlowResult): boolean {
  if (result.verdict !== "strong" && result.verdict !== "weak") return false;
  if (result.ceiling === null) return false;
  const top = barRows(result)[0]?.score ?? null;
  if (top === null) return false;
  return Math.abs(top - result.ceiling) < CLOSE_CALL_GAP;
}

/**
 * Pure conversion. `reach` is null unless the verdict clears control;
 * reach inputs are mapped only for measured targets, so no placeholder
 * 0 reaches a reach list.
 */
export function toFlowResult(
  pipeline: PipelineResult,
  reachInput: FlowReachInput = {},
  tagSources: Record<string, FlowTagSource> = {},
): FlowResult {
  const stepCallId = (id: string): string | null =>
    pipeline.steps.find((s) => s.id === id)?.callId ?? null;
  const scoresById = new Map(pipeline.scores.map((s) => [s.audienceId, s]));

  const evidenceIdFor = (audience: Audience): string | null => {
    if (audience.id === "concept") return stepCallId("concept");
    if (audience.kind === "hypothesis") return stepCallId("hypothesis");
    if (audience.kind === "control")
      return stepCallId("controls") ?? stepCallId("tastes");
    return stepCallId("rivals");
  };

  const toScore = (audience: Audience): FlowAudienceScore => {
    const fit = scoresById.get(audience.id);
    return {
      id: audience.id,
      name: audience.name,
      role: roleFor(audience),
      score: fit ? scoreForBar(fit) : null,
      tagHits: fit && !isUnjudgeable(fit) ? fit.matchedTags : [],
      evidenceId: evidenceIdFor(audience),
      titles: audience.titles.map((t) => ({
        qlooId: t.qlooId,
        name: t.name,
      })),
    };
  };

  const contenders = [pipeline.hypothesis, ...pipeline.rivals];
  const audiences: FlowAudienceScore[] = [
    ...contenders.map(toScore),
    ...pipeline.controls.map(toScore),
  ];

  let ceiling: number | null = null;
  // The ink line: the strongest judgeable member of the field the
  // verdict compared against (strangers plus title-eligible controls).
  // Absent on older saved runs, which read as all controls (the legacy
  // behavior).
  const ceilingIds =
    pipeline.ceilingControlIds === undefined
      ? null
      : new Set(pipeline.ceilingControlIds);
  if (ceilingIds !== null) {
    for (const id of ceilingIds) {
      const fit = scoresById.get(id);
      if (fit && !isUnjudgeable(fit)) {
        ceiling = ceiling === null ? fit.score : Math.max(ceiling, fit.score);
      }
    }
  } else {
    for (const control of pipeline.controls) {
      const fit = scoresById.get(control.id);
      if (fit && !isUnjudgeable(fit)) {
        ceiling = ceiling === null ? fit.score : Math.max(ceiling, fit.score);
      }
    }
  }

  const tags: FlowTag[] = [
    ...pipeline.tags.map((t) => ({
      label: t.tag,
      qlooId: t.qlooTagId,
      status: "matched" as const,
      source: tagSources[t.qlooTagId] ?? ("pitch" as FlowTagSource),
    })),
    ...(pipeline.notFoundWords ?? []).map((word) => ({
      label: word,
      status: "not_found" as const,
      source: "pitch" as FlowTagSource,
    })),
  ];

  let reach: FlowReach[] | null = null;
  if (pipeline.verdict.clearsControl) {
    reach = [];
    const targets = selectReachTargets(
      pipeline.verdict,
      pipeline.scores,
      contenders,
    );
    for (const target of targets) {
      const fit = scoresById.get(target.id);
      if (!fit || isUnjudgeable(fit)) continue;
      const related = reachInput.relatedByAudienceId?.[target.id];
      const tastes = reachInput.tastesByAudienceId?.[target.id];
      const tastesCallId =
        tastes && tastes.failed !== true
          ? (reachInput.tastesCallIdsByAudienceId?.[target.id] ??
            stepCallId("tastes"))
          : null;
      reach.push({
        audienceId: target.id,
        audienceName: target.name,
        interests:
          tastes && tastes.failed !== true
            ? interestsFromTastes(tastes).map((i) => ({
                name: i.name,
                rank: i.rank,
                evidenceId: tastesCallId,
              }))
            : [],
        people: relatedSlot(related, "person"),
        podcasts: relatedSlot(related, "podcast"),
        brands: relatedSlot(related, "brand"),
        places: relatedSlot(related, "place"),
      });
    }
  }

  const evidence: Record<string, FlowEvidence> = {};
  for (const call of [...pipeline.calls, ...(reachInput.reachCalls ?? [])]) {
    evidence[call.id] = evidenceOf(call);
  }

  // §6.8 gaps for the same targets the reach plan serves, from the
  // already-fetched taste tags (zero new calls). Unknown loves stay
  // unknown: hasTastes false renders the no-data state, never an
  // empty claim.
  let gaps: FlowGapGroup[] = [];
  if (pipeline.verdict.clearsControl) {
    const targets = selectReachTargets(
      pipeline.verdict,
      pipeline.scores,
      contenders,
    );
    gaps = targets.map((target) => {
      const tastes = reachInput.tastesByAudienceId?.[target.id];
      if (tastes === undefined || tastes.failed === true) {
        return {
          audienceId: target.id,
          audienceName: target.name,
          gaps: [],
          unlabeledCount: 0,
          hasTastes: false,
        };
      }
      const labels = labelsForTastes(tastes, {});
      return {
        audienceId: target.id,
        audienceName: target.name,
        gaps: findGaps(tastes, pipeline.tags, labels),
        unlabeledCount: countUnlabeled(tastes, pipeline.tags, labels),
        hasTastes: true,
      };
    });
  }

  const mock = pipeline.calls.filter((c) => c.mock === true).length;
  const network = pipeline.calls.filter(
    (c) => c.mock !== true && !c.fromCache,
  ).length;
  const cached = pipeline.calls.filter(
    (c) => c.mock !== true && c.fromCache,
  ).length;

  return {
    pitch: pipeline.input.pitchText,
    type: pipeline.input.workType,
    tags,
    audiences,
    ceiling,
    verdict: verdictFor(pipeline.verdict.verdict),
    surprise: pipeline.verdict.surprise,
    reach,
    gaps,
    evidence,
    qlooCalls: { network, cached, total: pipeline.calls.length, mock },
    grounding: pipeline.grounding,
  };
}

/**
 * True when every recorded trace is a keyless placeholder. The result
 * page must not call such a run "live": no request ran and no Qloo data
 * backs it. Older saved runs carry no mock count, so they read false.
 */
export function isMockRun(result: FlowResult): boolean {
  const mock = result.qlooCalls.mock ?? 0;
  return mock > 0 && mock === result.qlooCalls.total;
}
