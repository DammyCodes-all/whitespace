import { NextResponse } from "next/server";
import { extractPitchTags, LlmError } from "@/lib/agent/extract-tags";
import { MIN_MATCHED_TAGS } from "@/lib/config";
import type { FlowTag } from "@/lib/flow/contract";
import { resetQuota, resolvePitchTags } from "@/lib/qloo";
import { quotaFailure } from "@/lib/qloo/quota-state";

/**
 * Package C step 2: POST { pitchText } -> FlowTag chips and the detected
 * work type.
 *
 * One LLM call reads the pitch's descriptive words and its type
 * (film/music/book/game) — there is no type control anywhere in the
 * UI. Each word is matched against a real Qloo tag in the detected
 * type's namespaces. Unmatched words come back `not_found` and never
 * enter scoring; the user edits the list before running. Similar-title
 * suggestions come from Qloo (`/api/titles/related`, seeded from the
 * user's own checked titles), never from the model (§7).
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
  try {
    const tagRes = await resolvePitchTags(proposal.words, proposal.workType);
    const tags: FlowTag[] = [
      ...tagRes.tags.map((t) => {
        const qlooName = tagRes.qlooNames[t.qlooTagId];
        return {
          label: t.tag,
          qlooId: t.qlooTagId,
          status: "matched" as const,
          // Only when Qloo's name differs from the word: `lonely → Loneliness`.
          // Case alone is not a difference (`heist` vs `Heist` stays quiet).
          ...(qlooName === undefined ||
          qlooName.toLowerCase() === t.tag.toLowerCase()
            ? {}
            : { qlooName }),
        };
      }),
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
      /** Words the semantic pass rescued on a plain-search miss. */
      semanticWords: tagRes.semanticWords,
      /** Below this the run stops as Inconclusive (flow gate). */
      minMatched: MIN_MATCHED_TAGS,
      quota: "ok",
    });
  } catch (err) {
    const failure = quotaFailure(err);
    if (failure !== null) {
      console.warn(`[tags] ${failure.body.quota}`);
      return NextResponse.json(failure.body, {
        status: failure.status,
        headers: failure.headers,
      });
    }
    console.error(
      `[tags] failed — ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json(
      { error: "Tag matching failed." },
      { status: 500 },
    );
  }
}
