import { NextResponse } from "next/server";
import { extractPitchTags, LlmError } from "@/lib/agent/extract-tags";
import { MIN_MATCHED_TAGS } from "@/lib/config";
import type { FlowTag } from "@/lib/flow/contract";
import { resetQuota, resolvePitchTags } from "@/lib/qloo";

/**
 * Package C step 2: POST { pitchText } -> FlowTag chips, the detected
 * work type, and suggested similar-to titles.
 *
 * One LLM call reads the pitch's descriptive words, its type
 * (film/music/book/game) — there is no type control anywhere in the
 * UI — and 3 to 5 well-known titles the pitch resembles. Each word is
 * matched against a real Qloo tag in the detected type's namespaces.
 * Unmatched words come back `not_found` and never enter scoring; the
 * user edits the list before running. Suggested titles are UNVERIFIED
 * strings for tap-to-add: the run resolves each one live and reports
 * misses as not-found (§6.2, §8), so a model invention can never score.
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
  if (pitchText.trim() === "") {
    return NextResponse.json(
      { error: "pitchText is required." },
      { status: 400 },
    );
  }

  let proposal: {
    words: string[];
    workType: "film" | "music" | "book" | "game";
    similarTitles: string[];
  };
  try {
    proposal = await extractPitchTags({ pitchText });
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
  const tagRes = await resolvePitchTags(proposal.words, proposal.workType);
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
    suggested: proposal.words.length,
    workType: proposal.workType,
    /** Unverified suggestions for tap-to-add; resolved live at run time. */
    similarTitles: proposal.similarTitles,
    /** Below this the run stops as Inconclusive (flow gate). */
    minMatched: MIN_MATCHED_TAGS,
  });
}
