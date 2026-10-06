"use client";

/**
 * Day 6.5 U: rival readings preview. Owned by U.
 *
 * Section of `./pitch-form.tsx` (§6.3). Names and reasons are the AI's;
 * titles resolve against Qloo at run time and misses drop there (§7).
 */

import type { ProposeRival } from "@/lib/agent/propose";

export function RivalPreview({ rivals }: { rivals: ProposeRival[] }) {
  if (rivals.length === 0) return null;
  return (
    <div>
      <h3 className="mt-8 text-lg tracking-tight text-ink">
        Rival readings — what else this could be
      </h3>
      <p className="mt-1 font-mono text-xs text-ink-3">
        Proposed by the AI, grounded against Qloo at run time.
      </p>
      <ul className="mt-3 space-y-3">
        {rivals.map((rival, index) => (
          <li
            // LLM ids can repeat; the index disambiguates.
            key={`${rival.id}-${index}`}
            className="border border-rule bg-surface p-3"
          >
            <p className="text-[15px] tracking-tight text-ink">{rival.name}</p>
            <p className="mt-1 text-sm text-ink-2">{rival.reason}</p>
            <p className="mt-1 font-mono text-xs text-ink-3">
              {rival.titles.join(", ")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
