import Link from "next/link";
import { RunSteps } from "@/components/run-steps";
import {
  mockAudiences,
  mockCalls,
  mockInput,
  mockScores,
  mockSteps,
  mockVerdict,
} from "@/lib/demo/mock-run";

/**
 * Day 1 /run skeleton on U-owned mocks (§5.4).
 * Live runPipeline() seam wires here Day 6; mocks stay as saved-run
 * fallback (§9, §10 #6). Server Component, light-only, static.
 */

export const metadata = {
  title: "Sample run: Whitespace",
  description:
    "A sample audience run on mocks. Live Qloo wiring lands with the Day 6 seam.",
};

const CONTROL_CEILING = 0.44;

/** Day 1 mock citation per audience; Day 6 replaces these with real traces. */
const AUDIENCE_CALL_IDS: Record<string, string> = {
  hyp: "call-search-1",
  "rival-lit": "call-insights-1",
  "rival-amb": "call-search-2",
};

export default function RunPage() {
  const top = mockAudiences.find((a) => a.id === mockVerdict.topAudienceId);

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:px-8">
        <p className="font-mono text-xs tracking-tight text-ink-3">
          Sample run on mocks
        </p>
        <h1 className="mt-4 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
          {mockVerdict.surprise
            ? "Your best fit is not the audience you named."
            : "Where the pitch lands."}
        </h1>
        <p className="mt-4 max-w-prose text-body text-ink-2">
          {mockInput.pitchText} Verdict on mocks is {mockVerdict.verdict},
          margin{" "}
          <span data-numeric className="tnum font-mono text-sm">
            {mockVerdict.marginTopVsSecond.toFixed(2)}
          </span>{" "}
          over second and{" "}
          <span data-numeric className="tnum font-mono text-sm">
            {mockVerdict.marginTopVsControl.toFixed(2)}
          </span>{" "}
          over control.
        </p>

        <div className="mt-8">
          <RunSteps steps={mockSteps} />
        </div>

        <section aria-label="Ranked audiences" className="mt-12">
          <h2 className="text-lg tracking-tight text-ink">Ranked audiences</h2>
          <div className="mt-4 border-t border-rule">
            {mockScores.map((score) => {
              const audience = mockAudiences.find(
                (a) => a.id === score.audienceId,
              );
              if (!audience) return null;
              const pct = Math.round(score.score * 100);
              return (
                <div
                  key={score.audienceId}
                  className="border-b border-rule py-4"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="font-serif text-base text-ink">
                      {audience.name}
                    </p>
                    <p data-numeric className="tnum font-mono text-sm text-ink">
                      {score.score.toFixed(2)}
                      <a
                        href={`#${AUDIENCE_CALL_IDS[score.audienceId] ?? "call-insights-1"}`}
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
                    aria-label={`${audience.name} scores ${score.score}, control ceiling ${CONTROL_CEILING}`}
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-measured"
                      style={{ width: `${pct}%` }}
                    />
                    <div
                      className="absolute inset-y-[-4px] w-px bg-ink"
                      style={{ left: `${Math.round(CONTROL_CEILING * 100)}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 font-mono text-xs text-ink-3">
                    {audience.kind} · matched{" "}
                    {score.matchedTags.join(", ") || "none"}
                    {score.noDataTags.length > 0 && (
                      <span className="nodata ml-2 px-1">
                        no data: {score.noDataTags.join(", ")}
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
            {top ? ` Top on mocks: ${top.name}.` : ""}
          </p>
        </section>

        <section aria-label="Evidence calls" className="mt-12">
          <h2 className="text-lg tracking-tight text-ink">Evidence calls</h2>
          <div className="mt-4 border-t border-rule">
            {mockCalls.map((call) => (
              <div
                key={call.id}
                id={call.id}
                className="border-b border-rule py-3 font-mono text-xs text-ink-2"
              >
                <p data-numeric>
                  {call.method} {call.endpoint} · {call.status} ·{" "}
                  {call.durationMs}ms
                  {call.fromCache ? " · saved" : ""}
                </p>
                <p className="mt-1 break-all text-ink-3">
                  {Object.entries(call.params)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(" ")}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-12 flex flex-wrap items-center gap-4">
          <Link
            href="/"
            className="inline-block bg-measured px-5 py-2.5 text-sm text-white transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            Back to start
          </Link>
          <p className="font-mono text-xs text-ink-3">
            Live Qloo wiring lands with the Day 6 seam.
          </p>
        </div>
      </div>
    </main>
  );
}
