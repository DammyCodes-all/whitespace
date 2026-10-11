import { NextResponse } from "next/server";
import { extractPitchTags, LlmError } from "@/lib/agent/extract-tags";
import { MIN_MATCHED_TAGS } from "@/lib/config";
import type { FlowTag } from "@/lib/flow/contract";
import { resetQuota, resolvePitchTags } from "@/lib/qloo";
import type { WorkType } from "@/lib/types";

const WORK_TYPES: WorkType[] = ["film", "music", "book", "game"];

/**
 * Package C step 2: POST { pitchText, workType } -> FlowTag chips.
 *
 * Extracts 5 to 8 descriptive words (LLM, tags only) and matches each
 * against a real Qloo tag. Unmatched words come back `not_found` and
 * never enter scoring; the user edits the list before running.
 *
 * Server-only: the key and the LLM keys never reach the browser.
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

  let words: string[];
  try {
    words = await extractPitchTags({
      pitchText,
      workType: workType as WorkType,
    });
  } catch (err) {
    if (err instanceof LlmError && err.configured === false) {
      return NextResponse.json(
        { error: err.message, code: "llm-not-configured" },
        { status: 503 },
      );
    }
    const message =
      err instanceof LlmError ? err.message : "Tag extraction failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  resetQuota();
  const tagRes = await resolvePitchTags(words, workType as WorkType);
  const tags: FlowTag[] = [
    ...tagRes.tags.map((t) => ({
      label: t.tag,
      qlooId: t.qlooTagId,
      status: "matched" as const,
    })),
    ...tagRes.notFoundWords.map((w) => ({
      label: w,
      status: "not_found" as const,
    })),
  ];
  return NextResponse.json({
    tags,
    matched: tagRes.tags.length,
    suggested: words.length,
    /** Below this the run stops as Inconclusive (flow gate). */
    minMatched: MIN_MATCHED_TAGS,
  });
}
