/**
 * V2 audience-discovery contracts (lean MVP). Owned by S.
 *
 * Side-by-side with v1: `src/lib/types.ts` stays frozen, v1 saved runs
 * keep their meaning. These shapes cover the lean cut agreed after the
 * §8 pilot — two discovery lenses × two categories, overlap-only
 * grouping, `explorations` fallback, plus supporting-lens evidence
 * (§4F: retrieved, flags frozen cores, never creates members),
 * investigation leads (§4G: group-seeded podcasts/people, downstream
 * suggestions only), and grounded post-evidence explanation (§4H:
 * validated words with a deterministic fallback). Detail enrichment,
 * comparison overlay, and server replay are deferred, but their slots
 * exist so later phases extend instead of reinterpret.
 *
 * No Qloo calls, no LLM calls, no scores. Pure data contracts plus the
 * versioned policy constants the orchestrator will enforce.
 *
 * Proposal ref: `docs/pipeline-redesign.md` §§4–5; pilot:
 * `docs/qloo-coverage.md` (V2 capability pilot).
 */

import type { QlooCall } from "../../types.ts";

/** Hardened contracts preserve older results as read-only replay. */
export const PIPELINE_VERSION = "v2-lean.7";

/** Grouping/evidence policy version. Bump when heuristics change. */
export const POLICY_VERSION = "v2-policy.4";

/** Fixed retrieval window per discovery query (pilot-verified). */
export const RETRIEVAL_TAKE = 20;

/** Practical page cap: take=100 returned zero results (pilot). */
export const RETRIEVAL_TAKE_MAX = 50;

/** Near-duplicate group suppression (engineering heuristic, §4E). */
export const JACCARD_THRESHOLD = 0.6;

/** Retain zero to three neighborhoods (§4E). */
export const MAX_NEIGHBORHOODS = 3;

/** Bounded exploration entries per lens (§4E). */
export const EXPLORATION_PER_LENS = 3;

/**
 * Reach policy (§4G, versioned heuristics, not findings): leads are
 * fetched for at most two neighborhoods, seeded by up to three frozen
 * core IDs each, into podcasts and people. Brands/places stay
 * expansion candidates until the core loop proves useful.
 */
export const MAX_REACH_NEIGHBORHOODS = 2;

/** Core seed IDs combined into one multi-interest signal per query. */
export const REACH_SEEDS_PER_GROUP = 3;

/** Leads kept per (neighborhood × category) query, by response order. */
export const MAX_LEADS_PER_QUERY = 3;

/**
 * Comparison overlay policy (§4B, versioned heuristics): at most two
 * creator comparisons, resolved but never pitch aspects, each
 * retrieved once into the reference-shaped category. Overlay entities
 * never feed grouping or counts; they can only yield comp-led
 * exploration when the pitch itself is poorly representable.
 */
export const MAX_COMPARISONS = 2;

/** Single overlay category per comparison (film-pilot reference shape). */
export const V2_OVERLAY_CATEGORY = "urn:entity:movie";

/** Overlay entities shown per comparison, by response order. */
export const OVERLAY_PER_QUERY = 3;

/**
 * Detail-enrichment policy (§8 proviso): when frozen cores exist but
 * no shared descriptor survives, fill tags for at most four tag-less
 * core members via exact-name lookup, then reassess coherence once.
 * Membership never changes; failure stays reference-overlap only.
 */
export const MAX_ENRICHMENT_LOOKUPS = 4;

/** Per-run HTTP attempt ceiling, including retries (§6). */
export const QLOO_ATTEMPT_CEILING = 40;

/** Lean input: the caller provides raw pitch context only. No tags,
 *  rivals, controls, or scores cross this boundary (§5). */
export interface V2Input {
  pitchText: string;
  workType: "film" | "music" | "book" | "game";
  /** Optional creator comparisons: overlay only, never a pitch aspect. */
  comparisons?: string[];
  /** Optional creative contrasts: preserved, never subtracted (§4A). */
  contrasts?: string[];
  /** A correction starts a new version, never a silent rescue (§3). */
  correctionOf?: string | null;
  /** Exact bridges approved by the creator, never positional IDs alone. */
  confirmedAnalogies?: V2ConfirmedAnalogy[];
  /** Reuse the reviewed interpretation on a confirmation-only correction. */
  preparedBrief?: V2PreparedBrief;
}

export interface V2ConfirmedAnalogy {
  aspectId: string;
  facet: V2Aspect["facet"];
  excerpt: string;
  interpretation: string;
  entityId: string;
  entityName: string;
  entityType: string;
  selectedName: string;
  analogy: string;
}

export interface V2PreparedBrief {
  pitchText: string;
  workType: V2Input["workType"];
  brief: V2Brief;
  references: { aspectId: string; candidates: V2ReferenceCandidate[] }[];
}

/** One distinct discovery-relevant pitch aspect (§4A). */
export interface V2Aspect {
  id: string;
  /** subject/premise, theme, tone, or form/experience. */
  facet: "premise" | "theme" | "tone" | "form";
  /** Exact substring of the pitch; code-checked, never paraphrased. */
  excerpt: string;
  interpretation: string;
}

/** Structured brief: interpretation, not a persona (§4A). */
export interface V2Brief {
  interpretation: string;
  aspects: V2Aspect[];
  constraints: string[];
  contrasts: string[];
  /** Distinguishing aspects with no Qloo equivalent. Never hidden. */
  unrepresentable: string[];
}

/** Identity states for a resolved reference candidate (§4B). */
export type V2IdentityState =
  | "resolved"
  | "ambiguous"
  | "not_found"
  | "request_failed";

/**
 * What supports the aspect→reference analogy (§4B). Only the first
 * three make a bridge eligible for corroboration counts; an LLM-only
 * analogy stays explicitly provisional exploration.
 */
export type V2BridgeProvenance =
  | "returned-metadata"
  | "creator-confirmation"
  | "curated-mapping"
  | "llm-provisional";

/** One proposed reference candidate for an aspect (§4B). */
export interface V2ReferenceCandidate {
  name: string;
  /** Own entity type; never inherits the pitch work type. */
  entityType: string;
  analogy: string;
}

/** A frozen reference lens: identity + bridge kept as separate facts. */
export interface V2ReferenceLens {
  aspectId: string;
  candidates: V2ReferenceCandidate[];
  selectedName: string;
  entityId: string | null;
  entityName: string | null;
  entityType: string | null;
  identity: V2IdentityState;
  bridge: V2BridgeProvenance;
  analogy: string;
  /** Lean MVP runs discovery-only; the role slot is frozen for later. */
  role: "discovery" | "supporting";
  /** Inspectable lookup call, when recorded by the live transport. */
  callId?: string;
}

/** True only for bridges allowed into C/X counts (§4B, §4F). */
export function isBridgeEligible(lens: V2ReferenceLens): boolean {
  return (
    lens.identity === "resolved" &&
    lens.entityId !== null &&
    lens.bridge !== "llm-provisional"
  );
}

/** Frozen run manifest, recorded before retrieval (§4C). */
export interface V2Manifest {
  runId: string;
  pipelineVersion: string;
  policyVersion: string;
  /** Canonical frozen seed ids, excluded from counted results. */
  frozenSeedIds: string[];
  discoveryLensIds: string[];
  supportingLensIds: string[];
  targetCategories: string[];
  retrievalTake: number;
  attemptCeiling: number;
  /** Known same-work/franchise links, flagged not inflated (§4C). */
  knownFamilyLinks: string[][];
}

/** One returned entity: id and display name stay together (§4E). */
export interface V2ReturnedEntity {
  id: string;
  name: string;
  type: string;
  /** 1-based response position. Rank only, never a fit score. */
  position: number;
  /** Shared-descriptor vocabulary actually returned for this entity. */
  tags: string[];
}

/** Per-lens per-category retrieval outcome (partial-data honest). */
export interface V2LensRetrieval {
  aspectId: string;
  category: string;
  status: "ok" | "empty" | "failed";
  entities: V2ReturnedEntity[];
  queryProvenance: string;
  callId?: string;
  error?: string;
}

/** A candidate taste neighborhood (§4E–§4F). */
export interface V2Neighborhood {
  id: string;
  /** Core ids returned under ≥2 distinct discovery aspect families. */
  coreMemberIds: string[];
  members: V2ReturnedEntity[];
  /** Null means reference-overlap only, no invented coherence. */
  sharedDescriptor: string | null;
  coherent: boolean;
  /** Distinct eligible aspect families covering this group. */
  coverage: number;
  /** Eligible aspect-family pairs sharing ≥2 core members. */
  corroboration: number;
  /** False when built only from provisional bridges. */
  pitchSupported: boolean;
  /**
   * Eligible supporting aspect ids whose pooled retrieval contains
   * ≥2 distinct core members of this group (§4F). Supporting
   * evidence can reorder groups but never creates members or
   * changes C/X. Empty means discovery-only / partial evidence.
   */
  supportingEvidence: string[];
  /** Query records that establish member overlap and metadata. */
  evidenceIds?: string[];
}

/** Bounded per-lens exploration entries (§4E). No group label, no
 *  pitch-corroboration badge. Reuses existing retrievals. */
export interface V2Exploration {
  aspectId: string;
  referenceName: string | null;
  bridge: V2BridgeProvenance;
  entities: V2ReturnedEntity[];
  queryProvenance: string[];
  suggestedAction: string;
  evidenceIds?: string[];
}

/**
 * One investigation lead (§4G): a returned podcast/person seeded by a
 * neighborhood's frozen core IDs. Downstream suggestion only — never
 * another validation of the hypothesis, and affinity is not evidence
 * of submissions, sponsorship, reach, or conversion.
 */
export interface V2Lead {
  id: string;
  name: string;
  type: string;
  /** Ordered neighborhood this lead was seeded from. */
  neighborhoodId: string;
  /** Frozen core IDs combined into the multi-interest signal. */
  seedIds: string[];
  category: string;
  /** Returned link when the response carries one; never invented. */
  link: string | null;
  /** Advice for investigating, not a finding. */
  investigationAction: string;
  queryProvenance: string;
  callId?: string;
}

export type V2ReportState =
  | "hypotheses"
  | "exploration-only"
  | "no-supported-hypothesis"
  | "unable-to-assess"
  | "needs-clarification"
  | "unsupported";

/**
 * One creator-comparison overlay entry (§4B): a resolved "similar to"
 * work plus its bounded surroundings. Display only — never a pitch
 * aspect, never grouping input, never a corroboration vote.
 */
export interface V2ComparisonOverlay {
  /** Creator's words. */
  query: string;
  entityId: string | null;
  entityName: string | null;
  identity: V2IdentityState;
  category: string;
  /** Bounded surrounding entities, by response order. */
  entities: V2ReturnedEntity[];
  queryProvenance: string[];
  evidenceIds?: string[];
}

export type V2DataState = "complete" | "partial" | "unavailable";

/**
 * One grounded neighborhood explanation (§4H): a name built from
 * supported metadata and a why-investigate reason framed as advice.
 * The LLM cannot change memberships, counts, ordering, or states —
 * this carries words only. `source` records whether the words went
 * through grounded LLM validation or are deterministic code labels.
 */
export interface V2NeighborhoodExplanation {
  neighborhoodId: string;
  name: string;
  whyInvestigate: string;
  source: "llm-grounded" | "deterministic";
}

/** Attempt accounting for the run (§§6–7): attempts, ceiling, LLM
 *  calls, and wall-clock latency for time/cost instrumentation. */
export interface V2AttemptUsage {
  httpAttempts: number;
  ceiling: number;
  llmCalls: number;
  latencyMs: number;
}

/** Lean result. Persistence is client-side; this object plus `runId`
 *  is what the client store keeps. Leads are §4G investigation leads
 *  (possibly empty — missing leads are acceptable, never invented).
 *  Explanations are §4H words about frozen neighborhoods: one entry
 *  per ordered neighborhood, empty when no hypotheses survived.
 *  Comparisons are §4B overlay entries: resolved creator context,
 *  never evidence. Candidate hypotheses are projected groups shown
 *  before any confirmation: what the overlap would support if the
 *  creator confirms the provisional analogies. Display only —
 *  pitchSupported is always false, and they never feed reach,
 *  explanations, or evidence counts. */
export interface V2EvidenceCall extends QlooCall {
  /** Key-free response data; truncation is explicitly disclosed. */
  response: unknown;
  responseTruncated?: boolean;
  attempts: number;
  error?: string;
}

export interface V2Result {
  /** Present for every new outcome, even when no manifest was possible. */
  runId?: string;
  /** Optional only for backward-compatible reads of older saved v2 runs. */
  calls?: V2EvidenceCall[];
  retrievals?: V2LensRetrieval[];
  reportState: V2ReportState;
  dataState: V2DataState;
  input: V2Input;
  brief: V2Brief | null;
  lenses: V2ReferenceLens[];
  manifest: V2Manifest | null;
  neighborhoods: V2Neighborhood[];
  /** Projected groups pending creator confirmation; empty once
   *  confirmed hypotheses exist. See the type doc above. */
  candidateHypotheses: V2Neighborhood[];
  explorations: V2Exploration[];
  limitations: string[];
  leads: V2Lead[];
  explanations: V2NeighborhoodExplanation[];
  comparisons: V2ComparisonOverlay[];
  usage: V2AttemptUsage;
}
