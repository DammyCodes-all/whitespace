import type { Metadata } from "next";
import { Suspense } from "react";
import { DemoRun } from "@/components/demo/demo-run";
import { startTitles } from "@/lib/flow/start-pitch";

export const metadata: Metadata = {
  title: "Demo run: Whitespace",
  description: "The blank run page on fixtures — zero AI or Qloo calls.",
};

/**
 * Demo mirror of /run: blank page, orb work happens here, every route
 * answered from fixtures. Enter via /demo/flow.
 */
export default async function DemoRunPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  return (
    <main id="main-content" className="page-enter flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 pt-6 sm:px-8">
        <p className="w-max max-w-[calc(100vw-3rem)] border-2 border-outline bg-split px-4 py-1 font-mono text-xs text-ink">
          Demo harness — fixtures only, nothing spent
        </p>
      </div>
      <Suspense>
        <DemoRun initialSimilarTitles={startTitles(params)} />
      </Suspense>
    </main>
  );
}
