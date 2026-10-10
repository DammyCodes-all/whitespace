/**
 * V2 lean orchestrator: `analyzePitch`. Owned by S.
 *
 * One server workflow owns the order, retries, query budget, evidence,
 * and result (§4). Stages: scope → brief → resolve → freeze →
 * retrieve → group → assess. The LLM interprets and proposes; Qloo
 * supplies identity and taste relationships; this module freezes,
 * excludes, counts, and states — it never invents members, scores, or
 * labels.
 *
 * Client-side replay (see `docs/v2-findings.md`), comparison overlays,
 * and bounded detail enrichment are supported. No server replay. Supporting-lens assessment
 * (§4F), investigation leads (§4G, group-seeded podcasts/people as
 * downstream suggestions), and grounded post-evidence explanation
 * (§4H, validated words with a deterministic fallback) are live. The
 * client persists the returned `V2Result` (with `runId`) so a refresh
 * never re-runs paid analysis.
 *
 * Dependencies are injected for tests; the default wiring lives in
 * `./wiring.ts`. Quota counters are request-scoped: one budget object
 * per run, never module state.
 */

import type { LlmExecutionContext } from "../../agent/llm-client.ts";
import type { V2BriefProposal } from "../../agent/v2-brief.ts";
import {
  deterministicV2Explanation,
  type V2ExplanationPacket,
} from "../../agent/v2-explain.ts";
import { checkScope } from "../../policy/scope.ts";
import { V2_DISCOVERY_CATEGORIES } from "../../qloo/v2-evidence.ts";
import type { V2Budget, V2IdentityOutcome } from "../../qloo/v2-identity.ts";
import { budgetAllows } from "../../qloo/v2-identity.ts";
import type { V2ReachOutcome } from "../../qloo/v2-reach.ts";
import { composeStates } from "./assess.ts";
import { isConfirmedBridge } from "./confirmation.ts";
import {
  applySupportingEvidence,
  buildExplorations,
  excludeFrozenSeeds,
  findCoreEntities,
  formNeighborhoods,
  hasMeaningfulTags,
  orderNeighborhoods,
} from "./discovery.ts";
import { validatePreparedBrief } from "./input.ts";
import {
  isBridgeEligible,
  MAX_COMPARISONS,
  MAX_ENRICHMENT_LOOKUPS,
  MAX_REACH_NEIGHBORHOODS,
  OVERLAY_PER_QUERY,
  PIPELINE_VERSION,
  POLICY_VERSION,
  QLOO_ATTEMPT_CEILING,
  REACH_SEEDS_PER_GROUP,
  RETRIEVAL_TAKE,
  V2_OVERLAY_CATEGORY,
  type V2Brief,
  type V2ComparisonOverlay,
  type V2EvidenceCall,
  type V2Exploration,
  type V2IdentityState,
  type V2Input,
  type V2Lead,
  type V2LensRetrieval,
  type V2Manifest,
  type V2Neighborhood,
  type V2NeighborhoodExplanation,
  type V2ReferenceLens,
  type V2Result,
} from "./types.ts";

/** Selectable discovery lenses per run (lean default: two). */
export const V2_DISCOVERY_LENSES = 2;

/** Single run deadline in ms (spec §10 ~90s live budget). */
export const V2_RUN_DEADLINE_MS = 90_000;

export interface V2OrchestratorDeps {
  proposeBrief: (
    pitchText: string,
    workType: string,
    execution?: LlmExecutionContext,
  ) => Promise<V2BriefProposal>;
  resolveReference: (
    query: string,
    entityType: string,
    budget: V2Budget,
  ) => Promise<V2IdentityOutcome>;
  fetchLens: (
    entityId: string,
    aspectId: string,
    excludeIds: string[],
    budget: V2Budget,
  ) => Promise<V2LensRetrieval[]>;
  fetchReach: (
    neighborhoodId: string,
    seedIds: string[],
    budget: V2Budget,
  ) => Promise<V2ReachOutcome[]>;
  explainEvidence: (
    packet: V2ExplanationPacket,
    execution?: LlmExecutionContext,
  ) => Promise<{ explanations: V2NeighborhoodExplanation[]; llmCalls: number }>;
  /**
   * One overlay query per resolved comparison into the
   * reference-shaped category. Display only — never grouping input.
   */
  fetchOverlay: (
    entityId: string,
    comparisonId: string,
    excludeIds: string[],
    budget: V2Budget,
  ) => Promise<V2LensRetrieval>;
  now?: () => number;
  onProgress?: (stage: string) => void;
}

function runId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `v2-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function emptyUsage() {
  return {
    httpAttempts: 0,
    ceiling: QLOO_ATTEMPT_CEILING,
    llmCalls: 0,
    latencyMs: 0,
  };
}

function toLens(
  aspectId: string,
  candidates: { name: string; entityType: string; analogy: string }[],
  outcome: V2IdentityOutcome | null,
): V2ReferenceLens {
  if (outcome === null) {
    return {
      aspectId,
      candidates,
      selectedName: candidates[0]?.name ?? "unknown",
      entityId: null,
      entityName: null,
      entityType: candidates[0]?.entityType ?? null,
      identity: "not_found",
      bridge: "llm-provisional",
      analogy: candidates[0]?.analogy ?? "",
      role: "discovery",
    };
  }
  const selected =
    candidates.find((c) => c.name === outcome.query) ?? candidates[0];
  return {
    aspectId,
    candidates,
    selectedName: outcome.query,
    entityId: outcome.entityId,
    entityName: outcome.entityName,
    entityType: outcome.entityType,
    identity: outcome.state,
    bridge: "llm-provisional",
    ...(outcome.callId === undefined ? {} : { callId: outcome.callId }),
    analogy: selected?.analogy ?? "",
    role: "discovery",
  };
}

/**
 * Analyze a raw pitch into a versioned v2 result. Never throws on
 * upstream failure: every failure becomes evidence states, never an
 * exception (programming errors still propagate).
 */
export async function analyzePitch(
  input: V2Input,
  deps: V2OrchestratorDeps,
  deadlineMs: number = V2_RUN_DEADLINE_MS,
): Promise<V2Result> {
  if (typeof window !== "undefined") {
    throw new Error("analyzePitch is server-only.");
  }
  const now = deps.now ?? Date.now;
  const started = now();
  const progress = deps.onProgress ?? (() => {});
  const id = runId();
  const usage = emptyUsage();
  const controller = new AbortController();
  const calls: V2EvidenceCall[] = [];
  const recordedRetrievals: V2LensRetrieval[] = [];
  const budget: V2Budget = {
    used: 0,
    ceiling: QLOO_ATTEMPT_CEILING,
    signal: controller.signal,
    calls,
  };
  const execution: LlmExecutionContext = {
    signal: controller.signal,
    onAttempt: () => {
      usage.llmCalls += 1;
    },
  };
  const limitations: string[] = [];
  let upstreamFailed = false;
  let stagesIncomplete = false;
  const deadlineError = new DOMException(
    "Run deadline reached.",
    "TimeoutError",
  );
  const timer = setTimeout(
    () => controller.abort(deadlineError),
    Math.max(0, deadlineMs),
  );
  const over = () => {
    if (now() - started >= deadlineMs && !controller.signal.aborted) {
      controller.abort(deadlineError);
    }
    if (controller.signal.aborted) stagesIncomplete = true;
    return controller.signal.aborted;
  };
  const elapsed = () => Math.max(0, now() - started);

  // Also bound injected dependencies that do not honour cancellation.
  async function bounded<T>(task: () => Promise<T>): Promise<T> {
    if (over()) throw deadlineError;
    const signal = controller.signal;
    let cancel: () => void = () => {};
    const aborted = new Promise<never>((_resolve, reject) => {
      cancel = () => reject(signal.reason);
      signal.addEventListener("abort", cancel, { once: true });
    });
    try {
      return await Promise.race([task(), aborted]);
    } finally {
      signal.removeEventListener("abort", cancel);
    }
  }

  async function resolve(
    query: string,
    entityType: string,
  ): Promise<V2IdentityOutcome> {
    let outcome: V2IdentityOutcome;
    try {
      outcome = await bounded(() =>
        deps.resolveReference(query, entityType, budget),
      );
    } catch {
      outcome = {
        query,
        entityType,
        state: "request_failed",
        entityId: null,
        entityName: null,
        year: null,
        exactMatches: [],
        closestNames: [],
        tagIds: [],
        provenance: over()
          ? "Identity lookup cancelled at the run deadline."
          : "Identity lookup failed.",
      };
    }
    if (outcome.state === "request_failed") {
      upstreamFailed = true;
      limitations.push(
        `Identity lookup for "${query}" failed: ${outcome.provenance}`,
      );
    }
    return outcome;
  }

  function recordRetrievals(outcomes: V2LensRetrieval[]): V2LensRetrieval[] {
    recordedRetrievals.push(...outcomes);
    for (const outcome of outcomes) {
      if (outcome.status === "failed") {
        limitations.push(
          `Retrieval failed for ${outcome.aspectId} into ${outcome.category}: ${outcome.queryProvenance}`,
        );
      }
    }
    return outcomes;
  }

  async function retrieveLens(
    lens: V2ReferenceLens,
    seeds: string[],
  ): Promise<V2LensRetrieval[]> {
    try {
      return recordRetrievals(
        await bounded(() =>
          deps.fetchLens(lens.entityId as string, lens.aspectId, seeds, budget),
        ),
      );
    } catch {
      return recordRetrievals(
        V2_DISCOVERY_CATEGORIES.map((category) => ({
          aspectId: lens.aspectId,
          category,
          status: "failed",
          entities: [],
          queryProvenance: over()
            ? "Retrieval cancelled at the run deadline."
            : "Retrieval failed before a response was available.",
        })),
      );
    }
  }

  async function execute(): Promise<V2Result> {
    // Scope gate (§3): tools are not taste-assessable.
    progress("scope");
    const scope = checkScope(input.pitchText);
    if (!scope.inScope) {
      return {
        reportState: "unsupported",
        dataState: "complete",
        input,
        brief: null,
        lenses: [],
        manifest: null,
        neighborhoods: [],
        explorations: [],
        limitations: [
          scope.trigger !== undefined
            ? `Out of scope: tool/app pitch (saw "${scope.trigger}"). Taste data cannot judge tools.`
            : "Out of scope: tool/app pitch. Taste data cannot judge tools.",
        ],
        leads: [],
        explanations: [],
        comparisons: [],
        usage: { ...usage, latencyMs: elapsed() },
      };
    }

    if (input.pitchText.trim() === "") {
      return {
        reportState: "needs-clarification",
        dataState: "complete",
        input,
        brief: null,
        lenses: [],
        manifest: null,
        neighborhoods: [],
        explorations: [],
        limitations: ["No pitch text provided. Paste the idea to begin."],
        leads: [],
        explanations: [],
        comparisons: [],
        usage: { ...usage, latencyMs: elapsed() },
      };
    }

    // Stage A: interpret (§4A).
    progress("interpret");
    let proposal: V2BriefProposal;
    try {
      if (input.preparedBrief !== undefined) {
        const prepared = validatePreparedBrief(input);
        if (prepared === null) throw new Error("Invalid reviewed brief.");
        proposal = prepared;
      } else {
        proposal = await bounded(() =>
          deps.proposeBrief(input.pitchText, input.workType, execution),
        );
        const validated = validatePreparedBrief({
          ...input,
          confirmedAnalogies: [],
          preparedBrief: {
            pitchText: input.pitchText,
            workType: input.workType,
            ...proposal,
          },
        });
        if (validated === null) throw new Error("Invalid brief proposal.");
        proposal = validated;
      }
    } catch {
      return {
        reportState: "unable-to-assess",
        dataState: "unavailable",
        input,
        brief: null,
        lenses: [],
        manifest: null,
        neighborhoods: [],
        explorations: [],
        limitations: [
          over()
            ? "Run deadline reached during interpretation. No evidence was gathered."
            : "Interpretation failed or the reviewed brief was invalid. No evidence was gathered.",
        ],
        leads: [],
        explanations: [],
        comparisons: [],
        usage: { ...usage, latencyMs: elapsed() },
      };
    }
    const brief: V2Brief = proposal.brief;
    if (brief.aspects.length === 0) {
      return {
        reportState: "needs-clarification",
        dataState: "complete",
        input,
        brief,
        lenses: [],
        manifest: null,
        neighborhoods: [],
        explorations: [],
        limitations: [
          "The pitch has no representable aspects yet. Add what it is about (premise, theme, tone, or form).",
          ...brief.unrepresentable.map((u) => `Unrepresentable: ${u}`),
        ],
        leads: [],
        explanations: [],
        comparisons: [],
        usage: { ...usage, latencyMs: elapsed() },
      };
    }

    // Stage B: resolve reference lenses (§4B). Bounded concurrency: at
    // most 3 aspects × 2 candidates, each resolution one budgeted call.
    progress("resolve");

    const refByAspect = new Map(
      proposal.references.map((r) => [r.aspectId, r.candidates]),
    );
    const lenses = await Promise.all(
      brief.aspects.map(async (aspect) => {
        const candidates = (refByAspect.get(aspect.id) ?? []).slice(0, 2);
        if (candidates.length === 0 || over()) {
          if (over())
            limitations.push(
              "Deadline reached during resolution; remaining aspects left unresolved.",
            );
          return toLens(
            aspect.id,
            candidates,
            over()
              ? await resolve(
                  candidates[0]?.name ?? aspect.id,
                  candidates[0]?.entityType ?? "urn:entity",
                )
              : null,
          );
        }
        let selected: V2IdentityOutcome | null = null;
        for (const candidate of candidates) {
          if (over()) {
            limitations.push(
              "Deadline reached during resolution; remaining candidates skipped.",
            );
            break;
          }
          const outcome = await resolve(candidate.name, candidate.entityType);
          if (selected === null || outcome.state === "request_failed")
            selected = outcome;
          if (outcome.state === "resolved") {
            selected = outcome;
            break;
          }
        }
        const lens = toLens(aspect.id, candidates, selected);
        if (isConfirmedBridge(aspect, lens, input.confirmedAnalogies)) {
          lens.bridge = "creator-confirmation";
        }
        return lens;
      }),
    );
    for (const lens of lenses) {
      if (lens.identity === "ambiguous") {
        limitations.push(
          `Ambiguous reference for one aspect ("${lens.selectedName}"): ${lens.candidates.length} candidate(s) proposed, multiple exact matches — needs creator pick, not usable for discovery.`,
        );
      } else if (lens.identity !== "resolved") {
        limitations.push(
          `No usable reference for one aspect ("${lens.selectedName}"): ${lens.identity}.`,
        );
      } else if (!isBridgeEligible(lens)) {
        limitations.push(
          `Reference "${lens.entityName}" is provisional exploration: identity resolved, analogy unconfirmed.`,
        );
      }
    }

    // Narrow duplicate dimensions: same entity twice is one lens (§4C).
    const distinct = new Map<string, V2ReferenceLens>();
    const referenceNames = new Set<string>();
    const knownFamilies = new Map<string, string[]>();
    for (const lens of lenses) {
      if (lens.entityId === null) continue;
      const name = (lens.entityName ?? lens.selectedName)
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      knownFamilies.set(name, [
        ...new Set([...(knownFamilies.get(name) ?? []), lens.entityId]),
      ]);
      if (!distinct.has(lens.entityId) && !referenceNames.has(name)) {
        distinct.set(lens.entityId, lens);
        referenceNames.add(name);
      } else
        limitations.push(
          "Evidence is narrow: two aspects resolved to the same work; counted once.",
        );
    }
    const usable = [...distinct.values()].filter(
      (l) => l.identity === "resolved",
    );
    usage.httpAttempts = budget.used;

    // Stage B2: comparison overlay identity (§4B). At most two creator
    // comparisons, resolved but never pitch aspects. Resolution is
    // movie-scoped in the film pilot: a non-film comparison surfaces
    // as not_found with an honest limitation, never a forced match.
    const comparisonQueries = (input.comparisons ?? [])
      .map((s) => s.trim().replace(/\s+/g, " "))
      .filter((s) => s !== "")
      .slice(0, MAX_COMPARISONS);
    if ((input.comparisons ?? []).length > MAX_COMPARISONS) {
      limitations.push(
        `Only the first ${MAX_COMPARISONS} creator comparisons are retrieved; the rest are recorded but not used.`,
      );
    }
    interface ResolvedComparison {
      query: string;
      entityId: string | null;
      entityName: string | null;
      identity: V2IdentityState;
      callId?: string;
    }
    const resolvedComparisons: ResolvedComparison[] = [];
    for (const query of comparisonQueries) {
      if (over()) {
        limitations.push(
          "Deadline reached during comparison resolution; remaining comparisons skipped.",
        );
      }
      const outcome = await resolve(query, V2_OVERLAY_CATEGORY);
      resolvedComparisons.push({
        query,
        entityId: outcome.entityId,
        entityName: outcome.entityName,
        identity: outcome.state,
        callId: outcome.callId,
      });
      if (outcome.state !== "resolved") {
        limitations.push(
          `Comparison "${query}" is not usable as an overlay (${outcome.state}).`,
        );
      }
    }
    usage.httpAttempts = budget.used;

    /**
     * Fetch overlay surroundings for resolved comparisons. One query
     * each into the reference-shaped category; display only, never
     * grouping input.
     */
    async function fetchOverlayRetrievals(): Promise<V2LensRetrieval[]> {
      const out: V2LensRetrieval[] = [];
      for (const [index, r] of resolvedComparisons.entries()) {
        if (r.entityId === null) continue;
        if (over()) {
          limitations.push(
            "Deadline reached during overlay retrieval; remaining comparisons skipped.",
          );
        }
        const aspectId = `comparison:${index}`;
        try {
          out.push(
            ...recordRetrievals([
              await bounded(() =>
                deps.fetchOverlay(
                  r.entityId as string,
                  aspectId,
                  manifestSeeds(),
                  budget,
                ),
              ),
            ]),
          );
        } catch {
          out.push(
            ...recordRetrievals([
              {
                aspectId,
                category: V2_OVERLAY_CATEGORY,
                status: "failed",
                entities: [],
                queryProvenance: over()
                  ? "Overlay cancelled at the run deadline."
                  : "Overlay retrieval failed.",
              },
            ]),
          );
        }
      }
      usage.httpAttempts = budget.used;
      return out;
    }

    /** Frozen seeds: usable lens ids plus resolved comparison ids (§4D). */
    function manifestSeeds(): string[] {
      return [
        ...new Set([
          ...usable
            .map((l) => l.entityId)
            .filter((v): v is string => v !== null),
          ...resolvedComparisons
            .map((r) => r.entityId)
            .filter((v): v is string => v !== null),
        ]),
      ];
    }

    /** Overlay display entries from fetched retrievals. */
    function overlayEntries(
      retrievals: V2LensRetrieval[],
    ): V2ComparisonOverlay[] {
      const byAspect = new Map(retrievals.map((r) => [r.aspectId, r]));
      return resolvedComparisons.map((r, index) => {
        const ret = byAspect.get(`comparison:${index}`);
        return {
          query: r.query,
          entityId: r.entityId,
          entityName: r.entityName,
          identity: r.identity,
          category: V2_OVERLAY_CATEGORY,
          entities: (ret?.entities ?? []).slice(0, OVERLAY_PER_QUERY),
          queryProvenance: ret !== undefined ? [ret.queryProvenance] : [],
          evidenceIds: [r.callId, ret?.callId].filter(
            (callId): callId is string => callId !== undefined,
          ),
        };
      });
    }

    if (usable.length === 0) {
      // Comp-led exploration (§4B): creator comparisons can still yield
      // starting points when the pitch itself is poorly representable.
      // Overlay entities never become hypotheses — exploration only.
      const overlayRetrievals = await fetchOverlayRetrievals();
      const comparisons = overlayEntries(overlayRetrievals);
      const overlayExplorations: V2Exploration[] = overlayRetrievals
        .filter((r) => r.entities.length > 0)
        .map((r) => {
          const index = Number(r.aspectId.split(":")[1] ?? 0);
          const entry = resolvedComparisons[index];
          return {
            aspectId: r.aspectId,
            referenceName: entry?.entityName ?? null,
            bridge: "creator-confirmation" as const,
            entities: r.entities.slice(0, OVERLAY_PER_QUERY),
            queryProvenance: [r.queryProvenance],
            evidenceIds: [entry?.callId, r.callId].filter(
              (callId): callId is string => callId !== undefined,
            ),
            suggestedAction:
              "You named this work as a comparison — ask people familiar with it and one returned work to react to the pitch or a sample.",
          };
        });
      if (overlayExplorations.length > 0) {
        return {
          reportState: "exploration-only",
          dataState:
            upstreamFailed ||
            over() ||
            overlayRetrievals.some((r) => r.status === "failed")
              ? "partial"
              : "complete",
          input,
          brief,
          lenses,
          manifest: null,
          neighborhoods: [],
          explorations: overlayExplorations,
          limitations: [
            ...limitations,
            "Identity lookups found no usable pitch references; exploration follows your comparisons instead.",
          ],
          leads: [],
          explanations: [],
          comparisons,
          usage: { ...usage, latencyMs: elapsed() },
        };
      }
      const ambiguous = lenses.some((l) => l.identity === "ambiguous");
      return {
        reportState: ambiguous ? "needs-clarification" : "unable-to-assess",
        dataState:
          upstreamFailed ||
          over() ||
          overlayRetrievals.some((r) => r.status === "failed")
            ? "unavailable"
            : "complete",
        input,
        brief,
        lenses,
        manifest: null,
        neighborhoods: [],
        explorations: [],
        limitations: ambiguous
          ? [
              ...limitations,
              "Pick the intended work for each ambiguous reference to start a new version.",
            ]
          : [
              ...limitations,
              upstreamFailed || over()
                ? "Reference identity could not be assessed because lookups failed or timed out."
                : "Identity lookups completed but no usable references exist.",
            ],
        leads: [],
        explanations: [],
        comparisons,
        usage: { ...usage, latencyMs: elapsed() },
      };
    }

    // Stage C: freeze the manifest (§4C). Discovery-only grouping with
    // the first two usable lenses; a third usable lens is frozen as a
    // supporting role. Membership freezes before supporting results are
    // considered (§4F).
    progress("freeze");
    const discovery = usable.slice(0, V2_DISCOVERY_LENSES);
    const supporting = usable.slice(
      V2_DISCOVERY_LENSES,
      V2_DISCOVERY_LENSES + 1,
    );
    if (supporting.length > 0) {
      supporting[0].role = "supporting";
    }
    limitations.push(
      "Duplicate catalog IDs and names are counted once; wider franchise/family dependence and statistical independence have not been verified.",
    );
    const manifest: V2Manifest = {
      runId: id,
      pipelineVersion: PIPELINE_VERSION,
      policyVersion: POLICY_VERSION,
      frozenSeedIds: manifestSeeds(),
      discoveryLensIds: discovery.map((l) => l.aspectId),
      supportingLensIds: supporting.map((l) => l.aspectId),
      targetCategories: [...V2_DISCOVERY_CATEGORIES],
      retrievalTake: RETRIEVAL_TAKE,
      attemptCeiling: QLOO_ATTEMPT_CEILING,
      knownFamilyLinks: [...knownFamilies.values()].filter(
        (ids) => ids.length > 1,
      ),
    };

    // Stage D: retrieve (§4D). One lens → single-lens exploration path.
    // Overlay surroundings fetch alongside discovery; display only.
    progress("retrieve");
    const retrievals = (
      await Promise.all(
        discovery.map((lens) => retrieveLens(lens, manifest.frozenSeedIds)),
      )
    ).flat();
    const overlayRetrievals = await fetchOverlayRetrievals();
    const comparisons = overlayEntries(overlayRetrievals);
    if (over())
      limitations.push(
        "Deadline reached during retrieval; composing from gathered evidence.",
      );

    // Stage F supporting retrieval (§4F): same categories, same
    // unrestricted top-20 policy, same seed exclusion. Runs after the
    // discovery freeze; results can only flag coverage of frozen cores.
    const supportingRetrievals = (
      await Promise.all(
        supporting.map((lens) => retrieveLens(lens, manifest.frozenSeedIds)),
      )
    ).flat();
    if (supporting.length > 0 && over()) {
      limitations.push(
        "Deadline reached before supporting retrieval; groups are discovery-only.",
      );
    }
    usage.httpAttempts = budget.used;

    // Stage E–F: group, order, explore, assess (§§4E–4F).
    progress("assess");
    const perAspect = new Map<string, V2LensRetrieval[]>();
    for (const r of retrievals) {
      const list = perAspect.get(r.aspectId) ?? [];
      const cleaned = excludeFrozenSeeds(r.entities, manifest.frozenSeedIds);
      list.push({ ...r, entities: cleaned });
      perAspect.set(r.aspectId, list);
    }
    const flat = [...perAspect].map(([aspectId, list]) => ({
      aspectId,
      entities: list.flatMap((r) => r.entities),
    }));
    const cores = findCoreEntities(flat);

    // Detail enrichment (§8 proviso): frozen cores exist but no shared
    // descriptor survives, and some core member lacks meaningful tags.
    // Fill tags for at most four tag-less members via exact-name lookup
    // (verified /search mechanics), then reassess coherence once.
    // Membership never changes; failure stays reference-overlap only.
    let formed = formNeighborhoods(cores, discovery, id, retrievals);
    const enrichmentEvidence: string[] = [];
    if (
      formed.length > 0 &&
      formed[0].sharedDescriptor === null &&
      !over() &&
      budgetAllows(budget)
    ) {
      const tagless = [...cores.values()]
        .filter((c) => !hasMeaningfulTags(c.entity))
        .slice(0, MAX_ENRICHMENT_LOOKUPS);
      let enriched = 0;
      for (const core of tagless) {
        if (over() || !budgetAllows(budget)) break;
        const outcome = await resolve(core.entity.name, core.entity.type);
        if (
          outcome.state === "resolved" &&
          outcome.entityId === core.entity.id &&
          outcome.tagIds.length > 0
        ) {
          cores.set(core.entity.id, {
            entity: {
              ...core.entity,
              tags: [...new Set([...core.entity.tags, ...outcome.tagIds])],
            },
            aspectIds: core.aspectIds,
          });
          enriched += 1;
          if (outcome.callId !== undefined)
            enrichmentEvidence.push(outcome.callId);
        }
      }
      usage.httpAttempts = budget.used;
      if (enriched > 0) {
        formed = formNeighborhoods(cores, discovery, id, retrievals).map(
          (group) => ({
            ...group,
            evidenceIds: [
              ...new Set([...(group.evidenceIds ?? []), ...enrichmentEvidence]),
            ],
          }),
        );
        limitations.push(
          `Enriched tags for ${enriched} core member${enriched === 1 ? "" : "s"} via exact-name lookup; coherence reassessed.`,
        );
      }
    }

    const cleanedSupporting = supportingRetrievals.map((r) => ({
      ...r,
      entities: excludeFrozenSeeds(r.entities, manifest.frozenSeedIds),
    }));
    const withSupport = applySupportingEvidence(
      formed,
      cleanedSupporting,
      supporting,
      discovery,
    );
    const neighborhoods: V2Neighborhood[] = orderNeighborhoods(withSupport).map(
      (group) => ({
        ...group,
        evidenceIds: [
          ...new Set([
            ...(group.evidenceIds ?? []),
            ...[
              ...discovery,
              ...supporting.filter((lens) =>
                group.supportingEvidence.includes(lens.aspectId),
              ),
            ].flatMap((lens) =>
              lens.callId === undefined ? [] : [lens.callId],
            ),
          ]),
        ],
      }),
    );
    for (const lens of supporting) {
      if (!isBridgeEligible(lens)) {
        limitations.push(
          `Supporting reference "${lens.entityName ?? lens.selectedName}" is provisional exploration: identity resolved, analogy unconfirmed — its overlap cannot support a hypothesis.`,
        );
      } else if (
        cleanedSupporting.some((r) => r.status === "failed") &&
        !neighborhoods.some((g) => g.supportingEvidence.includes(lens.aspectId))
      ) {
        limitations.push(
          "Supporting retrieval failed or returned nothing usable; groups are discovery-only.",
        );
        break;
      }
    }
    const explorations = buildExplorations(
      [...perAspect].flatMap(([, list]) => list),
      discovery,
    ).map((entry) => ({
      ...entry,
      evidenceIds: [
        ...new Set([
          ...(entry.evidenceIds ?? []),
          ...discovery
            .filter((lens) => lens.aspectId === entry.aspectId)
            .flatMap((lens) =>
              lens.callId === undefined ? [] : [lens.callId],
            ),
        ]),
      ],
    }));
    const { reportState, dataState } = composeStates({
      neighborhoods,
      retrievals: [...retrievals, ...supportingRetrievals],
      hasBrief: true,
      usableLensCount: usable.length,
      explorationsUseful: explorations.some((e) => e.entities.length > 0),
      upstreamFailed,
      stagesIncomplete: over() || stagesIncomplete,
    });
    // Single usable lens can never corroborate: cap at exploration-only.
    const finalReport =
      discovery.length < 2 && reportState === "hypotheses"
        ? "exploration-only"
        : reportState;

    // Stage G: investigation leads (§4G). Downstream suggestions seeded
    // by frozen cores of the top ordered neighborhoods — never another
    // validation pass. No hypotheses means no reach; reach yields to
    // the deadline and the shared budget; shortfalls are limitations,
    // never invented leads.
    progress("reach");
    let leads: V2Lead[] = [];
    const reachTargets = neighborhoods.slice(0, MAX_REACH_NEIGHBORHOODS);
    if (reachTargets.length === 0) {
      limitations.push(
        "No audience hypotheses survived; no investigation leads to fetch.",
      );
    } else if (over()) {
      limitations.push(
        "Deadline reached before investigation-lead retrieval; hypotheses stand on discovery evidence.",
      );
    } else {
      const outcomes = (
        await Promise.all(
          reachTargets.map(async (group) => {
            try {
              return await bounded(() =>
                deps.fetchReach(
                  group.id,
                  group.coreMemberIds.slice(0, REACH_SEEDS_PER_GROUP),
                  budget,
                ),
              );
            } catch {
              limitations.push(
                `Investigation-lead retrieval for ${group.id} failed or reached the deadline.`,
              );
              return [];
            }
          }),
        )
      ).flat();
      usage.httpAttempts = budget.used;
      leads = outcomes.flatMap((o) => o.leads);
      const failed = outcomes.filter((o) => o.status === "failed").length;
      if (leads.length > 0) {
        limitations.push(
          "Podcast/person affinity is a starting point for conversations, not evidence of submissions, sponsorship, reach, or conversion.",
        );
      }
      if (failed > 0) {
        limitations.push(
          "Some investigation-lead queries failed; hypotheses stand on discovery evidence.",
        );
      } else if (leads.length === 0) {
        limitations.push(
          over()
            ? "Investigation-lead retrieval reached the deadline; investigate via the returned works directly."
            : "Reach queries returned no usable leads; investigate via the returned works directly.",
        );
      }
    }

    // Stage H: explain frozen evidence (§4H). Words only — names from
    // supported metadata, reasons as advice. Nothing to name without
    // hypotheses; the deadline and double-validation failure both fall
    // back to deterministic code labels, never invented answers.
    progress("explain");
    let explanations: V2NeighborhoodExplanation[] = [];
    if (neighborhoods.length > 0) {
      const packet: V2ExplanationPacket = {
        neighborhoods: neighborhoods.map((g) => ({
          id: g.id,
          memberNames: g.members.map((m) => m.name),
          memberIds: g.members.map((m) => m.id),
          sharedDescriptor: g.sharedDescriptor,
          coverage: g.coverage,
          corroboration: g.corroboration,
          supportingCount: g.supportingEvidence.length,
        })),
        allowedNames: [
          ...new Set([
            ...neighborhoods.flatMap((g) => g.members.map((m) => m.name)),
            ...lenses.flatMap((l) =>
              [l.entityName, l.selectedName].filter(
                (n): n is string => typeof n === "string" && n !== "",
              ),
            ),
            ...leads.map((l) => l.name),
          ]),
        ],
        interpretation: brief.interpretation,
      };
      if (over()) {
        limitations.push(
          "Deadline reached before evidence explanation; using deterministic labels.",
        );
        explanations = deterministicV2Explanation(packet);
      } else {
        try {
          const proposed = await bounded(() =>
            deps.explainEvidence(packet, execution),
          );
          explanations = proposed.explanations;
        } catch {
          limitations.push(
            "Evidence explanation failed validation twice; using deterministic labels.",
          );
          explanations = deterministicV2Explanation(packet);
        }
      }
      limitations.push(
        "Neighborhood names and reasons interpret frozen evidence; memberships and counts are code-built.",
      );
    }

    return {
      reportState: finalReport,
      dataState,
      input,
      brief,
      lenses,
      manifest,
      neighborhoods,
      explorations,
      limitations,
      leads,
      explanations,
      comparisons,
      usage: { ...usage, latencyMs: elapsed() },
    };
  }

  try {
    const result = await execute();
    return {
      ...result,
      runId: id,
      calls: [...calls],
      retrievals: [...recordedRetrievals],
      limitations: [...new Set(result.limitations)],
      dataState:
        (over() || upstreamFailed) &&
        result.dataState === "complete" &&
        result.manifest !== null
          ? "partial"
          : result.dataState,
      usage: { ...usage, httpAttempts: budget.used, latencyMs: elapsed() },
    };
  } finally {
    clearTimeout(timer);
    controller.abort(new DOMException("Analysis finished.", "AbortError"));
  }
}
