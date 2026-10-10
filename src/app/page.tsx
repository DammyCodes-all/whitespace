import { Suspense } from "react";
import { V2Analyze } from "@/components/v2-analyze";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="flex w-full flex-1 flex-col px-6 pb-12 pt-24 sm:px-8">
        <div className="mx-auto flex w-full max-w-[960px] flex-col items-center">
          <h1 className="mx-auto w-max max-w-[calc(100vw-3rem)] whitespace-nowrap text-center font-serif text-[clamp(1.35rem,4.2vw,2.75rem)] leading-tight tracking-tight">
            Every idea has a crowd. Most miss theirs.
          </h1>

          <p className="mx-auto mt-3 max-w-[38rem] text-center text-body text-ink-2">
            Paste an idea. We read its distinct aspects and show taste
            connections worth investigating — with evidence and gaps, not fit
            scores.
          </p>

          <div className="mt-8 flex w-full max-w-[720px] flex-col">
            <Suspense
              fallback={
                <p className="text-sm text-ink-3">Loading analysis form…</p>
              }
            >
              <V2Analyze />
            </Suspense>

            <p className="mt-10 text-center text-sm text-ink-3">
              Results are a hypothesis built from group-level taste data. They
              do not predict outcomes, and they never replace talking to real
              people.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
