/**
 * Default v2 orchestrator wiring (lean MVP). Owned by S.
 *
 * Binds the injected seams to their live implementations: U's brief
 * proposal, Q's identity resolution, discovery retrieval, and
 * group-seeded reach. No module-level quota state — the budget object
 * is per-run.
 */

import { proposeV2Brief } from "../../agent/v2-brief.ts";
import { proposeV2Explanation } from "../../agent/v2-explain.ts";
import {
  fetchV2DiscoveryCategory,
  fetchV2DiscoveryLens,
} from "../../qloo/v2-evidence.ts";
import { resolveV2Reference } from "../../qloo/v2-identity.ts";
import { fetchV2ReachForNeighborhood } from "../../qloo/v2-reach.ts";
import type { V2OrchestratorDeps } from "./run.ts";
import { V2_OVERLAY_CATEGORY } from "./types.ts";

export function defaultV2Deps(
  overrides: Partial<V2OrchestratorDeps> = {},
): V2OrchestratorDeps {
  return {
    proposeBrief: (pitchText, workType, execution) =>
      proposeV2Brief(pitchText, workType, undefined, execution),
    resolveReference: (query, entityType, budget) =>
      resolveV2Reference(query, entityType, budget),
    fetchLens: (entityId, aspectId, excludeIds, budget) =>
      fetchV2DiscoveryLens(entityId, aspectId, excludeIds, budget),
    fetchReach: (neighborhoodId, seedIds, budget) =>
      fetchV2ReachForNeighborhood(neighborhoodId, seedIds, budget),
    explainEvidence: (packet, execution) =>
      proposeV2Explanation(packet, undefined, execution),
    fetchOverlay: (entityId, comparisonId, excludeIds, budget) =>
      fetchV2DiscoveryCategory(
        entityId,
        comparisonId,
        V2_OVERLAY_CATEGORY,
        excludeIds,
        budget,
      ),
    ...overrides,
  };
}
