import type { Metadata } from "next";
import { EntryBox } from "@/components/entry-box";
import { SiteFooter } from "@/components/site-footer";

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
    <>
      <main className="flex flex-1 flex-col">
        <div className="flex w-full flex-1 flex-col px-6 pb-12 pt-24 sm:px-8">
          <div className="mx-auto flex w-full max-w-[960px] flex-col items-center">
            <h1 className="mx-auto w-max max-w-[calc(100vw-3rem)] whitespace-nowrap text-center font-serif text-[clamp(1.35rem,4.2vw,2.75rem)] leading-tight tracking-tight">
              Every idea has a crowd. Most miss theirs.
            </h1>

            <p className="mx-auto mt-3 max-w-[38rem] text-center text-body text-ink-2">
              Paste an idea. We tell you which audience it fits, how strongly,
              and where to find those people, and we show our work at every
              step.
            </p>

            <div className="mt-7 flex w-full max-w-[720px] flex-col">
              <p className="mx-auto mb-4 w-max max-w-[calc(100vw-3rem)] border-2 border-outline bg-split px-4 py-1 text-center font-mono text-xs text-ink">
                Demo harness — fixtures only, nothing spent
              </p>
              <EntryBox target="/demo/run" storageKey="whitespace-demo-pitch" />
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
