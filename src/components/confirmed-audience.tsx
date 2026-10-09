"use client";

/**
 * Confirmed hypothesis audience panel. Owned by U.
 *
 * Section of `./pitch-form.tsx` (§6.2). Shows what the confirm step
 * kept, what Qloo could not find, and the nothing-like titles feeding
 * the Day 5 exclusion step. Day 11: states the guess out loud — the
 * hypothesis titles, the rival readings, and the words about to be
 * checked — and asks "is that your crowd?" before the user spends a
 * run. Silent mismatch becomes an informed choice (§5, §6.3).
 */

import Link from "next/link";
import type { Audience } from "@/lib/types";

export interface ConfirmedRival {
  name: string;
  titles: string[];
}

export function ConfirmedAudience({
  audience,
  pendingTitles,
  nothingLike,
  runHref = "/run",
  rivals = [],
  words = [],
}: {
  audience: Audience;
  pendingTitles?: string[];
  nothingLike: string[];
  runHref?: string;
  rivals?: ConfirmedRival[];
  words?: string[];
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
      <p className="mt-2 text-sm text-ink-2">
        About to test fans of{" "}
        {titles.length === 0 ? "nothing yet" : titles.join(", ")}
        {rivals.length > 0 && (
          <>
            {" "}
            against {rivals.length} rival reading
            {rivals.length === 1 ? "" : "s"} (
            {rivals.map((r) => r.name).join("; ")})
          </>
        )}
        {words.length > 0 && <> — checking words: {words.join(", ")}</>}. Is
        that your crowd?
      </p>
      {rivals.length > 0 && (
        <ul className="mt-2 space-y-1">
          {rivals.map((rival) => (
            <li key={rival.name} className="font-mono text-xs text-ink-3">
              {rival.name}: {rival.titles.join(", ")}
            </li>
          ))}
        </ul>
      )}
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
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <Link
          href={runHref}
          className="inline-block bg-ink px-5 py-2.5 text-sm text-paper transition-colors transition-transform duration-150 ease-out hover:bg-ink-2 active:scale-[0.97]"
        >
          {runHref === "/run" ? "See a sample run" : "Run this pitch"}
        </Link>
        <span className="font-mono text-xs text-ink-3">
          Not your crowd? Edit above before running.
        </span>
      </div>
    </div>
  );
}
