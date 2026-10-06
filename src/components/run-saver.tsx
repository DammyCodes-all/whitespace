"use client";

import { useEffect, useState } from "react";
import { saveRun } from "@/lib/demo/store";
import type { PipelineResult } from "@/lib/types";

/**
 * Day 6 U: save-only island for the live run. Owned by U.
 *
 * The store is client-only (localStorage), the `/run` page is server, so
 * this tiny island carries the result across the boundary and saves it
 * for replay without calling Qloo again (§6.12, §10 #6). Loading saved
 * runs back is later demo work; the Day 1 mocks stay the render
 * fallback (§9). No UI beyond a mono note.
 */
export function RunSaver({
  result,
  id,
}: {
  result: PipelineResult;
  id: string;
}) {
  const [runId] = useState(() =>
    id !== "latest" ? id : `run-${Date.now()}-${Math.random()}`,
  );

  useEffect(() => {
    saveRun(runId, result);
  }, [result, runId]);

  return <p className="font-mono text-xs text-ink-3">Saved for replay.</p>;
}
