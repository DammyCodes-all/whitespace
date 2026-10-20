/**
 * One real Qloo run, replayed by the static sample page.
 *
 * The JSON beside this file is the output of a live run on 2026-10-20:
 * 96 network calls, 24 audiences (20 controls), a Strong verdict, the
 * named audience on top, and `grounding.ok: true`. Response bodies are
 * trimmed in the JSON to keep the repository small; the request
 * parameters, statuses and call count are complete.
 *
 * This is deliberately separate from `design-system-data.ts`, whose
 * numbers are fixtures for component specimens. The sample result must
 * never pass a fixture off as a measurement.
 */

import type { FlowResult } from "@/lib/flow/contract";
import type { FlowStepRow } from "@/lib/flow/view-types";
import recorded from "./recorded-run.json" with { type: "json" };

export interface RecordedRun {
  result: FlowResult;
  steps: FlowStepRow[];
}

export const RECORDED_RUN = recorded as unknown as RecordedRun;
export const RECORDED_FLOW_RESULT = RECORDED_RUN.result;
export const RECORDED_FLOW_STEPS = RECORDED_RUN.steps;

/** The exact comps the user named, so the sample shows its full input. */
export const RECORDED_NAMED_TITLES =
  RECORDED_FLOW_RESULT.audiences
    .find((audience) => audience.role === "named")
    ?.titles.map((title) => title.name) ?? [];

export const RECORDED_RUN_META = {
  recordedAt: "2026-10-20",
  calls: RECORDED_FLOW_RESULT.qlooCalls.total,
  network: RECORDED_FLOW_RESULT.qlooCalls.network,
  cached: RECORDED_FLOW_RESULT.qlooCalls.cached,
  audiences: RECORDED_FLOW_RESULT.audiences.length,
  controls: RECORDED_FLOW_RESULT.audiences.filter(
    (audience) => audience.role === "control",
  ).length,
  evidenceLines: Object.keys(RECORDED_FLOW_RESULT.evidence).length,
  grounded: RECORDED_FLOW_RESULT.grounding?.ok === true,
} as const;
