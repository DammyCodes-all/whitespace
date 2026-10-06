/**
 * Day 4 U: verdict headline. Owned by U.
 *
 * Lifted from the Day 1 `/run` skeleton into its planned component: the
 * same shapes, the same copy. The surprise headline (§6.7) reads "Your
 * best fit is not the audience you named." only when the verdict says so;
 * the AI never rewords it. Server Component, fixtures until the Day 6
 * seam lands.
 *
 * Spec ref: §6.7 (verdict + margins + surprise), §5.5 (see the verdict).
 */

import type { VerdictResult } from "@/lib/types";

/**
 * Verdict headline plus margins. `pitchText` is the idea in one line;
 * `context` names the data source ("on mocks", "saved run") so a fixture
 * render never passes for live Qloo (§10 #9 honesty).
 */
export function VerdictHeadline({
  verdict,
  pitchText,
  context,
}: {
  verdict: VerdictResult;
  pitchText: string;
  context: string;
}) {
  return (
    <div>
      <h1 className="mt-4 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
        {verdict.surprise
          ? "Your best fit is not the audience you named."
          : "Where the pitch lands."}
      </h1>
      <p className="mt-4 max-w-prose text-body text-ink-2">
        {pitchText} Verdict {context} is {verdict.verdict}, margin{" "}
        <span data-numeric className="tnum font-mono text-sm">
          {verdict.marginTopVsSecond.toFixed(2)}
        </span>{" "}
        over second and{" "}
        <span data-numeric className="tnum font-mono text-sm">
          {verdict.marginTopVsControl.toFixed(2)}
        </span>{" "}
        over control.
      </p>
    </div>
  );
}
