/**
 * Day 9 U: shared reach assembly. Owned by U.
 *
 * Extracted from `src/app/run/page.tsx` so `/run` and `/case` build the
 * same reach groups from the same pipeline result (§6.8): target
 * selection, taste refetch for targets, related fetch per target,
 * gap finding. Server-only (Qloo fetches).
 *
 * Spec ref: §6.8 (reach plan), §6.12 (reach calls join the evidence
 * list), §10 #7 (deterministic order).
 */

import type { ReachAudience } from "@/components/reach";
import { TAG_LABELS } from "@/lib/fixtures/tag-labels";
import { fetchRelated } from "@/lib/qloo/related";
import { fetchAllAudienceTastes } from "@/lib/qloo/tastes";
import { countUnlabeled, findGaps } from "@/lib/scoring/gaps";
import type { PipelineResult, QlooCall } from "@/lib/types";
import { selectReachTargets } from "./reach-targets.ts";

export interface ReachGroups {
  groups: ReachAudience[];
  calls: QlooCall[];
}

/** Reach groups for a pipeline result; empty when no target qualifies. */
export async function buildReachGroups(
  result: PipelineResult,
): Promise<ReachGroups> {
  const audiences = [result.hypothesis, ...result.rivals];
  const targets = selectReachTargets(result.verdict, result.scores, audiences);
  if (targets.length === 0) return { groups: [], calls: [] };
  const stepCallId = (id: string) =>
    result.steps.find((s) => s.id === id)?.callId;
  const excludeIds = result.hypothesis.titles.map((t) => t.qlooId);
  const { all: tasteLists } = await fetchAllAudienceTastes(
    targets,
    result.input.workType,
  );
  // Targets are independent: fetch concurrently, then assemble in
  // order so the evidence list stays deterministic (§10 #7).
  const relatedLists = await Promise.all(
    targets.map((audience) => fetchRelated(audience, excludeIds)),
  );
  const groups: ReachAudience[] = [];
  const calls: QlooCall[] = [];
  targets.forEach((audience, index) => {
    const related = relatedLists[index] ?? [];
    const tastes = tasteLists.find((t) => t.audienceId === audience.id);
    const gaps = tastes ? findGaps(tastes, result.tags, TAG_LABELS) : [];
    const unlabeledCount = tastes
      ? countUnlabeled(tastes, result.tags, TAG_LABELS)
      : 0;
    for (const group of related) {
      if (group.call !== null) calls.push(group.call);
    }
    groups.push({
      audience,
      headline: index === 0 ? "Best fit" : "Runner-up · Split verdict",
      related,
      gaps,
      unlabeledCount,
      tastesCallId: stepCallId("tastes"),
    });
  });
  return { groups, calls };
}
