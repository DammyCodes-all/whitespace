/**
 * Day 4 U: ranked audiences with no-data flags. Owned by U.
 *
 * Lifted from the Day 1 `/run` skeleton into its planned component: the
 * same shapes, the same bars, the same control-ceiling line. One rule is
 * load-bearing: an unjudgeable audience draws the no-data state instead
 * of a number or a bar (§10 #4). A placeholder 0 must never read as a
 * low score, so `isUnjudgeable` from Day 3 S decides before anything
 * numeric renders. Server Component, fixtures until the Day 6 seam.
 *
 * Spec ref: §6.7 (ranked audiences + margins), §6.6 (zero vs no-data),
 * §6.12 (every audience links its Qloo call), §10 #4 (no-data honesty).
 */

import { isUnjudgeable } from "@/lib/scoring/fit";
import type { Audience, FitScore } from "@/lib/types";

const FALLBACK_CALL_ID = "call-insights-1";

/**
 * Ranked contender bars. `controlCeiling` is the best control score: the
 * vertical line marks it and bars past it clear control (§6.7).
 * `audienceCallIds` maps each audience to its evidence call (§6.12).
 */
export function RankedList({
  audiences,
  scores,
  controlCeiling,
  audienceCallIds,
  topName,
}: {
  audiences: Audience[];
  scores: FitScore[];
  controlCeiling: number;
  audienceCallIds: Record<string, string>;
  topName?: string;
}) {
  return (
    <section aria-label="Ranked audiences" className="mt-12">
      <h2 className="text-lg tracking-tight text-ink">Ranked audiences</h2>
      <div className="mt-4 border-t border-rule">
        {scores.map((score) => {
          const audience = audiences.find((a) => a.id === score.audienceId);
          if (!audience) return null;
          const callId = audienceCallIds[score.audienceId] ?? FALLBACK_CALL_ID;
          if (isUnjudgeable(score)) {
            return (
              <div key={score.audienceId} className="border-b border-rule py-4">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-serif text-base text-ink">
                    {audience.name}
                  </p>
                  <p className="font-mono text-sm text-ink-3">
                    not measured
                    <a
                      href={`#${callId}`}
                      className="cite ml-1"
                      aria-label={`Evidence for ${audience.name}`}
                    >
                      [e]
                    </a>
                  </p>
                </div>
                <p className="mt-2 font-mono text-xs text-ink-3">
                  {audience.kind} · not enough Qloo data to judge
                  {score.noDataTags.length > 0 && (
                    <span className="nodata ml-2 px-1">
                      not measured: {score.noDataTags.join(", ")}
                    </span>
                  )}
                </p>
              </div>
            );
          }
          const pct = Math.round(score.score * 100);
          return (
            <div key={score.audienceId} className="border-b border-rule py-4">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-serif text-base text-ink">{audience.name}</p>
                <p data-numeric className="tnum font-mono text-sm text-ink">
                  {score.score.toFixed(2)}
                  <a
                    href={`#${callId}`}
                    className="cite ml-1"
                    aria-label={`Evidence for ${audience.name}`}
                  >
                    [e]
                  </a>
                </p>
              </div>
              <div
                className="relative mt-2 h-2 bg-rule"
                role="img"
                aria-label={`${audience.name} scores ${score.score}, control ceiling ${controlCeiling}`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-measured"
                  style={{ width: `${pct}%` }}
                />
                <div
                  className="absolute inset-y-[-4px] w-px bg-ink"
                  style={{ left: `${Math.round(controlCeiling * 100)}%` }}
                  aria-hidden="true"
                />
              </div>
              <p className="mt-2 font-mono text-xs text-ink-3">
                {audience.kind} · matched{" "}
                {score.matchedTags.join(", ") || "none"}
                {score.noDataTags.length > 0 && (
                  <span className="nodata ml-2 px-1">
                    not measured: {score.noDataTags.join(", ")}
                  </span>
                )}
              </p>
              {audience.notFoundTitles.length > 0 && (
                <p className="mt-1 font-mono text-xs text-clay">
                  not found in Qloo: {audience.notFoundTitles.join(", ")}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 font-mono text-xs text-ink-3">
        Vertical line marks the control ceiling. Bars past it clear control
        (§6.7).
        {topName ? ` Top: ${topName}.` : ""}
      </p>
    </section>
  );
}
