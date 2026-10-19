import { NextResponse } from "next/server.js";
import { quotaFailure } from "../../../../lib/qloo/quota-state.ts";
import { suggestFromEntities } from "../../../../lib/qloo/related-titles.ts";
import type { WorkType } from "../../../../lib/types.ts";

// NOTE: `next/server.js` (not `next/server`) and relative `.ts`
// imports are deliberate: they resolve to the same NextResponse
// module Next maps `next/server` to, and they keep this handler
// runnable under plain `node --test` type stripping, which cannot
// resolve bare specifiers or the `@/*` alias. Do not "fix" them back.

const WORK_TYPES: WorkType[] = ["film", "music", "book", "game"];

/** Mirrors the titles cap: at most 5 entities fit one signal (§11). */
const MAX_SIGNAL_ENTITIES = 5;

/**
 * Entity-seeded similar titles: POST { entityIds, excludeNames?,
 * workType } -> { suggestions: string[] }.
 *
 * The ids come from the user's own Check results, so suggestions
 * only ever run off typed titles — never off pitch tags, never
 * as-you-type (the client fires this after an explicit Check or an
 * explicit Suggest click). Convenience only, never a gate: Qloo
 * failures return 200 with an empty list. Server-only: traces and
 * keys never leave the server — only display names are returned.
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
  const entityIds = Array.isArray(root.entityIds)
    ? root.entityIds.filter(
        (t): t is string => typeof t === "string" && t.trim() !== "",
      )
    : [];
  if (entityIds.length === 0) {
    return NextResponse.json(
      { error: "entityIds is required." },
      { status: 400 },
    );
  }
  const excludeNames = Array.isArray(root.excludeNames)
    ? root.excludeNames.filter(
        (t): t is string => typeof t === "string" && t.trim() !== "",
      )
    : [];

  try {
    const out = await suggestFromEntities(
      entityIds.slice(0, MAX_SIGNAL_ENTITIES),
      excludeNames,
      workType as WorkType,
    );
    return NextResponse.json({ suggestions: out.names, quota: "ok" });
  } catch (err) {
    const failure = quotaFailure(err);
    if (failure !== null) {
      console.warn(`[titles/related] ${failure.body.quota}`);
      return NextResponse.json(failure.body, {
        status: failure.status,
        headers: failure.headers,
      });
    }
    console.error(
      `[titles/related] failed — ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json(
      { error: "Title suggestions failed." },
      { status: 500 },
    );
  }
}
