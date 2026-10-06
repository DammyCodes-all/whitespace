import Link from "next/link";
import { RankedList } from "@/components/ranked-list";
import { RunSteps } from "@/components/run-steps";
import { VerdictHeadline } from "@/components/verdict";
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
        <VerdictHeadline
          verdict={mockVerdict}
          pitchText={mockInput.pitchText}
          context="on mocks"
        />

        <div className="mt-8">
          <RunSteps steps={mockSteps} />
        </div>

        <RankedList
          audiences={mockAudiences}
          scores={mockScores}
          controlCeiling={CONTROL_CEILING}
          audienceCallIds={AUDIENCE_CALL_IDS}
          topName={top ? `${top.name} (on mocks)` : undefined}
        />

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
