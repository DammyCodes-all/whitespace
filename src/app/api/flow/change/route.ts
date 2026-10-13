import { NextResponse } from "next/server";
import { CONTROL_COUNT } from "@/lib/config";
import { proposeDeterministic } from "@/lib/demo/propose-stub";
import { barRows, type FlowResult } from "@/lib/flow/contract";
import type { ChangedRun } from "@/lib/pipeline/change";
import { checkChange, MIN_RISE } from "@/lib/policy/change";
import { reportCoverage } from "@/lib/policy/grounding";
import { CONTROL_MARGIN } from "@/lib/policy/verdict";
import { loadControlTastes } from "@/lib/qloo/control-cache";
import { resetQuota } from "@/lib/qloo/index";
import { resolvePitchTags } from "@/lib/qloo/resolve-tags";
import { WORK_TYPE_TO_ENTITY_TYPE } from "@/lib/qloo/rival-discovery";
import { fetchAudienceTastes } from "@/lib/qloo/tastes";
import { scoreAll } from "@/lib/scoring/fit";
import { findGaps, labelsForTastes } from "@/lib/scoring/gaps";
import type { Audience, PitchTag, QlooCall, WorkType } from "@/lib/types";

const WORK_TYPES: WorkType[] = ["film", "music", "book", "game"];

/**
 * A withheld change is a normal outcome (§10 #5): same shape every
 * time, so the four early exits cannot drift apart.
 */
function withheld({
  constraint,
  before,
  after,
  coverageAfter,
  calls,
  proposedPitch = "",
  usedGapLabels = [],
}: {
  constraint: string;
  before: number;
  after: number;
  coverageAfter: number;
  calls: QlooCall[];
  proposedPitch?: string;
  usedGapLabels?: string[];
}): { changed: ChangedRun } {
  return {
    changed: {
      constraint,
      proposedPitch,
      usedGapLabels,
      bar: { minRise: MIN_RISE, requireControl: true },
      check: {
        accepted: false,
        failedCondition: "rise",
        before,
        after,
      },
      after: null,
      coverageAfter,
      calls,
    },
  };
}

/**
 * §6.9 on the flow path: POST { result, constraint } -> a judged
 * `ChangedRun`. The bar is recorded before the proposal runs; the
 * deterministic stub proposes from the gaps (never the bar), new tags
 * resolve through Qloo, and the same scorer re-judges on the same
 * audience tastes. A withheld change is a normal outcome, not an
 * error — the page names the failed condition (§10 #5).
 */
export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const root =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const result = root.result as FlowResult | undefined;
  const constraint =
    typeof root.constraint === "string"
      ? root.constraint.trim().slice(0, 140)
      : "";
  if (result === undefined || typeof result !== "object") {
    return NextResponse.json({ error: "result is required." }, { status: 400 });
  }
  if (constraint === "") {
    return NextResponse.json(
      { error: "constraint is required." },
      { status: 400 },
    );
  }
  if (!WORK_TYPES.includes(result.type as WorkType)) {
    return NextResponse.json(
      { error: "result.type is invalid." },
      { status: 400 },
    );
  }
  const workType = result.type as WorkType;
  const calls: QlooCall[] = [];
  resetQuota();

  const matchedTags: PitchTag[] = (result.tags ?? [])
    .filter((t) => t.status === "matched" && t.qlooId !== undefined)
    .map((t) => ({
      tag: t.label,
      qlooTagId: t.qlooId as string,
      pinned: false,
    }));
  const notFoundBefore: string[] = (result.tags ?? [])
    .filter((t) => t.status === "not_found")
    .map((t) => t.label);
  const coverageBefore = reportCoverage(
    matchedTags.map((t) => t.tag),
    notFoundBefore,
  ).coverage;

  const top = barRows(result)[0];
  const topRow = result.audiences.find((a) => a.id === top?.id);
  if (top === undefined || topRow === undefined || topRow.titles.length === 0) {
    return NextResponse.json(
      withheld({
        constraint,
        before: top?.score ?? 0,
        after: top?.score ?? 0,
        coverageAfter: coverageBefore,
        calls,
      }),
    );
  }

  const audience: Audience = {
    id: topRow.id,
    kind: topRow.role === "named" ? "hypothesis" : "rival",
    name: topRow.name,
    titles: topRow.titles.map((t) => ({
      query: t.name,
      qlooId: t.qlooId,
      name: t.name,
      type: WORK_TYPE_TO_ENTITY_TYPE[workType],
    })),
    notFoundTitles: [],
  };
  const { tastes, call: tasteCall } = await fetchAudienceTastes(
    audience,
    workType,
  );
  if (tasteCall !== null) calls.push(tasteCall);
  if (tastes.failed === true) {
    return NextResponse.json(
      withheld({
        constraint,
        before: top.score,
        after: top.score,
        coverageAfter: coverageBefore,
        calls,
      }),
    );
  }

  const labels = labelsForTastes(tastes, {});
  const gaps = findGaps(tastes, matchedTags, labels);
  const proposedPitch = await proposeDeterministic(constraint, gaps);
  const lowered = proposedPitch.toLowerCase();
  const used = gaps.filter((g) => lowered.includes(g.label.toLowerCase()));
  const usedGapLabels = used.map((g) => g.label);

  const tagRes = await resolvePitchTags(usedGapLabels, workType);
  calls.push(...tagRes.calls);
  const isGrounded = tagRes.notFoundWords.length === 0;

  const seen = new Set(matchedTags.map((t) => t.qlooTagId));
  const afterTags = [...matchedTags];
  for (const tag of tagRes.tags) {
    if (!seen.has(tag.qlooTagId)) {
      seen.add(tag.qlooTagId);
      afterTags.push(tag);
    }
  }
  const coverageAfter = reportCoverage(
    afterTags.map((t) => t.tag),
    [...notFoundBefore, ...tagRes.notFoundWords],
  ).coverage;

  const before = scoreAll([tastes], matchedTags)[0];
  const after = scoreAll([tastes], afterTags)[0];
  if (before === undefined || after === undefined) {
    return NextResponse.json(
      withheld({
        constraint,
        before: top.score,
        after: top.score,
        coverageAfter,
        calls,
        proposedPitch,
        usedGapLabels,
      }),
    );
  }

  const controlCached = await loadControlTastes(workType, CONTROL_COUNT);
  calls.push(...controlCached.calls);
  const controlScores = scoreAll(controlCached.tastes, afterTags);
  const controlBest = controlScores.reduce(
    (best, s) => Math.max(best, s.score),
    0,
  );
  const clearsControl =
    controlCached.controls.length === 0
      ? false
      : after.score - controlBest >= CONTROL_MARGIN;

  return NextResponse.json({
    changed: {
      constraint,
      proposedPitch,
      usedGapLabels,
      bar: { minRise: MIN_RISE, requireControl: true },
      check: checkChange(
        { minRise: MIN_RISE, requireControl: true },
        before,
        after,
        coverageBefore,
        coverageAfter,
        isGrounded,
        clearsControl,
      ),
      after,
      coverageAfter,
      calls,
    },
  });
}
