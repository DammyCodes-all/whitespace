import { Suspense } from "react";
import { V2Analyze } from "@/components/v2-analyze";

/**
 * Phase 3 U: v2 analysis page (server shell, client flow).
 *
 * Idea-only entry to the discovery-led pipeline: paste the pitch,
 * optionally add context, get audience hypotheses or honest
 * exploration with evidence. Saved results restore without re-running.
 */
export default function AnalyzePage() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="flex w-full flex-1 flex-col px-6 pb-12 pt-24 sm:px-8">
        <div className="mx-auto flex w-full max-w-[960px] flex-col items-center">
          <h1 className="mx-auto w-max max-w-[calc(100vw-3rem)] whitespace-nowrap text-center font-serif text-[clamp(1.35rem,4.2vw,2.75rem)] leading-tight tracking-tight">
            Find your crowd.
          </h1>
          <p className="mx-auto mt-3 max-w-[38rem] text-center text-body text-ink-2">
            Paste an idea. We read its distinct aspects, resolve reference
            works, and show the taste connections worth investigating — with the
            gaps stated, not smoothed over.
          </p>
          <div className="mt-8 flex w-full justify-center">
            <Suspense
              fallback={
                <p className="text-sm text-ink-3">Loading analysis form…</p>
              }
            >
              <V2Analyze />
            </Suspense>
          </div>
          <p className="mt-10 text-center text-sm text-ink-3">
            Built from group-level taste data. Hypotheses are starting points
            for real conversations, not predictions.
          </p>
        </div>
      </div>
    </main>
  );
}
