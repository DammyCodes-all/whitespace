/**
 * Whitespace shared contracts. FROZEN after Day 1.
 *
 * Do not extend this file without an explicit unfreeze note in
 * docs/build-tracker.md. Day 2 to Day 10 build against these shapes
 * with fixtures when live Qloo is unavailable.
 *
 * Source of truth: docs/product-spec.md §7 (who does what), §6.6
 * (zero vs no-data), §6.7 (verdict), §6.12 (evidence trace), §11
 * (ranks only, no counts).
 */

/** §6.1: the kind of work the pitch describes. */
export type WorkType = "film" | "music" | "book" | "game";

/** §6.1: user input. Long pitches trim to ~300 words at the boundary (Day 2). */
export interface PitchInput {
  pitchText: string;
  workType: WorkType;
  /** §6.1: up to five "nothing like" titles, optional. */
  nothingLike: string[];
}

/**
 * §6.12: every claim links to the Qloo call behind it.
 * The trace is the citation, not the full payload.
 */
export interface QlooCall {
  id: string;
  /** Path only, e.g. "/search" or "/v2/insights". Never includes the key. */
  endpoint: string;
  method: "GET";
  params: Record<string, string>;
  status: number;
  durationMs: number;
  at: string;
  /** True when served from the saved-run store without hitting Qloo. */
  fromCache: boolean;
  /** Bounded, key-free summary of the returned payload for evidence review. */
  responseSummary?: string;
  /**
   * Raw JSON response text as it arrived, never reconstructed. Truncated
   * at `MAX_EVIDENCE_RESPONSE_CHARS` with `responseTruncated` set.
   * Absent when the call failed before a body arrived. Additive optional
   * field — types unfreeze noted in docs/build-tracker.md (Package A).
   */
  responseBody?: string;
  /** True when `responseBody` is a prefix of the real body, not the whole. */
  responseTruncated?: boolean;
}

/** §6.2: a title Qloo resolved. Queries it could not find live in `notFoundTitles`. */
export interface ResolvedTitle {
  query: string;
  qlooId: string;
  name: string;
  /** Qloo entity type, e.g. "urn:entity:movie". */
  type: string;
}

export type AudienceKind = "hypothesis" | "rival" | "control" | "exclusion";

/**
 * §6.2 hypothesis, §6.3 rivals, §6.4 controls, §6.6 exclusion.
 * Titles and numbers come only from Qloo; the AI writes names/reasons (§7).
 */
export interface Audience {
  id: string;
  kind: AudienceKind;
  name: string;
  /** §6.3: one-sentence reason for rival readings only. */
  reason?: string;
  titles: ResolvedTitle[];
  /** §6.2: queries Qloo could not find, dropped and listed as "not found". */
  notFoundTitles: string[];
}

/**
 * §6.5: a pitch word that matched a real Qloo tag.
 * Unmatched words are "no data" and never enter scoring.
 */
export interface PitchTag {
  /** Word from the pitch, e.g. "slow-burn". */
  tag: string;
  /** Real Qloo tag id, e.g. "urn:tag:genre:media:slow_burn". */
  qlooTagId: string;
  /** §6.6: pinned must-haves count double. */
  pinned: boolean;
}

/**
 * §6.6: fit score 0 to 1, rank-normalized so long and short
 * audience lists compare fairly.
 *
 * zeroTags vs noDataTags is load-bearing. A tag missing from a long
 * list is zero (audience does not over-index). A tag missing from a
 * short or failed list is no-data (left out for that audience).
 */
export interface FitScore {
  audienceId: string;
  score: number;
  matchedTags: string[];
  /** Counted as zero in scoring. */
  zeroTags: string[];
  /** Left out of scoring for this audience. Never renders as a number. */
  noDataTags: string[];
}

/** §6.7 verdict table. */
export type Verdict = "Strong" | "Mixed" | "Weak" | "Inconclusive";

/**
 * §6.7 (fix 1, 2026-10-19): what happened when the winning audience was
 * rescored on the pitch-grounded tags alone, with its own title gifts
 * removed.
 * - `confirmed`: it still leads without them — the fit is real.
 * - `leans`: it stops leading (or a rival takes over), so the verdict
 *   cannot be Strong.
 * - `unverified`: too few pitch-grounded tags were left to judge, so
 *   the run abstains instead of guessing.
 */
export type SelfFitStatus = "confirmed" | "leans" | "unverified";

export interface VerdictResult {
  verdict: Verdict;
  topAudienceId: string | null;
  /**
   * Fit-score gap between first and second audience. Null when no other
   * audience was measured — an unknown gap, never a fabricated 0.
   */
  marginTopVsSecond: number | null;
  /** Fit-score gap between top audience and the strongest comparison. */
  marginTopVsControl: number;
  clearsControl: boolean;
  /** True when top is not the hypothesis and beats it clearly (§6.7). */
  surprise: boolean;
  /**
   * §6.7: judgeable comparison audiences the top beat, out of the
   * measured field. Absent when the field was unusable.
   */
  controlsBeaten?: { beaten: number; total: number };
  /** §6.7 self-fit gate, when it ran. Absent when it did not apply. */
  selfFit?: SelfFitStatus;
  /**
   * Day 9 S: why an Inconclusive verdict was returned (case limits
   * section, §6.10). Absent on decisive verdicts. Additive optional
   * field — types unfreeze noted in docs/build-tracker.md.
   * Day 11 S: "scope" added — the pitch is a tool/app, not a creative
   * work (§3), so taste data cannot judge it. Unfreeze noted in
   * docs/build-tracker.md alongside Day 9.
   * Repeat probe 2026-10-12: "no-signal" added — no control audience
   * matched any pitch tag, so the baseline is uninformative (a
   * degraded Qloo window reads exactly this way). Unfreeze noted in
   * docs/build-tracker.md.
   * 2026-10-19 (fixes 1 and 7): "coverage" replaced by "pool-thin"
   * (sufficiency is the pooled scoring set, not the pitch-word match
   * rate) and "self-fit" added (the win needs the audience's own title
   * gifts and could not be checked without them). Unfreezes noted in
   * docs/build-tracker.md.
   */
  inconclusiveReason?:
    | "pool-thin"
    | "nodata"
    | "top-unjudgeable"
    | "empty"
    | "scope"
    | "no-control"
    | "no-signal"
    | "self-fit";
}

/** §8 grounding check: every title/tag in output came from Qloo. */
export interface GroundingResult {
  ok: boolean;
  ungroundedTitles: string[];
  ungroundedTags: string[];
}

/** §5.4: one visible protocol step on the run page. */
export type RunStepStatus = "pending" | "active" | "done";

export interface RunStep {
  id: string;
  label: string;
  status: RunStepStatus;
  /** Mono counts, e.g. "21 checked, 19 found, 2 not found". */
  detail?: string;
  /** §6.12: opens the Qloo call behind this step. */
  callId?: string;
}

/**
 * The join point. Owned by S in src/lib/pipeline/run.ts (Day 6 seam).
 * Q exposes fetch functions, U calls this. Day 1 declares the shape only.
 */
export interface PipelineResult {
  input: PitchInput;
  hypothesis: Audience;
  rivals: Audience[];
  controls: Audience[];
  tags: PitchTag[];
  /** Share of suggested words that matched a real Qloo tag (§6.5). */
  coverage: number;
  scores: FitScore[];
  verdict: VerdictResult;
  grounding: GroundingResult;
  calls: QlooCall[];
  steps: RunStep[];
  /**
   * Words the tag search could not match (§6.5). Never enter scoring;
   * shown as "not found in Qloo". Additive optional field — absent on
   * older saved runs, which the adapter reads as []. Types unfreeze
   * noted in docs/build-tracker.md (Package A).
   */
  notFoundWords?: string[];
  /**
   * Controls that set the displayed ceiling (the strangers-baseline id
   * when strangers are measured, else the title-eligible control ids).
   * The verdict uses the same set, so the ink line can never disagree
   * with the baseline the verdict beat. Additive optional field —
   * absent on older saved runs, which the adapter reads as "all
   * controls".
   */
  ceilingControlIds?: string[];
}

export type RunPipeline = (input: PitchInput) => Promise<PipelineResult>;
