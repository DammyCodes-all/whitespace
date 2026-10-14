import { NextResponse } from "next/server.js";
import { suggestTitles } from "../../../../lib/qloo/suggest-titles.ts";
import type { WorkType } from "../../../../lib/types.ts";

// NOTE: `next/server.js` (not `next/server`) and relative `.ts`
// imports are deliberate: they resolve to the same NextResponse
// module Next maps `next/server` to, and they keep this handler
// runnable under plain `node --test` type stripping, which cannot
// resolve bare specifiers or the `@/*` alias. Do not "fix" them back.

const WORK_TYPES: WorkType[] = ["film", "music", "book", "game"];

/** At most TAG_WORDS.max = 8 ids fit one query string (§11). */
const MAX_SIGNAL_TAGS = 8;

/**
 * Qloo similar-title suggestions: POST { tagIds, workType } ->
 * { suggestions: string[] }.
 *
 * Convenience only, never a gate: Qloo failures return 200 with an
 * empty list, so the tag step (free typing + Check) never waits on
 * suggestions. Server-only: traces and keys never leave the server —
 * only display names are returned.
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
  const workType = typeof root.workType === "string" ? root.workType : "";
  if (!WORK_TYPES.includes(workType as WorkType)) {
    return NextResponse.json(
      { error: "workType is invalid." },
      { status: 400 },
    );
  }
  const tagIds = Array.isArray(root.tagIds)
    ? root.tagIds.filter(
        (t): t is string => typeof t === "string" && t.trim() !== "",
      )
    : [];
  if (tagIds.length === 0) {
    return NextResponse.json({ error: "tagIds is required." }, { status: 400 });
  }

  const out = await suggestTitles(
    tagIds.slice(0, MAX_SIGNAL_TAGS),
    workType as WorkType,
  );
  return NextResponse.json({ suggestions: out.names });
}
