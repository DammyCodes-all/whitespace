import { NextResponse } from "next/server.js";
import { CONTROL_COUNT } from "../../../../lib/config.ts";
import {
  fetchAllAudienceTastes,
  loadControlTastes,
  resetQuota,
} from "../../../../lib/qloo/index.ts";
import { quotaFailure } from "../../../../lib/qloo/quota-state.ts";
import { resolveTitles } from "../../../../lib/qloo/resolve-titles.ts";
import {
  buildTitleTagPool,
  namedTasteAudiences,
} from "../../../../lib/qloo/title-tags.ts";
import type { WorkType } from "../../../../lib/types.ts";

// NOTE: `next/server.js` (not `next/server`) and relative `.ts`
// imports are deliberate: they resolve to the same NextResponse
// module Next maps `next/server` to, and they keep this handler
// runnable under plain `node --test` type stripping, which cannot
// resolve bare specifiers or the `@/*` alias. Do not "fix" them back.

const WORK_TYPES: WorkType[] = ["film", "music", "book", "game"];

/**
 * Title-tag preview for the tags phase: POST { titles, workType } ->
 * { tags: [{ qlooId, label, sourceTitleId, sourceTitleName }] }.
 *
 * The same pure pool the run scores on, minus the pitch supplement
 * (the chip row already shows pitch words) and minus any user
 * selection. Qloo facts only: top tastes off each resolved title's
 * list, cut against cached controls. The run rebuilds this pool and
 * applies the confirmed `pickedTagIds`, so preview and run agree
 * whenever Qloo answers the same way twice.
 *
 * Convenience, never a gate: no resolved titles (or any Qloo
 * failure) yields `{ tags: [] }`, and the run re-resolves everything
 * anyway. The `note` tells the UI WHY the pool is empty
 * (`unresolved` | `no-tastes` | `all-generic` | `preview-failed` |
 * `ok`), so an empty preview never reads as one vague line.
 * Server-only: traces and keys never leave the server.
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

  const started = Date.now();
  const log = (note: string, gifts: number, detail = "") => {
    console.info(
      `[titles/tags] ${note}: ${gifts} gifts${detail} (${Date.now() - started}ms)`,
    );
  };
  try {
    resetQuota();
    const resolveStarted = Date.now();
    const titleRes = await resolveTitles(titles, workType as WorkType);
    console.info(
      `[titles/tags] resolve: ${titleRes.resolved.length}/${titles.length} titles (${
        Date.now() - resolveStarted
      }ms)`,
    );
    if (titleRes.resolved.length === 0) {
      log("unresolved", 0, ` from ${titles.length} typed`);
      return NextResponse.json({
        tags: [],
        note: "unresolved",
        quota: "ok",
      });
    }
    const tastesStarted = Date.now();
    const targets = namedTasteAudiences(titleRes.resolved);
    const [{ all: namedTastes }, controlCached] = await Promise.all([
      fetchAllAudienceTastes(targets, workType as WorkType).then((res) => {
        console.info(
          `[titles/tags] title tastes: ${res.calls.length} calls for ${
            targets.length
          } titles (${Date.now() - tastesStarted}ms)`,
        );
        return res;
      }),
      loadControlTastes(workType as WorkType, CONTROL_COUNT).then((res) => {
        console.info(
          `[titles/tags] controls: ${res.tastes.length} lists, ${
            res.calls.length
          } calls, cache=${res.fromCache}, dropped=${
            res.droppedControls.length
          } (${Date.now() - tastesStarted}ms)`,
        );
        return res;
      }),
    ]);
    const withTastes = titleRes.resolved.map((title, index) => ({
      tastes: namedTastes[index] ?? {
        audienceId: `title:${title.qlooId}`,
        tagIds: [],
        failed: true,
      },
      titleId: title.qlooId,
      titleName: title.name,
    }));
    if (
      withTastes.every(
        (entry) =>
          entry.tastes.failed === true || entry.tastes.tagIds.length === 0,
      )
    ) {
      log("no-tastes", 0, ` (${titleRes.resolved.length} resolved)`);
      return NextResponse.json({ tags: [], note: "no-tastes", quota: "ok" });
    }
    const pool = buildTitleTagPool({
      namedTastes: withTastes,
      pitchMatchedTags: [],
      controlTastes: controlCached.tastes,
      pickedIds: [],
    });
    if (pool.length === 0) {
      log("all-generic", 0, ` (${titleRes.resolved.length} resolved)`);
      return NextResponse.json({ tags: [], note: "all-generic", quota: "ok" });
    }
    log("ok", pool.length, ` (${titleRes.resolved.length} resolved)`);
    return NextResponse.json({
      tags: pool.map((candidate) => ({
        qlooId: candidate.qlooTagId,
        label: candidate.label,
        sourceTitleId:
          candidate.source === "pitch" ? null : candidate.source.titleId,
        sourceTitleName: candidate.sourceTitleName ?? null,
      })),
      note: "ok",
      quota: "ok",
    });
  } catch (err) {
    const failure = quotaFailure(err);
    if (failure !== null) {
      log(failure.body.quota, 0, ` from ${titles.length} typed`);
      return NextResponse.json(failure.body, {
        status: failure.status,
        headers: failure.headers,
      });
    }
    log(
      `preview-failed — ${err instanceof Error ? err.message : String(err)}`,
      0,
    );
    return NextResponse.json({ tags: [], note: "preview-failed", quota: "ok" });
  }
}
