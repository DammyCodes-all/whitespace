import type { Metadata } from "next";
import { EntryBox } from "@/components/entry-box";

export const metadata: Metadata = {
  title: "Demo flow: Whitespace",
  description:
    "The demo entry — hands off to the blank fixture run with zero AI or Qloo calls.",
};

/**
 * Demo mirror of the landing: plain entry box, no orb. Submit
 * transitions to /demo/run, where the same OrbFlow runs on fixtures.
 */
export default function DemoFlowPage() {
  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <div className="flex w-full flex-1 flex-col px-6 pb-24 pt-12 sm:px-8 sm:pt-16">
        <div className="mx-auto my-auto flex w-full max-w-[960px] flex-col items-center">
          <h1 className="mx-auto max-w-[calc(100vw-3rem)] text-balance text-center font-serif text-[clamp(1.6rem,4.2vw,2.75rem)] leading-[1.15] tracking-tight">
            Every idea has a crowd. Most miss theirs.
          </h1>

          <p className="mt-4 max-w-[38rem] text-pretty text-center text-body text-ink-2">
            Paste an idea. We tell you which audience it fits, how strongly, and
            where to find those people, and we show our work at every step.
          </p>

          <div className="mt-12 flex w-full max-w-[720px] flex-col">
            <p className="mx-auto mb-4 max-w-[calc(100vw-3rem)] border-2 border-outline bg-split px-4 py-1 text-center font-mono text-xs text-ink">
              Demo harness — fixtures only, nothing spent
            </p>
            <EntryBox target="/demo/run" storageKey="whitespace-demo-pitch" />
          </div>
        </div>
      </div>
    </main>
  );
}
