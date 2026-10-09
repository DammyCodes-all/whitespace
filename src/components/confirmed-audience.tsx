"use client";

/**
 * Confirmed hypothesis audience panel. Owned by U.
 *
 * Section of `./pitch-form.tsx` (§6.2). Shows what the confirm step
 * kept, what Qloo could not find, and the nothing-like titles feeding
 * the Day 5 exclusion step.
 */

import Link from "next/link";
import type { Audience } from "@/lib/types";

export function ConfirmedAudience({
  audience,
  pendingTitles,
  nothingLike,
  runHref = "/run",
}: {
  audience: Audience;
  pendingTitles?: string[];
  nothingLike: string[];
  runHref?: string;
}) {
  const titles = pendingTitles ?? [
    ...audience.titles.map((t) => t.name),
    ...audience.notFoundTitles,
  ];
  return (
    <div className="mt-6 border border-rule bg-surface p-4">
      <p className="font-mono text-xs tracking-tight text-ink-3">
        hypothesis audience · §6.2
      </p>
      <p className="mt-1 font-serif text-base text-ink">
        {titles.length === 0
          ? "No titles listed"
          : `${titles.length} title${titles.length === 1 ? "" : "s"} to check at run: ${titles.join(", ")}`}
      </p>
      {nothingLike.some((v) => v.trim() !== "") && (
        <p className="mt-1 font-mono text-xs text-ink-2">
          Nothing like:{" "}
          {nothingLike
            .map((v) => v.trim())
            .filter(Boolean)
            .join(", ")}{" "}
          · feeds the Day 5 exclusion step.
        </p>
      )}
      <Link
        href={runHref}
        className="mt-3 inline-block bg-ink px-5 py-2.5 text-sm text-paper transition-colors transition-transform duration-150 ease-out hover:bg-ink-2 active:scale-[0.97]"
      >
        {runHref === "/run" ? "See a sample run" : "Run this pitch"}
      </Link>
    </div>
  );
}
