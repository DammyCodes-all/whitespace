import Link from "next/link";
import { CasePrintButton } from "@/components/case-print-button";
import { EvidenceCalls } from "@/components/evidence";
import { ReachPlan } from "@/components/reach";
import { buildCase } from "@/lib/case/build";
import { parseRunInput } from "@/lib/demo/parse-run-input";
import { buildReachGroups } from "@/lib/demo/reach-groups";
import { runPipeline } from "@/lib/pipeline/run";
import type { PipelineResult, QlooCall } from "@/lib/types";

/**
 * Day 9 U: printable audience one-pager. Owned by U.
 *
 * Server Component on the same `?input=` contract as `/run`: it reruns
 * the pipeline (mock path when keyless, honestly Inconclusive) and
 * assembles the shared reach groups, then renders the case model from
 * `buildCase` (§6.10). Reach failure degrades to a caseless reach
 * section, never a broken page. Site chrome hides on paper via
 * `print:hidden` so the page is the document.
 *
 * Spec ref: §6.10 (one page, footer disclaimer), §6.12 (evidence
 * links), §10 #4 (limits list no-data items by name).
 */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Audience case: Whitespace",
  description:
    "The one-page audience case: verdict, evidence, reach plan and limits.",
};

export default async function CasePage({
  searchParams,
}: {
  searchParams?: Promise<{ input?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const pipelineInput = parseRunInput(params.input);
  let result: PipelineResult;
  try {
    result = await runPipeline(pipelineInput);
  } catch {
    return (
      <main className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:px-8">
          <p className="font-mono text-xs tracking-tight text-ink-3">
            Audience case
          </p>
          <h1 className="mt-2 text-2xl tracking-tight text-ink">
            Case unavailable for this input.
          </h1>
          <div className="mt-8">
            <Link
              href="/run"
              className="inline-block bg-ink px-5 py-2.5 text-sm text-paper transition-colors transition-transform duration-150 ease-out hover:bg-ink-2 active:scale-[0.97]"
            >
              Back to the run
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const model = buildCase(result);
  let reachGroups: Awaited<ReturnType<typeof buildReachGroups>>["groups"] = [];
  let reachCalls: QlooCall[] = [];
  try {
    const built = await buildReachGroups(result);
    reachGroups = built.groups;
    reachCalls = built.calls;
  } catch {
    reachGroups = [];
    reachCalls = [];
  }
  const backHref = `/run?input=${encodeURIComponent(JSON.stringify(pipelineInput))}`;

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:px-8">
        <p className="font-mono text-xs tracking-tight text-ink-3">
          Audience case
        </p>
        <h1 className="mt-2 text-2xl tracking-tight text-ink">
          {model.pitchOneLiner}
        </h1>

        <div className="mt-6 border-y border-rule py-4">
          <p className="text-lg tracking-tight text-ink">
            {model.verdictHeadline}
          </p>
          {model.verdictSub !== null ? (
            <p className="mt-1 text-sm leading-relaxed text-ink-2">
              {model.verdictSub}
            </p>
          ) : null}
          <p data-numeric className="tnum mt-2 font-mono text-xs text-ink-3">
            margin vs second {model.marginTopVsSecond.toFixed(3)} · margin vs
            control {model.marginTopVsControl.toFixed(3)} · coverage{" "}
            {Math.round(model.coverage * 100)}%
          </p>
        </div>

        <section aria-label="Named audience" className="mt-8">
          <h2 className="text-lg tracking-tight text-ink">
            {model.topAudienceName}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
            {model.topAudienceTitles.length > 0
              ? model.topAudienceTitles.join(", ")
              : "No titles resolved."}
          </p>
        </section>

        <section aria-label="Evidence" className="mt-8">
          <h2 className="text-lg tracking-tight text-ink">Evidence</h2>
          <ol className="mt-2 border-t border-rule">
            {model.evidence.map((line, index) => (
              <li
                key={line.text}
                className="border-b border-rule py-2 text-[15px] leading-relaxed text-ink"
              >
                {line.text}
                {line.callId !== undefined ? (
                  <a
                    href={`#${line.callId}`}
                    className="cite ml-1"
                    aria-label={`Evidence for line ${index + 1}`}
                  >
                    [e]
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        {reachGroups.length > 0 ? (
          <ReachPlan groups={reachGroups} />
        ) : (
          <section aria-label="Reach plan" className="mt-12">
            <h2 className="text-lg tracking-tight text-ink">Reach plan</h2>
            <p className="nodata mt-2 px-2 py-2 font-mono text-xs text-ink-3">
              no data
            </p>
          </section>
        )}

        <section aria-label="Limits" className="mt-12">
          <h2 className="text-lg tracking-tight text-ink">Limits</h2>
          {model.limits.length === 0 ? (
            <p className="mt-2 text-[15px] text-ink-2">
              Nothing missing: every title and word checked out.
            </p>
          ) : (
            <ul className="mt-2 border-t border-rule">
              {model.limits.map((limit) => (
                <li
                  key={limit}
                  className="border-b border-rule py-2 text-[15px] leading-relaxed text-ink-2"
                >
                  {limit}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-ink-3">
            {model.footer}
          </p>
        </section>

        <EvidenceCalls calls={[...result.calls, ...reachCalls]} />

        <div className="mt-12 flex flex-wrap items-center gap-4 print:hidden">
          <CasePrintButton />
          <Link
            href={backHref}
            className="inline-block bg-ink px-5 py-2.5 text-sm text-paper transition-colors transition-transform duration-150 ease-out hover:bg-ink-2 active:scale-[0.97]"
          >
            Back to the run
          </Link>
        </div>
      </div>
    </main>
  );
}
