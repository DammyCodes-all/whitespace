import type { Metadata } from "next";
import Link from "next/link";
import { RecordedRunNotice } from "@/components/demo/recorded-run-notice";
import { FlowEvidenceBlock } from "@/components/flow/flow-evidence-block";
import { FlowResultView } from "@/components/flow-result-view";
import { IdeaCard } from "@/components/idea-card";
import {
  RECORDED_FLOW_RESULT,
  RECORDED_FLOW_STEPS,
  RECORDED_NAMED_TITLES,
  RECORDED_RUN_META,
} from "@/lib/demo/recorded-run";

export const metadata: Metadata = {
  title: "Recorded live run · Whitespace",
  description:
    "One real Qloo run, replayed with its evidence: 96 calls, 24 audiences, no network needed.",
};

/**
 * The static sample is a recorded live run, not a hand-built fixture.
 * It exists so the result page still has something honest to show when
 * the network or the Qloo quota is down (§9, step 6).
 */
export default function DemoResultPage() {
  return (
    <main id="main-content" tabIndex={-1} className="flex-1">
      <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
        <h1 className="sr-only">Recorded live run</h1>
        <RecordedRunNotice
          recordedAt={RECORDED_RUN_META.recordedAt}
          calls={RECORDED_RUN_META.calls}
          audiences={RECORDED_RUN_META.audiences}
          controls={RECORDED_RUN_META.controls}
          grounded={RECORDED_RUN_META.grounded}
        />

        <IdeaCard
          className="mt-6"
          headingId="recorded-idea-heading"
          pitch={RECORDED_FLOW_RESULT.pitch}
          meta={`film · recorded live run · ${RECORDED_RUN_META.calls} Qloo calls`}
        />

        <p className="mt-2 font-mono text-xs text-ink-3">
          Named titles: {RECORDED_NAMED_TITLES.join(", ")}
        </p>

        <div className="mt-12">
          <FlowResultView result={RECORDED_FLOW_RESULT} />
        </div>

        <FlowEvidenceBlock
          steps={RECORDED_FLOW_STEPS}
          evidence={RECORDED_FLOW_RESULT.evidence}
          totalCalls={RECORDED_FLOW_RESULT.qlooCalls.total}
          note="Long response bodies are trimmed; every request, status and call id is complete."
        />

        <p className="mt-10 max-w-prose text-sm text-ink-3">
          This page is a recording, not a live run.{" "}
          <Link
            href="/"
            className="text-ink underline decoration-dotted underline-offset-4 hover:text-measured"
          >
            Try your own pitch
          </Link>{" "}
          to run the agent against Qloo.
        </p>
      </div>
    </main>
  );
}
