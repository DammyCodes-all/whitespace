"use client";

/**
 * Day 6.5 U: browser wrapper for the LLM proposal seam. Owned by U.
 *
 * POSTs pitch + work type to `/api/propose` (keys stay server-side) and
 * returns validated proposals. Throws a plain Error with a displayable
 * message; the form keeps its fixture suggestions when this fails (§9).
 */

import type { ProposeResult } from "@/lib/agent/propose";
import type { WorkType } from "@/lib/types";

export async function fetchProposals(
  pitchText: string,
  workType: WorkType,
): Promise<ProposeResult> {
  const res = await fetch("/api/propose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pitchText, workType }),
  });
  const data: unknown = await res.json().catch(() => null);
  if (res.ok) return data as ProposeResult;
  const message =
    typeof data === "object" && data !== null
      ? String((data as Record<string, unknown>).error ?? "Proposal failed.")
      : "Proposal failed.";
  throw new Error(message);
}
