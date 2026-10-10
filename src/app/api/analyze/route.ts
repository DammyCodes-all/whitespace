import { NextResponse } from "next/server";
import { parseV2Input } from "@/lib/pipeline/v2/input";
import { analyzePitch } from "@/lib/pipeline/v2/run";
import { defaultV2Deps } from "@/lib/pipeline/v2/wiring";

/**
 * Phase 3 U: POST raw pitch context -> V2Result.
 *
 * Thin wrapper over the server-only v2 orchestrator; interpretation
 * runs inside the workflow, so callers never provide tags, rivals,
 * controls, or scores. No server store: the response carries `runId`
 * and the client persists it, so a refresh never re-runs paid
 * analysis. Keys never leave the server.
 */
export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = parseV2Input(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const result = await analyzePitch(parsed.input, defaultV2Deps());
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Analysis failed unexpectedly." },
      { status: 500 },
    );
  }
}
