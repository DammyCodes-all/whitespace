import { NextResponse } from "next/server";
import { attachReachProse } from "@/lib/agent/reach-prose";
import type { FlowTagInput } from "@/lib/flow/run-flow";
import { runFlowPitch } from "@/lib/flow/run-flow";
import { quotaFailure } from "@/lib/qloo/quota-state";
import type { WorkType } from "@/lib/types";

const WORK_TYPES: WorkType[] = ["film", "music", "book", "game"];

/**
 * Package C step 4: POST { pitchText, workType, tags, similarTitles }
 * -> the adapter's FlowResult plus the run steps with real counts.
 *
 * The tags arrive from the chip step (step 2), so this route never
 * re-proposes them. Server-only: Qloo keys stay server-side.
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
  const pitchText = typeof root.pitchText === "string" ? root.pitchText : "";
  const workType = typeof root.workType === "string" ? root.workType : "";
  if (pitchText.trim() === "") {
    return NextResponse.json(
      { error: "pitchText is required." },
      { status: 400 },
    );
  }
  if (!WORK_TYPES.includes(workType as WorkType)) {
    return NextResponse.json(
      { error: "workType is invalid." },
      { status: 400 },
    );
  }

  const toTags = (value: unknown): FlowTagInput[] => {
    if (!Array.isArray(value)) return [];
    const out: FlowTagInput[] = [];
    for (const raw of value) {
      if (typeof raw !== "object" || raw === null) continue;
      const r = raw as Record<string, unknown>;
      const label = typeof r.label === "string" ? r.label.trim() : "";
      const qlooId = typeof r.qlooId === "string" ? r.qlooId : undefined;
      const status = r.status === "not_found" ? "not_found" : "matched";
      if (label === "") continue;
      if (status === "matched" && qlooId === undefined) continue;
      out.push({ label, qlooId, status });
    }
    return out;
  };
  const toStrings = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter(
          (v): v is string => typeof v === "string" && v.trim() !== "",
        )
      : [];

  try {
    const out = await runFlowPitch({
      pitchText,
      workType: workType as WorkType,
      nothingLike: [],
      similarTitles: toStrings(root.similarTitles),
      tags: toTags(root.tags),
      pickedTagIds: toStrings(root.pickedTagIds),
    });
    const result = await attachReachProse(out.result);
    return NextResponse.json({
      result,
      steps: out.steps,
      stopped: out.stopped,
      quota: "ok",
    });
  } catch (err) {
    const failure = quotaFailure(err);
    if (failure !== null) {
      console.warn(`[flow] ${failure.body.quota}`);
      return NextResponse.json(failure.body, {
        status: failure.status,
        headers: failure.headers,
      });
    }
    console.error(
      `[flow] failed — ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json({ error: "The run failed." }, { status: 500 });
  }
}
