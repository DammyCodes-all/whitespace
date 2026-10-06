/**
 * Day 9 U: audience case builder. Owned by U.
 *
 * Pure function from a `PipelineResult` to the printable one-pager
 * model (§6.10): the idea in one line, verdict and margin, the named
 * audience with its titles, evidence lines each linked to its Qloo call,
 * and a limits section listing every "no data" item. The reach plan
 * renders beside it from shared reach groups — this file covers what
 * the pipeline result alone can say.
 *
 * Plain functions only: runnable under `node --test` type stripping
 * (relative `.ts` imports, no enums, no namespaces).
 */

import { isUnjudgeable } from "../scoring/fit.ts";
import type { PipelineResult, Verdict } from "../types.ts";

export interface CaseEvidenceLine {
  text: string;
  callId?: string;
}

export interface CaseModel {
  /** The idea in one line (§6.10). */
  pitchOneLiner: string;
  verdict: Verdict;
  verdictHeadline: string;
  verdictSub: string | null;
  topAudienceName: string;
  topAudienceTitles: string[];
  marginTopVsSecond: number;
  marginTopVsControl: number;
  clearsControl: boolean;
  coverage: number;
  /** Three to five evidence lines, each linked to its Qloo call (§6.12). */
  evidence: CaseEvidenceLine[];
  /** Every "no data" item, named (§6.10, §10 #4). */
  limits: string[];
  footer: string;
}

/** Verbatim footer (§6.10): group-level data, no outcome predictions. */
export const CASE_FOOTER =
  "Built from group-level taste data. This case does not predict outcomes and never replaces talking to real people.";

function oneLiner(pitchText: string): string {
  const first = pitchText.split(/[.\n]/)[0]?.trim() ?? "";
  const line = first === "" ? pitchText.trim() : first;
  return line.length > 140 ? `${line.slice(0, 137).trim()}…` : line;
}

function headline(
  result: PipelineResult,
  topName: string,
): { headline: string; sub: string | null } {
  const verdict = result.verdict.verdict;
  if (verdict === "Strong") {
    return {
      headline: `Strong fit: ${topName}`,
      sub: result.verdict.surprise
        ? "Your best fit is not the audience you named."
        : null,
    };
  }
  if (verdict === "Split") {
    return {
      headline: `Split: ${topName} leads a close pair`,
      sub: "The top two both clear control and sit close together.",
    };
  }
  if (verdict === "Weak") {
    return {
      headline: "Weak fit: no audience clears control",
      sub: "Check with real people before spending more.",
    };
  }
  const reason = result.verdict.inconclusiveReason;
  const why =
    reason === "coverage"
      ? "too few pitch words matched Qloo tags"
      : reason === "nodata"
        ? "too many audiences had no taste data"
        : reason === "top-unjudgeable"
          ? "the top audience had no taste data"
          : "there was nothing reliable to judge";
  return {
    headline: "Inconclusive",
    sub: `No reliable answer: ${why}.`,
  };
}

/**
 * §6.10: build the one-pager model. Never throws on thin input:
 * missing audiences or steps yield shorter sections, not errors.
 */
export function buildCase(result: PipelineResult): CaseModel {
  const audiences = [result.hypothesis, ...result.rivals];
  const top =
    audiences.find((a) => a.id === result.verdict.topAudienceId) ??
    result.hypothesis;
  const { headline: verdictHeadline, sub: verdictSub } = headline(
    result,
    top.name,
  );
  const stepCallId = (id: string) =>
    result.steps.find((s) => s.id === id)?.callId;

  const evidence: CaseEvidenceLine[] = [
    {
      text: `Hypothesis audience from ${top.titles.length} Qloo titles: ${top.titles.map((t) => t.name).join(", ") || "none found"}`,
      callId: stepCallId("hypothesis"),
    },
    {
      text: `Pitch tags ${result.tags.map((t) => t.tag).join(", ") || "none"} · coverage ${result.coverage.toFixed(2)}`,
      callId: stepCallId("tags"),
    },
    {
      text:
        result.rivals.length > 0
          ? `${result.rivals.length} rival readings tested: ${result.rivals.map((r) => r.name).join("; ")}`
          : "No rival readings survived Qloo checks; the run continued with what exists",
      callId: stepCallId("rivals"),
    },
    {
      text: `Top beats the best of ${result.controls.length} controls by ${result.verdict.marginTopVsControl.toFixed(3)}${result.verdict.clearsControl ? " — clears control" : " — does not clear control"}`,
      callId: stepCallId("controls") ?? stepCallId("verdict"),
    },
  ];

  const limits: string[] = [];
  for (const audience of audiences) {
    for (const query of audience.notFoundTitles) {
      limits.push(`Qloo has no record of "${query}" — dropped before scoring.`);
    }
  }
  if (result.coverage < 1) {
    limits.push(
      `Only ${Math.round(result.coverage * 100)}% of pitch words matched Qloo tags; the rest are not measured, not low scores.`,
    );
  }
  const contenderIds = new Set(audiences.map((a) => a.id));
  for (const score of result.scores) {
    if (!contenderIds.has(score.audienceId) || !isUnjudgeable(score)) continue;
    const name = audiences.find((a) => a.id === score.audienceId)?.name;
    limits.push(
      `${name ?? score.audienceId} had no taste data — shown as not measured, never as a low score.`,
    );
  }
  if (result.grounding.ok === false) {
    limits.push("Grounding check failed: some output did not come from Qloo.");
  }

  return {
    pitchOneLiner: oneLiner(result.input.pitchText),
    verdict: result.verdict.verdict,
    verdictHeadline,
    verdictSub,
    topAudienceName: top.name,
    topAudienceTitles: top.titles.map((t) => t.name),
    marginTopVsSecond: result.verdict.marginTopVsSecond,
    marginTopVsControl: result.verdict.marginTopVsControl,
    clearsControl: result.verdict.clearsControl,
    coverage: result.coverage,
    evidence: evidence.slice(0, 5),
    limits,
    footer: CASE_FOOTER,
  };
}
