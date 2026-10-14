import { NextResponse } from "next/server.js";
import {
  LlmError,
  pickTitleTags,
} from "../../../../lib/agent/pick-title-tags.ts";

// NOTE: `next/server.js` (not `next/server`) and relative `.ts`
// imports are deliberate: they resolve to the same NextResponse
// module Next maps `next/server` to, and they keep this handler
// runnable under plain `node --test` type stripping, which cannot
// resolve bare specifiers or the `@/*` alias. Do not "fix" them back.

/**
 * LLM fit-pick for title-gift tags: POST
 * { pitchText, candidates: [{ qlooId, label, sourceTitleName? }] } ->
 * { keptIds: string[] }.
 *
 * The model filters, never invents: kept ids are validated against
 * the candidate set. Fail-open by design — any LLM failure returns
 * 200 with every candidate kept, because the user still confirms
 * each chip and the run applies `pickedTagIds`. Zero Qloo calls.
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
  const candidates = Array.isArray(root.candidates)
    ? root.candidates.flatMap((raw) => {
        if (typeof raw !== "object" || raw === null) return [];
        const c = raw as Record<string, unknown>;
        if (typeof c.qlooId !== "string" || typeof c.label !== "string") {
          return [];
        }
        return [
          {
            qlooId: c.qlooId,
            label: c.label,
            sourceTitleName:
              typeof c.sourceTitleName === "string" ? c.sourceTitleName : null,
          },
        ];
      })
    : [];
  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "candidates is required." },
      { status: 400 },
    );
  }

  try {
    const keptIds = await pickTitleTags({ pitchText, candidates });
    return NextResponse.json({ keptIds });
  } catch (err) {
    // Fail open: the user confirms every chip, so unfiltered beats none.
    if (err instanceof LlmError) {
      return NextResponse.json({
        keptIds: candidates.map((c) => c.qlooId),
      });
    }
    throw err;
  }
}
