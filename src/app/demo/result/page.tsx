import type { Metadata } from "next";
import { ChangeView } from "@/components/change";
import { FlowCompareView } from "@/components/flow-compare";
import { FlowResultView } from "@/components/flow-result-view";
import { ReachPlan } from "@/components/reach";
import {
  DEMO_CHANGE_ACCEPTED,
  DEMO_CHATBOT,
  DEMO_FLOW_RESULT,
  DEMO_GAPS,
  DEMO_PITCH_TEXT,
  DEMO_REACH_AUDIENCE,
  DEMO_RELATED,
  DEMO_UNLABELED_COUNT,
} from "@/lib/demo/design-system-data";

export const metadata: Metadata = {
  title: "End result mock · Whitespace",
  description:
    "A static result-page mock for refining the Whitespace experience.",
};

const REACH_GROUPS = [
  {
    audience: DEMO_REACH_AUDIENCE,
    headline: "Best fit",
    related: DEMO_RELATED,
    gaps: DEMO_GAPS,
    unlabeledCount: DEMO_UNLABELED_COUNT,
    tastesCallId: "ds-call-tastes-2",
  },
];

export default function DemoResultPage() {
  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
        <section className="mt-10 rounded-[18px] border-2 border-outline bg-surface p-5 shadow-[4px_4px_0_var(--outline)] sm:p-7">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-3">
            The idea
          </p>
          <p className="mt-3 max-w-3xl font-serif text-2xl leading-tight tracking-tight text-ink sm:text-3xl">
            {DEMO_PITCH_TEXT}
          </p>
          <p className="mt-3 font-mono text-xs text-ink-3">
            film · fixture run · 11 Qloo calls saved
          </p>
        </section>

        <div className="mt-12">
          <FlowResultView result={DEMO_FLOW_RESULT} orangeVerdict />
        </div>

        <ReachPlan
          groups={REACH_GROUPS}
          gapAside={
            <div>
              <h2 className="text-lg tracking-tight text-ink">
                Change and re-check
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">
                A constraint can change the pitch, but the new version has to
                score higher to land.
              </p>
              <div className="mt-4">
                <ChangeView changed={DEMO_CHANGE_ACCEPTED} />
              </div>
            </div>
          }
        />

        <FlowCompareView
          result={DEMO_FLOW_RESULT}
          similarTitles={["Moon", "Arrival"]}
          chatbot={DEMO_CHATBOT}
          error={null}
        />
      </div>
    </main>
  );
}
