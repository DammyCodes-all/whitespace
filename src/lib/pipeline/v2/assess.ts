/**
 * V2 result-state composition, pure logic (lean MVP). Owned by S.
 *
 * Maps frozen evidence to `reportState`/`dataState` per the §5 table.
 * Supporting retrieval failures count alongside discovery failures:
 * "partial" means some frozen-plan retrieval failed while useful
 * evidence survived. Upstream timeout/key failure is unavailable data,
 * never a creative judgment. Completeness describes the frozen
 * retrieval plan, not the whole pitch.
 */

import type {
  V2DataState,
  V2LensRetrieval,
  V2Neighborhood,
  V2ReportState,
} from "./types.ts";

export interface V2EvidenceSummary {
  neighborhoods: V2Neighborhood[];
  retrievals: V2LensRetrieval[];
  hasBrief: boolean;
  usableLensCount: number;
  explorationsUseful: boolean;
  upstreamFailed?: boolean;
  stagesIncomplete?: boolean;
}

export function composeStates(summary: V2EvidenceSummary): {
  reportState: V2ReportState;
  dataState: V2DataState;
} {
  const failures = summary.retrievals.filter(
    (r) => r.status === "failed",
  ).length;
  const completed = summary.retrievals.filter(
    (r) => r.status !== "failed",
  ).length;
  const incomplete =
    failures > 0 || summary.upstreamFailed || summary.stagesIncomplete;
  const dataState: V2DataState =
    completed === 0 ? "unavailable" : incomplete ? "partial" : "complete";

  if (!summary.hasBrief || summary.usableLensCount === 0 || completed === 0) {
    return { reportState: "unable-to-assess", dataState };
  }
  if (summary.neighborhoods.length > 0) {
    return {
      reportState: "hypotheses",
      dataState,
    };
  }
  if (summary.explorationsUseful) {
    return { reportState: "exploration-only", dataState };
  }
  return { reportState: "no-supported-hypothesis", dataState };
}
