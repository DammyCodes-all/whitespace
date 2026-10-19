import { NextResponse } from "next/server.js";
import { quotaFailure } from "../../../../lib/qloo/quota-state.ts";
import { resolveTitles } from "../../../../lib/qloo/resolve-titles.ts";
import type { WorkType } from "../../../../lib/types.ts";

// NOTE: `next/server.js` (not `next/server`) and relative `.ts`
// imports are deliberate: they resolve to the same NextResponse
// module Next maps `next/server` to, and they keep this handler
// runnable under plain `node --test` type stripping, which cannot
// resolve bare specifiers or the `@/*` alias. Do not "fix" them back.

const WORK_TYPES: WorkType[] = ["film", "music", "book", "game"];

/**
 * On-demand title check: POST { titles, workType } ->
 * { resolved: [{ query, name, qlooId }], notFound: [] }.
 *
 * Thin wrapper over `resolveTitles` (1 `/search` call per title,
 * `MAX_TITLE_QUERIES` cap, cached). The UI calls this from an
 * explicit button only, never on keystroke. Informational: `/api/flow`
 * re-resolves at run time, so the run stays source of truth.
 * Server-only: traces and keys never leave the server — only the
 * query/name/id triples and the not-found list are returned.
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
  const titles = Array.isArray(root.titles)
    ? root.titles.filter(
        (t): t is string => typeof t === "string" && t.trim() !== "",
      )
    : [];
  if (titles.length === 0) {
    return NextResponse.json({ error: "titles is required." }, { status: 400 });
  }

  try {
    const out = await resolveTitles(titles, workType as WorkType);
    return NextResponse.json({
      resolved: out.resolved.map((t) => ({
        query: t.query,
        name: t.name,
        qlooId: t.qlooId,
      })),
      notFound: out.notFoundTitles,
      quota: "ok",
    });
  } catch (err) {
    const failure = quotaFailure(err);
    if (failure !== null) {
      console.warn(`[titles/check] ${failure.body.quota}`);
      return NextResponse.json(failure.body, {
        status: failure.status,
        headers: failure.headers,
      });
    }
    console.error(
      `[titles/check] failed — ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json({ error: "Title check failed." }, { status: 500 });
  }
}
